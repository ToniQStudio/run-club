import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/lead.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function jsonResponse(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/leads") {
    if (req.method !== "POST") {
      jsonResponse(res, 405, { ok: false, error: "Метод не поддерживается." });
      return;
    }

    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32 * 1024) {
        jsonResponse(res, 413, { ok: false, error: "Слишком большая заявка." });
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", async () => {
      const target = process.env.LEAD_INTAKE_URL || "http://127.0.0.1:4174/api/leads";
      try {
        const upstream = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw
        });
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
        res.end(text);
      } catch {
        jsonResponse(res, 502, { ok: false, error: "Lead intake недоступен. Запустите crm/." });
      }
    });
    return;
  }

  if (url.pathname === "/api/lead") {
    if (req.method !== "POST") {
      jsonResponse(res, 405, { ok: false, error: "Метод не поддерживается." });
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", async () => {
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        jsonResponse(res, 400, { ok: false, error: "Некорректный JSON." });
        return;
      }

      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(data));
      };

      try {
        await handler(req, res);
      } catch {
        jsonResponse(res, 500, { ok: false, error: "Внутренняя ошибка." });
      }
    });
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const filePath = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ""));

  try {
    const file = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[extname(filePath)] || "application/octet-stream");
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`YB800 landing: http://localhost:${port}`);
});
