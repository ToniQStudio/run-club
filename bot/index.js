import { randomUUID } from "node:crypto";
import path from "node:path";
import { createTelegram } from "./src/telegram.js";
import {
  FORMATS,
  chooseFormat,
  createPassId,
  createState,
  formatDescription,
  formatLabel,
  formatPrice,
  isContactOptional,
  isReady,
  setConsent,
  setContact,
  setName,
  summary
} from "./src/scenario.js";
import { escapeHtml, leadToManagerMessage, saveLead } from "./src/storage.js";

const token = process.env.BOT_TOKEN;
const managerChatId = process.env.MANAGER_CHAT_ID || "";
const managerThreadId = process.env.MANAGER_THREAD_ID ? Number(process.env.MANAGER_THREAD_ID) : null;
const staffChatId = process.env.STAFF_CHAT_ID || managerChatId;
const privacyUrl = process.env.PRIVACY_URL || "https://run800.ru/privacy.html";
const channelUrl = process.env.CHANNEL_URL || "https://t.me/yb800run";
const chatUrl = process.env.CHAT_URL || "https://t.me/yb800club";
const crmIntakeUrl = process.env.CRM_INTAKE_URL || "http://127.0.0.1:4174/api/leads";
const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");

let qrcode = null;
try {
  const module = await import("qrcode");
  qrcode = module.default || module;
} catch {
  console.warn("qrcode не установлен: пропуск будет без QR-картинки");
}

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
      [{ text: "Записаться на открытую тренировку", callback_data: "entry:open" }],
      [{ text: "Форматы и цены", callback_data: "entry:formats" }],
      [{ text: "Чат и знания", callback_data: "entry:chat" }]
    ]
  };
}

function formatKeyboard() {
  const rows = Object.entries(FORMATS).map(([key, format]) => [
    {
      text: `${format.label} · ${format.price}`,
      callback_data: `format:${key}`
    }
  ]);
  rows.push([{ text: "Назад", callback_data: "back:start" }]);
  return { inline_keyboard: rows };
}

function startOverKeyboard() {
  return {
    inline_keyboard: [[{ text: "Начать заново", callback_data: "restart" }]]
  };
}

function consentKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Согласен", callback_data: "consent:yes" }],
      [{ text: "Политика обработки данных", url: privacyUrl }],
      [{ text: "Начать заново", callback_data: "restart" }]
    ]
  };
}

function confirmKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Отправить заявку", callback_data: "confirm:send" }],
      [{ text: "Начать заново", callback_data: "restart" }]
    ]
  };
}

function chatKeyboard() {
  const rows = [];
  if (channelUrl) {
    rows.push([{ text: "Канал о беге", url: channelUrl }]);
  }
  if (chatUrl) {
    rows.push([{ text: "Чат клуба", url: chatUrl }]);
  }
  rows.push([{ text: "Назад", callback_data: "back:start" }]);
  return { inline_keyboard: rows };
}

function successKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Чат и знания", callback_data: "entry:chat" }],
      [{ text: "На главную", callback_data: "back:start" }]
    ]
  };
}

async function send(chatId, text, replyMarkup) {
  return bot.sendMessage(chatId, text, replyMarkup);
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
    "<b>ЮБ800</b> — беговой клуб Юрия Борзаковского.",
    "Малая группа, система олимпийского чемпиона, Москва.",
    "Открытая тренировка — 21 ноября, бесплатно.",
    "",
    "С чего начнём?"
  ].join("\n");
}

function helpText() {
  return [
    "<b>Что делает бот</b>",
    "Помогает записаться на открытую тренировку или оставить заявку в клуб.",
    "",
    "/start — главное меню",
    "/chat — чат и канал",
    "/help — эта справка",
    "",
    "Данные обрабатываются по политике клуба."
  ].join("\n");
}

function chatText() {
  return [
    "<b>Чат и знания</b>",
    "",
    "Канал о беге — тренировки, питание, медицина:",
    channelUrl,
    "",
    "Чат клуба — вопросы и общение:",
    chatUrl
  ].join("\n");
}

function formatsText() {
  return [
    "<b>Форматы</b>",
    "Можно начать с бесплатной открытой тренировки или выбрать клубный формат.",
    "",
    "Выберите, что вам ближе:"
  ].join("\n");
}

async function start(chatId, source = "") {
  const state = createState();
  state.source = source;
  setSession(chatId, state);
  await send(chatId, welcomeText(), startKeyboard());
}

async function showStart(chatId, messageId) {
  const state = getSession(chatId);
  state.step = "start";
  state.format = null;
  setSession(chatId, state);
  await update(chatId, messageId, welcomeText(), startKeyboard());
}

async function showFormats(chatId, messageId) {
  const state = getSession(chatId);
  state.step = "start";
  setSession(chatId, state);
  await update(chatId, messageId, formatsText(), formatKeyboard());
}

async function showChat(chatId, messageId) {
  await update(chatId, messageId, chatText(), chatKeyboard());
}

async function showName(chatId, messageId, formatKey) {
  const result = chooseFormat(getSession(chatId), formatKey);

  if (result.error) {
    await send(chatId, result.error);
    return;
  }

  setSession(chatId, result.state);
  const text = [
    `<b>${escapeHtml(formatLabel(formatKey))}</b> · ${escapeHtml(formatPrice(formatKey))}`,
    escapeHtml(formatDescription(formatKey)),
    "",
    "Как вас зовут?"
  ].join("\n");

  await update(chatId, messageId, text, startOverKeyboard());
}

async function showContact(chatId) {
  const state = getSession(chatId);
  await send(
    chatId,
    `Приятно познакомиться, ${escapeHtml(state.name)}.\n\nОставьте телефон, email или @username — менеджер свяжется и поможет с оплатой.`,
    startOverKeyboard()
  );
}

async function showConsent(chatId) {
  const state = getSession(chatId);
  const contactLine = isContactOptional(state.format)
    ? "Контакт не нужен: после согласия пришлём QR-пропуск в этот чат."
    : `Контакт: ${escapeHtml(state.contact)}`;

  await send(
    chatId,
    [
      `<b>${escapeHtml(formatLabel(state.format))}</b> · ${escapeHtml(formatPrice(state.format))}`,
      escapeHtml(formatDescription(state.format)),
      "",
      contactLine,
      "",
      "Осталось согласие на обработку персональных данных.",
      "Нажмите «Согласен», чтобы продолжить."
    ].join("\n"),
    consentKeyboard()
  );
}

async function showConfirm(chatId) {
  const state = getSession(chatId);

  if (!isReady(state)) {
    await send(chatId, "Заявка заполнена не полностью. Начните заново: /start");
    return;
  }

  await send(
    chatId,
    `<b>Проверьте заявку</b>\n\n${escapeHtml(summary(state))}\n\nВсё верно?`,
    confirmKeyboard()
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
    format: state.format,
    formatLabel: formatLabel(state.format),
    name: state.name,
    contact: state.contact,
    contactOptional: isContactOptional(state.format),
    passId: state.passId || "",
    consent: state.consent,
    consentAt: state.consentAt
  };
}

async function sendToCrm(lead) {
  const payload = {
    channel: "telegram",
    name: lead.name,
    format: lead.format,
    contact_optional: lead.contactOptional,
    contact: lead.contact,
    telegram_id: String(lead.telegramUserId || ""),
    telegram_username: lead.telegramUsername || "",
    consent: true,
    consent_version: "2026-10-22",
    source: lead.source,
    page: "telegram",
    external_id: lead.passId || "",
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

async function issueOpenPass(chatId, from) {
  const state = getSession(chatId);

  if (!isReady(state)) {
    await send(chatId, "Заявка заполнена не полностью. Начните заново: /start");
    return;
  }

  state.passId = createPassId();
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

  const caption = [
    "<b>Вы записаны на открытую тренировку 21 ноября</b>",
    "",
    `Пропуск: <code>${escapeHtml(state.passId)}</code>`,
    "Покажите QR на входе."
  ].join("\n");

  try {
    if (qrcode) {
      const photo = await qrcode.toBuffer(state.passId, {
        type: "png",
        width: 512,
        margin: 2,
        color: { dark: "#030712", light: "#ffffff" }
      });
      await bot.sendPhoto(chatId, photo, caption, successKeyboard());
    } else {
      await send(chatId, caption, successKeyboard());
    }
  } catch (error) {
    console.error(`QR pass failed: ${error.message}`);
    await send(chatId, caption, successKeyboard());
  }

  sessions.delete(chatId);
}

async function submitPaid(chatId, from) {
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
      "<b>Заявка отправлена</b>",
      "",
      "Менеджер свяжется с вами, расскажет детали и поможет с оплатой.",
      "Чат и канал клуба — ниже."
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

  if (data === "entry:open") {
    await showName(chatId, messageId, "open");
    return;
  }

  if (data === "entry:formats") {
    await showFormats(chatId, messageId);
    return;
  }

  if (data === "entry:chat") {
    await showChat(chatId, messageId);
    return;
  }

  if (data.startsWith("format:")) {
    await showName(chatId, messageId, data.slice(7));
    return;
  }

  if (data === "consent:yes") {
    const result = setConsent(getSession(chatId), true);

    if (result.error) {
      await send(chatId, result.error);
      return;
    }

    setSession(chatId, result.state);

    if (isContactOptional(result.state.format)) {
      await issueOpenPass(chatId, query.from);
    } else {
      await showConfirm(chatId);
    }
    return;
  }

  if (data === "confirm:send") {
    await submitPaid(chatId, query.from);
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

  if (text === "/id") {
    await send(
      chatId,
      `chat_id: <code>${chatId}</code>\nuser_id: <code>${message.from.id}</code>`
    );
    return;
  }

  if (message.chat.type !== "private") {
    return;
  }

  if (text === "/help") {
    await send(chatId, helpText());
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

    if (isContactOptional(result.state.format)) {
      await showConsent(chatId);
    } else {
      await showContact(chatId);
    }
    return;
  }

  if (state.step === "contact") {
    const result = setContact(state, text);

    if (result.error) {
      await send(chatId, result.error);
      return;
    }

    setSession(chatId, result.state);
    await showConsent(chatId);
    return;
  }

  if (state.step === "consent") {
    await send(chatId, "Нажмите «Согласен» в сообщении выше или начните заново: /start");
    return;
  }

  if (state.step === "confirm") {
    await send(chatId, "Проверьте заявку и нажмите «Отправить заявку».");
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
    { command: "start", description: "Главное меню" },
    { command: "chat", description: "Чат и канал" },
    { command: "help", description: "Как работает бот" }
  ];

  await bot
    .setMyCommands(privateCommands, { scope: { type: "all_private_chats" } })
    .catch((error) => console.warn(`setMyCommands failed: ${error.message}`));

  if (staffChatId) {
    await bot
      .setMyCommands(
        [{ command: "id", description: "Показать chat_id" }],
        { scope: { type: "chat", chat_id: Number(staffChatId) } }
      )
      .catch((error) => console.warn(`setMyCommands (staff) failed: ${error.message}`));
  }

  console.log("run800 bot started");
  await poll();
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
