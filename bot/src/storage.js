import { appendFile, chmod, mkdir } from "node:fs/promises";
import path from "node:path";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function saveLead(lead, dataDir) {
  const directory = dataDir || path.resolve(process.cwd(), "data");
  const file = path.join(directory, "leads.ndjson");

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  await appendFile(file, `${JSON.stringify(lead)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600).catch(() => {});

  return file;
}

export function leadToManagerMessage(lead) {
  const username = lead.telegramUsername ? `@${escapeHtml(lead.telegramUsername)}` : "не указан";
  const contact = lead.contact ? escapeHtml(lead.contact) : "не оставлен";

  return [
    "<b>Новая заявка в ЮБ800</b>",
    "",
    `<b>Формат:</b> ${escapeHtml(lead.formatLabel)}`,
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Контакт:</b> ${contact}`,
    `<b>Telegram:</b> ${username}`,
    lead.passId ? `<b>Пропуск:</b> <code>${escapeHtml(lead.passId)}</code>` : "",
    `<b>Согласие:</b> да, ${escapeHtml(lead.consentAt)}`,
    `<b>Источник:</b> ${escapeHtml(lead.source)}`,
    `<b>ID заявки:</b> <code>${escapeHtml(lead.id)}</code>`
  ]
    .filter(Boolean)
    .join("\n");
}
