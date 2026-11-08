#!/usr/bin/env node
/**
 * Суточный снимок Telegram-статистики ЮБ800.
 *
 * Считает участников канала и чата через Bot API, дописывает снимок в
 * data/telegram-stats.ndjson и отправляет сводку в staff-группу.
 *
 * Запуск: node stats.mjs [--silent]
 * Тема для сводки — STATS_THREAD_ID, иначе сообщение уходит в общий чат.
 */

import { appendFile, chmod, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.BOT_TOKEN || "";
const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
const staffChatId = process.env.STAFF_CHAT_ID || process.env.MANAGER_CHAT_ID || "";
const threadId = process.env.STATS_THREAD_ID ? Number(process.env.STATS_THREAD_ID) : null;
const channelUrl = process.env.CHANNEL_URL || "https://t.me/yb800run";
const chatUrl = process.env.CHAT_URL || "https://t.me/yb800club";
const silent = process.argv.includes("--silent");

const statsFile = path.join(dataDir, "telegram-stats.ndjson");

function usernameFromUrl(url) {
  const match = String(url).match(/t\.me\/([A-Za-z0-9_]+)/);
  return match ? `@${match[1]}` : "";
}

async function call(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method}: ${data.description || response.status}`);
  }
  return data.result;
}

async function memberCount(username) {
  if (!username) return null;
  try {
    return await call("getChatMemberCount", { chat_id: username });
  } catch (error) {
    console.error(`Не удалось получить участников ${username}: ${error.message}`);
    return null;
  }
}

function todayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function readHistory() {
  try {
    const raw = await readFile(statsFile, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function previous(history, daysAgo) {
  if (!history.length) return null;
  const target = new Date(Date.now() - daysAgo * 86400000);
  const key = todayKey(target);
  const exact = history.find((entry) => entry.date === key);
  if (exact) return exact;
  const last = history[history.length - 1];
  if (last && last.date !== todayKey(new Date())) return last;
  return null;
}

function formatDelta(value) {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

async function main() {
  if (!token) {
    console.error("Нет BOT_TOKEN — статистика не собрана.");
    process.exit(1);
  }

  const now = new Date();
  const date = todayKey(now);
  const channelName = usernameFromUrl(channelUrl);
  const chatName = usernameFromUrl(chatUrl);

  const [channelMembers, chatMembers] = await Promise.all([
    memberCount(channelName),
    memberCount(chatName)
  ]);

  const history = await readHistory();
  const yesterday = previous(history, 1);
  const weekAgo = previous(history, 7);

  const entry = {
    at: now.toISOString(),
    date,
    channel: { name: channelName, members: channelMembers },
    chat: { name: chatName, members: chatMembers }
  };

  const sameDay = history.find((item) => item.date === date);
  if (!sameDay) {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await appendFile(statsFile, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(statsFile, 0o600).catch(() => {});
  }

  const dayDelta = (current, prev) =>
    current === null || !prev ? null : current - prev;

  const channelDay = dayDelta(channelMembers, yesterday?.channel?.members);
  const chatDay = dayDelta(chatMembers, yesterday?.chat?.members);
  const channelWeek = dayDelta(channelMembers, weekAgo?.channel?.members);
  const chatWeek = dayDelta(chatMembers, weekAgo?.chat?.members);

  const lines = [
    "<b>Статистика Telegram</b>",
    `Канал ${channelName || "—"}: <b>${channelMembers ?? "—"}</b> (сутки ${formatDelta(channelDay)}, 7 дней ${formatDelta(channelWeek)})`,
    `Чат ${chatName || "—"}: <b>${chatMembers ?? "—"}</b> (сутки ${formatDelta(chatDay)}, 7 дней ${formatDelta(chatWeek)})`
  ];

  if (typeof channelMembers === "number" && channelMembers < 500) {
    lines.push(`До встроенной статистики канала: ${500 - channelMembers} подписчиков.`);
  }

  const text = lines.join("\n");

  if (!silent && staffChatId) {
    const payload = { chat_id: staffChatId, text, parse_mode: "HTML", disable_web_page_preview: true };
    if (threadId) payload.message_thread_id = threadId;
    await call("sendMessage", payload);
  }

  console.log(text.replace(/<[^>]+>/g, ""));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
