import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createTelegram } from "./src/telegram.js";
import {
  chooseFormat,
  createState,
  formatLabel,
  isReady,
  setConsent,
  setName
} from "./src/scenario.js";
import { escapeHtml, leadToManagerMessage, saveLead } from "./src/storage.js";

const token = process.env.BOT_TOKEN;
const managerChatId = process.env.MANAGER_CHAT_ID || "";
const managerThreadId = process.env.MANAGER_THREAD_ID ? Number(process.env.MANAGER_THREAD_ID) : null;
const privacyUrl = process.env.PRIVACY_URL || "https://run800.ru/privacy.html";
const channelUrl = process.env.CHANNEL_URL || "https://t.me/yb800run";
const chatUrl = process.env.CHAT_URL || "https://t.me/yb800club";
const crmIntakeUrl = process.env.CRM_INTAKE_URL || "http://127.0.0.1:4174/api/leads";
const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");

if (!token) {
  console.error("BOT_TOKEN is required");
  process.exit(1);
}

if (!managerChatId) {
  console.warn("MANAGER_CHAT_ID is empty: leads will be saved but not sent to a manager");
}

const bot = createTelegram(token);
const sessions = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, createState());
  }
  return sessions.get(chatId);
}

function setSession(chatId, state) {
  sessions.set(chatId, state);
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🏃 ЗАПИСАТЬСЯ В СБОРНУЮ", callback_data: "entry:join" }],
      [{ text: "Ближайшая открытая тренировка", callback_data: "menu:event" }]
    ]
  };
}

function consentKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Согласен", callback_data: "consent:yes" }],
      [{ text: "Политика обработки данных", url: privacyUrl }]
    ]
  };
}

function chatKeyboard() {
  const rows = [];
  if (chatUrl) {
    rows.push([{ text: "Чат участников Сборной", url: chatUrl }]);
  }
  if (channelUrl) {
    rows.push([{ text: "Канал о беге", url: channelUrl }]);
  }
  rows.push([{ text: "На главную", callback_data: "back:start" }]);
  return { inline_keyboard: rows };
}

function successKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Ближайшая открытая тренировка", callback_data: "menu:event" }],
      [{ text: "Чат участников Сборной", url: chatUrl }],
      [{ text: "Канал о беге", url: channelUrl }]
    ]
  };
}

function eventKeyboard() {
  return {
    inline_keyboard: [[{ text: "🏃 ЗАПИСАТЬСЯ", callback_data: "entry:join" }]]
  };
}

function channelKeyboard() {
  return {
    inline_keyboard: [[{ text: "Открыть канал", url: channelUrl }]]
  };
}

async function send(chatId, text, replyMarkup) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await bot.sendMessage(chatId, text, replyMarkup);
    } catch (error) {
      lastError = error;
      console.error(`Send failed (attempt ${attempt}): ${error.message}`);
      if (attempt < 3) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}

async function update(chatId, messageId, text, replyMarkup) {
  if (!messageId) {
    return send(chatId, text, replyMarkup);
  }

  try {
    return await bot.editMessageText(chatId, messageId, text, replyMarkup);
  } catch {
    return send(chatId, text, replyMarkup);
  }
}

function welcomeText() {
  return [
    "<b>Сборная ЮБ800</b>",
    "Это бот записи.",
    "",
    "Можно сразу открыть чат команды или оставить заявку: имя и согласие.",
    "Менеджер напишет в Telegram."
  ].join("\n");
}

function welcomeCaption() {
  return [
    "<b>Добро пожаловать в Сборную ЮБ800</b>",
    "Оставьте заявку — или сразу откройте чат команды."
  ].join("\n");
}

async function sendWelcome(chatId) {
  try {
    const photo = await readFile(new URL("./assets/welcome.png", import.meta.url));
    return await bot.sendPhoto(chatId, photo, welcomeCaption(), startKeyboard());
  } catch (error) {
    console.error(`Welcome photo failed: ${error.message}`);
    return send(chatId, welcomeText(), startKeyboard());
  }
}

function helpText() {
  return [
    "<b>Что делает бот</b>",
    "Помогает оставить заявку в Сборную и открыть чат команды.",
    "",
    "/start — главный экран",
    "/join — записаться в Сборную",
    "/event — ближайшая открытая тренировка",
    "/help — эта справка",
    "",
    "Данные обрабатываются по политике:",
    privacyUrl
  ].join("\n");
}

function chatText() {
  return [
    "<b>Чат и канал</b>",
    "",
    "Чат команды:",
    chatUrl,
    "",
    "Канал о беге:",
    channelUrl
  ].join("\n");
}

function channelText() {
  return [
    "<b>Канал о беге</b>",
    "Тренировки, старты и новости клуба.",
    "",
    channelUrl
  ].join("\n");
}

function eventText() {
  return [
    "<b>Ближайшая открытая тренировка</b>",
    "21 ноября · Москва",
    "",
    "Бесплатно и без обязательств.",
    "Разминка, техника, мини-тест и разбор.",
    "Группа до 15 человек. Точку сбора объявим заранее."
  ].join("\n");
}

async function start(chatId, source = "") {
  const state = createState();
  state.source = source;
  setSession(chatId, state);
  await sendWelcome(chatId);
}

async function showStart(chatId, messageId) {
  const state = getSession(chatId);
  state.step = "start";
  state.format = null;
  setSession(chatId, state);
  await update(chatId, messageId, welcomeText(), startKeyboard());
}

async function showChat(chatId, messageId) {
  await update(chatId, messageId, chatText(), chatKeyboard());
}

async function showName(chatId, messageId) {
  const result = chooseFormat(getSession(chatId), "stage");

  if (result.error) {
    await send(chatId, result.error);
    return;
  }

  setSession(chatId, result.state);
  await update(chatId, messageId, "Как вас зовут?");
}

async function showConsent(chatId) {
  const state = getSession(chatId);
  await send(
    chatId,
    [
      `<b>${escapeHtml(formatLabel(state.format))}</b>`,
      `Имя: ${escapeHtml(state.name)}`,
      "",
      "Осталось согласие на обработку персональных данных.",
      "Нажмите «Согласен», чтобы отправить заявку."
    ].join("\n"),
    consentKeyboard()
  );
}

function buildLead(chatId, state, from) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    chatId,
    telegramUserId: from.id,
    telegramUsername: from.username || "",
    source: state.source || "telegram",
    format: "stage",
    formatLabel: formatLabel("stage"),
    name: state.name,
    contact: "",
    contactOptional: true,
    consent: state.consent,
    consentAt: state.consentAt
  };
}

async function sendToCrm(lead) {
  const payload = {
    channel: "telegram",
    name: lead.name,
    format: "stage",
    contact_optional: true,
    contact: "",
    telegram_id: String(lead.telegramUserId || ""),
    telegram_username: lead.telegramUsername || "",
    consent: true,
    consent_version: "2026-10-22",
    source: lead.source,
    page: "telegram",
    external_id: lead.id,
    notify: false
  };

  const response = await fetch(crmIntakeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `CRM ${response.status}`);
  }

  return data;
}

async function notifyManager(lead) {
  if (!managerChatId) {
    console.warn(`Lead ${lead.id} saved without manager notification`);
    return false;
  }

  const text = leadToManagerMessage(lead);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await bot.sendMessage(managerChatId, text, null, { messageThreadId: managerThreadId });
      return true;
    } catch (error) {
      console.error(`Manager notification failed (attempt ${attempt}): ${error.message}`);
      if (attempt < 2) {
        await sleep(1500);
      }
    }
  }

  return false;
}

async function persistLead(lead) {
  await saveLead(lead, dataDir);

  try {
    await sendToCrm(lead);
  } catch (error) {
    console.error(`CRM intake failed for lead ${lead.id}: ${error.message}`);
  }

  await notifyManager(lead);
}

async function submitStage(chatId, from) {
  const state = getSession(chatId);

  if (!isReady(state)) {
    await send(chatId, "Заявка заполнена не полностью. Начните заново: /start");
    return;
  }

  state.step = "sending";
  setSession(chatId, state);

  const lead = buildLead(chatId, state, from);

  try {
    await persistLead(lead);
  } catch (error) {
    console.error(`Lead save failed: ${error.message}`);
    state.step = "confirm";
    setSession(chatId, state);
    await send(chatId, "Не удалось сохранить заявку. Попробуйте ещё раз или напишите менеджеру.");
    return;
  }

  await send(
    chatId,
    [
      "<b>Заявка принята</b>",
      "",
      "Менеджер напишет вам в Telegram.",
      "Чат команды можно открыть ниже."
    ].join("\n"),
    successKeyboard()
  );

  sessions.delete(chatId);
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data || "";

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (!chatId) {
    return;
  }

  if (query.message?.chat?.type !== "private") {
    return;
  }

  if (data === "restart" || data === "back:start") {
    await start(chatId, getSession(chatId).source || "");
    return;
  }

  if (data === "entry:join") {
    await showName(chatId, messageId);
    return;
  }

  if (data === "menu:event") {
    await update(chatId, messageId, eventText(), eventKeyboard());
    return;
  }

  if (data === "entry:chat") {
    await showChat(chatId, messageId);
    return;
  }

  if (data === "consent:yes") {
    const result = setConsent(getSession(chatId), true);

    if (result.error) {
      await send(chatId, result.error);
      return;
    }

    setSession(chatId, result.state);
    await submitStage(chatId, query.from);
    return;
  }

  await send(chatId, "Не понял действие. Начните заново: /start");
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (!text) {
    return;
  }

  if (message.chat.type !== "private") {
    return;
  }

  if (text === "/help") {
    await send(chatId, helpText());
    return;
  }

  if (text === "/join") {
    setSession(chatId, createState());
    await showName(chatId, null);
    return;
  }

  if (text === "/event") {
    await send(chatId, eventText(), eventKeyboard());
    return;
  }

  if (text === "/channel") {
    await send(chatId, channelText(), channelKeyboard());
    return;
  }

  if (text === "/chat") {
    await showChat(chatId);
    return;
  }

  if (text === "/cancel") {
    sessions.delete(chatId);
    await send(chatId, "Начать заново: /start");
    return;
  }

  const startMatch = text.match(/^\/start(?:\s+(.+))?$/);

  if (startMatch) {
    await start(chatId, (startMatch[1] || "").trim());
    return;
  }

  const state = getSession(chatId);

  if (state.step === "name") {
    const result = setName(state, text);

    if (result.error) {
      await send(chatId, result.error);
      return;
    }

    setSession(chatId, result.state);
    await showConsent(chatId);
    return;
  }

  if (state.step === "consent") {
    await showConsent(chatId);
    return;
  }

  if (state.step === "confirm") {
    await send(chatId, "Нажмите «Согласен» ещё раз, чтобы отправить заявку.");
    return;
  }

  await send(chatId, "Начнём сначала.", startKeyboard());
  setSession(chatId, createState());
}

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

async function poll() {
  let offset = 0;

  for (;;) {
    try {
      const updates = await bot.getUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        try {
          await handleUpdate(update);
        } catch (error) {
          console.error(`Update handling failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Polling failed: ${error.message}`);
      await sleep(3000);
    }
  }
}

async function main() {
  const privateCommands = [
    { command: "join", description: "Записаться в Сборную" },
    { command: "event", description: "Ближайшая открытая тренировка" },
    { command: "chat", description: "Чат участников Сборной" },
    { command: "channel", description: "Канал о беге" }
  ];

  await bot
    .setMyCommands(privateCommands, { scope: { type: "default" } })
    .catch((error) => console.warn(`setMyCommands (default) failed: ${error.message}`));

  await bot
    .setMyCommands(privateCommands, { scope: { type: "all_private_chats" } })
    .catch((error) => console.warn(`setMyCommands (private) failed: ${error.message}`));

  console.log("run800 bot started");
  await poll();
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
