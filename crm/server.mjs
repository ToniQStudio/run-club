import { createServer } from "node:http";
import { appendFile, chmod, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4174);
const HOST = process.env.HOST || "127.0.0.1";
const CRM_PROVIDER = (process.env.CRM_PROVIDER || "mock").toLowerCase();
const BITRIX24_WEBHOOK_URL = normalizeBaseUrl(process.env.BITRIX24_WEBHOOK_URL);
const ESPO_BASE_URL = normalizeBaseUrl(process.env.ESPO_BASE_URL);
const ESPO_API_KEY = process.env.ESPO_API_KEY || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const DATA_DIR = resolve(process.env.DATA_DIR || join(root, "data"));
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:4173,http://127.0.0.1:4173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const rateBuckets = new Map();

const ALLOWED_CHANNELS = new Set(["site", "telegram", "max", "offline"]);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function normalizeBaseUrl(value) {
  if (!value) return "";
  return value.endsWith("/") ? value : `${value}/`;
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}

function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || CORS_ORIGINS.includes(origin);
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("body_too_large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("invalid_json"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function text(value, max = 300) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

function normalizeEmail(value) {
  const email = text(value, 120).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function normalizePhone(value) {
  const raw = text(value, 60);
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return "";
  return `+${digits}`;
}

function resolveContact(body) {
  const rawContact = text(body.contact, 120);
  const looksLikeEmail = rawContact.includes("@");
  const phone = normalizePhone(body.phone || (!looksLikeEmail ? rawContact : ""));
  const email = normalizeEmail(body.email || (looksLikeEmail ? rawContact : ""));
  return { phone, email };
}

function requestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  const now = Date.now();
  const ip = requestIp(req);
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function validate(body) {
  const channel = ALLOWED_CHANNELS.has(text(body.channel, 20)) ? text(body.channel, 20) : "site";
  const name = text(body.name, 80);
  const consent = body.consent === true;
  const company = text(body.company, 200);
  const format = text(body.format, 40) || "request";
  const contactOptional = format === "open";
  const notify = body.notify !== false;
  const { phone, email } = resolveContact(body);

  if (company) {
    return { ok: true, spam: true };
  }
  if (name.length < 2) {
    return { ok: false, error: "Укажите имя — хотя бы две буквы." };
  }
  if (!consent) {
    return { ok: false, error: "Нужно согласие на обработку персональных данных." };
  }
  if (!phone && !email && !text(body.telegram_id, 40) && !text(body.max_id, 80) && !contactOptional) {
    return { ok: false, error: "Нужен телефон, email, Telegram ID или MAX ID." };
  }

  const utm = {};
  for (const key of UTM_KEYS) {
    const value = body.utm && typeof body.utm === "object" ? text(body.utm[key], 200) : "";
    if (value) utm[key] = value;
  }

  return {
    ok: true,
    spam: false,
    notify,
    lead: {
      channel,
      source: text(body.source, 200) || channel,
      page: text(body.page, 200),
      name,
      format,
      contactOptional,
      phone,
      email,
      contact: text(body.contact, 120),
      telegramId: text(body.telegram_id, 40),
      telegramUsername: text(body.telegram_username, 80),
      maxId: text(body.max_id, 80),
      message: text(body.message, 1000),
      consentVersion: text(body.consent_version, 40) || "2026-10-22",
      externalId: text(body.external_id, 100),
      utm
    }
  };
}

async function appendJsonLine(fileName, data) {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const file = join(DATA_DIR, fileName);
  await appendFile(file, `${JSON.stringify(data)}\n`, { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {});
}

function description(lead) {
  const utm = Object.keys(lead.utm).length
    ? Object.entries(lead.utm).map(([key, value]) => `${key}: ${value}`).join(", ")
    : "—";
  return [
    `Канал: ${lead.channel}`,
    `Источник: ${lead.source}`,
    `Формат: ${lead.format || "request"}`,
    `Контакт: ${lead.phone || lead.email || lead.telegramId || lead.maxId || "не оставлен"}`,
    lead.page ? `Страница: ${lead.page}` : "",
    `UTM: ${utm}`,
    lead.telegramId ? `Telegram ID: ${lead.telegramId}` : "",
    lead.telegramUsername ? `Telegram: @${lead.telegramUsername}` : "",
    lead.maxId ? `MAX ID: ${lead.maxId}` : "",
    lead.externalId ? `external_id: ${lead.externalId}` : "",
    lead.message ? `Сообщение: ${lead.message}` : "",
    `Согласие: ${lead.consentVersion}`
  ]
    .filter(Boolean)
    .join("\n");
}

async function createBitrixLead(lead, id) {
  if (!BITRIX24_WEBHOOK_URL) {
    throw new Error("BITRIX24_WEBHOOK_URL is not configured");
  }
  const fields = {
    TITLE: `ЮБ800 — ${lead.name}`,
    NAME: lead.name,
    SOURCE_ID: lead.channel === "site" ? "WEB" : "OTHER",
    SOURCE_DESCRIPTION: `${lead.channel}: ${lead.source} · ${lead.format || "request"}`,
    COMMENTS: description(lead),
    ...(lead.phone ? { PHONE: [{ VALUE: lead.phone, VALUE_TYPE: "WORK" }] } : {}),
    ...(lead.email ? { EMAIL: [{ VALUE: lead.email, VALUE_TYPE: "WORK" }] } : {})
  };
  const response = await fetch(`${BITRIX24_WEBHOOK_URL}crm.lead.add.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(`Bitrix24 error: ${data.error_description || response.status}`);
  }
  return { providerId: data.result || id };
}

async function createEspoLead(lead, id) {
  if (!ESPO_BASE_URL || !ESPO_API_KEY) {
    throw new Error("ESPO_BASE_URL / ESPO_API_KEY are not configured");
  }
  const payload = {
    name: lead.name,
    firstName: lead.name,
    phoneNumber: lead.phone || null,
    emailAddress: lead.email || null,
    source: lead.channel,
    status: "New",
    description: description(lead)
  };
  const response = await fetch(`${ESPO_BASE_URL}api/v1/Lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": ESPO_API_KEY
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw new Error(`EspoCRM error: ${response.status}`);
  }
  return { providerId: data.id };
}

async function createLead(lead, id) {
  if (CRM_PROVIDER === "mock") {
    await appendJsonLine("leads.ndjson", {
      id,
      createdAt: new Date().toISOString(),
      ...lead
    });
    return { providerId: id };
  }
  if (CRM_PROVIDER === "bitrix24") {
    return createBitrixLead(lead, id);
  }
  if (CRM_PROVIDER === "espocrm") {
    return createEspoLead(lead, id);
  }
  throw new Error(`Unknown CRM_PROVIDER: ${CRM_PROVIDER}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function notifyTelegram(lead, id, providerId) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const contact = [lead.phone, lead.email].filter(Boolean).join(" · ") || lead.telegramId || lead.maxId || "не оставлен";
  const lines = [
    "<b>Новая заявка ЮБ800</b>",
    `Канал: ${escapeHtml(lead.channel)}`,
    `Имя: ${escapeHtml(lead.name)}`,
    `Контакт: ${escapeHtml(contact)}`,
    `Источник: ${escapeHtml(lead.source)}`,
    `ID: ${escapeHtml(id)} / CRM: ${escapeHtml(providerId)}`
  ];
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    console.error(`Telegram notification failed for lead ${id}`);
  }
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    if (!originAllowed(req)) {
      json(res, 403, { ok: false, error: "Origin not allowed." });
      return;
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health" && req.method === "GET") {
    json(res, 200, {
      ok: true,
      provider: CRM_PROVIDER,
      configured: CRM_PROVIDER === "mock"
        ? true
        : CRM_PROVIDER === "bitrix24"
          ? Boolean(BITRIX24_WEBHOOK_URL)
          : CRM_PROVIDER === "espocrm"
            ? Boolean(ESPO_BASE_URL && ESPO_API_KEY)
            : false
    });
    return;
  }

  if (url.pathname !== "/api/leads" || req.method !== "POST") {
    json(res, 404, { ok: false, error: "Not found." });
    return;
  }

  if (!originAllowed(req)) {
    json(res, 403, { ok: false, error: "Origin not allowed." });
    return;
  }

  if (!checkRateLimit(req)) {
    json(res, 429, { ok: false, error: "Слишком много заявок. Попробуйте позже." });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    const status = error.statusCode || 400;
    json(res, status, {
      ok: false,
      error: status === 413 ? "Слишком большая заявка." : "Некорректный запрос."
    });
    return;
  }

  const validation = validate(body);
  if (!validation.ok) {
    json(res, 400, { ok: false, error: validation.error });
    return;
  }
  if (validation.spam) {
    json(res, 202, { ok: true });
    return;
  }

  const id = randomUUID();
  let result;
  try {
    result = await createLead(validation.lead, id);
  } catch (error) {
    console.error(`Lead ${id} failed: ${error.message}`);
    json(res, 502, { ok: false, error: "Не удалось сохранить заявку. Попробуйте позже." });
    return;
  }

  await appendJsonLine("consents.ndjson", {
    id,
    createdAt: new Date().toISOString(),
    channel: validation.lead.channel,
    source: validation.lead.source,
    consentVersion: validation.lead.consentVersion,
    provider: CRM_PROVIDER,
    providerId: result.providerId
  }).catch(() => {});

  if (validation.notify !== false) {
    await notifyTelegram(validation.lead, id, result.providerId);
  }

  console.log(`Lead ${id}: channel=${validation.lead.channel} source=${validation.lead.source} provider=${CRM_PROVIDER}`);
  json(res, 201, { ok: true, id, provider: CRM_PROVIDER, providerId: result.providerId });
});

server.listen(PORT, HOST, () => {
  console.log(`YB800 lead intake: http://localhost:${PORT} (provider: ${CRM_PROVIDER})`);
  if (CRM_PROVIDER === "mock") {
    console.log("Mock mode writes to ./data/leads.ndjson — do not use in production.");
  }
});
