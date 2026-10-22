import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = 4400 + Math.floor(Math.random() * 200);
const dataDir = await mkdtemp(join(tmpdir(), "yb800-crm-test-"));
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    CRM_PROVIDER: "mock",
    DATA_DIR: dataDir,
    CORS_ORIGINS: "http://localhost:4173"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // server is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${output}`);
}

async function postLead(body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return { status: response.status, data };
}

try {
  await waitForHealth();

  const valid = await postLead({
    channel: "site",
    name: "Тест Тестов",
    contact: "test@example.com",
    consent: true,
    consent_version: "2026-10-22",
    source: "test",
    page: "/",
    utm: { utm_source: "test" }
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.data.ok, true);
  assert.equal(valid.data.provider, "mock");

  const leads = (await readFile(join(dataDir, "leads.ndjson"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, "Тест Тестов");
  assert.equal(leads[0].email, "test@example.com");
  assert.equal(leads[0].consentVersion, "2026-10-22");

  const noConsent = await postLead({ channel: "site", name: "Без согласия", contact: "+79990000000" });
  assert.equal(noConsent.status, 400);

  const honeypot = await postLead({
    channel: "site",
    name: "Спам",
    contact: "spam@example.com",
    consent: true,
    company: "bot"
  });
  assert.equal(honeypot.status, 202);

  console.log("CRM intake test: OK");
} finally {
  child.kill("SIGTERM");
  await rm(dataDir, { recursive: true, force: true });
}
