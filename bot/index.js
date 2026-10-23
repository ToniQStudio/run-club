import { randomUUID } from "node:crypto";
import path from "node:path";
import { createTelegram } from "./src/telegram.js";
import {
  FORMATS,
  PATHS,
  chooseFormat,
  choosePath,
  createState,
  formatDescription,
  formatLabel,
  formatPrice,
  isReady,
  pathLabel,
  resetState,
  setConsent,
  setContact,
  setName,
  summary
} from "./src/scenario.js";
import { escapeHtml, leadToManagerMessage, saveLead } from "./src/storage.js";

const token = process.env.BOT_TOKEN;
const managerChatId = process.env.MANAGER_CHAT_ID || "";
const privacyUrl = process.env.PRIVACY_URL || "https://toniqstudio.github.io/run-club/privacy.html";
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

function pathKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Первый километр", callback_data: "path:beginner" }],
      [{ text: "Личный рекорд", callback_data: "path:performance" }],
      [{ text: "Пока не знаю", callback_data: "path:unsure" }]
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
  rows.push([{ text: "Назад", callback_data: "back:path" }]);
  rows.push([{ text: "Отмена", callback_data: "cancel" }]);
  return { inline_keyboard: rows };
}

function cancelKeyboard() {
  return {
    inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]]
  };
}

function consentKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Согласен", callback_data: "consent:yes" }],
      [{ text: "Политика обработки данных", url: privacyUrl }],
      [{ text: "Отмена", callback_data: "cancel" }]
    ]
  };
}

function confirmKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Отправить заявку", callback_data: "confirm:send" }],
      [{ text: "Начать заново", callback_data: "restart" }],
      [{ text: "Отмена", callback_data: "cancel" }]
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
    "Помогу выбрать вход в клуб.",
    "",
    "С чего вы начинаете?"
  ].join("\n");
}

function helpText() {
  return [
    "<b>Что делает бот</b>",
    "Помогает выбрать путь и формат, собирает заявку и передаёт её менеджеру клуба.",
    "",
    "/start — начать",
    "/cancel — отменить текущую заявку",
    "/id — показать chat_id для настройки",
    "",
    "Данные обрабатываются по политике клуба."
  ].join("\n");
}

async function start(chatId, source = "") {
  const state = createState();
  state.source = source;
  setSession(chatId, state);
  await send(chatId, welcomeText(), pathKeyboard());
}

async function showPath(chatId, messageId) {
  const state = getSession(chatId);
  state.step = "path";
  state.path = null;
  state.format = null;
  setSession(chatId, state);
  await update(chatId, messageId, welcomeText(), pathKeyboard());
}

async function showFormats(chatId, messageId, pathKey) {
  const result = choosePath(getSession(chatId), pathKey);

  if (result.error) {
    await send(chatId, result.error);
    return;
  }

  setSession(chatId, result.state);
  const intro = PATHS[pathKey].intro;
  await update(
    chatId,
    messageId,
    `${escapeHtml(intro)}\n\nВыберите формат:`,
    formatKeyboard()
  );
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

  await update(chatId, messageId, text, cancelKeyboard());
}

async function showContact(chatId) {
  const state = getSession(chatId);
  await send(
    chatId,
    `Приятно познакомиться, ${escapeHtml(state.name)}.\n\nОставьте телефон или Telegram-username — менеджер свяжется с вами.`,
    cancelKeyboard()
  );
}

async function showConsent(chatId) {
  const state = getSession(chatId);
  await send(
    chatId,
    [
      `Контакт: ${escapeHtml(state.contact)}`,
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

async function notifyManager(lead) {
  if (!managerChatId) {
    console.warn(`Lead ${lead.id} saved without manager notification`);
    return false;
  }

  const text = leadToManagerMessage(lead);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await bot.sendMessage(managerChatId, text);
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

async function submit(chatId, from) {
  const state = getSession(chatId);

  if (!isReady(state)) {
    await send(chatId, "Заявка заполнена не полностью. Начните заново: /start");
    return;
  }

  const lead = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    chatId,
    telegramUserId: from.id,
    telegramUsername: from.username || "",
    source: state.source || "telegram",
    path: state.path,
    pathLabel: pathLabel(state.path),
    format: state.format,
    formatLabel: formatLabel(state.format),
    name: state.name,
    contact: state.contact,
    consent: state.consent,
    consentAt: state.consentAt
  };

  state.step = "sending";
  setSession(chatId, state);

  try {
    await saveLead(lead, dataDir);
    await notifyManager(lead);
    console.log(`Lead accepted: ${lead.id}`);

    sessions.delete(chatId);
    await send(
      chatId,
      [
        "<b>Заявка принята</b>",
        "",
        "Мы свяжемся с вами в Telegram или по указанному контакту.",
        "Если хотите что-то добавить — ответьте здесь.",
        "",
        "Вернуться на сайт: https://run800.ru/"
      ].join("\n")
    );
  } catch (error) {
    console.error(`Lead save failed: ${error.message}`);
    state.step = "confirm";
    setSession(chatId, state);
    await send(
      chatId,
      "Не удалось сохранить заявку. Попробуйте ещё раз или напишите менеджеру."
    );
  }
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
    await send(chatId, "Напишите боту в личные сообщения.");
    return;
  }

  if (data === "cancel") {
    sessions.delete(chatId);
    await update(chatId, messageId, "Отменено. Начать заново: /start");
    return;
  }

  if (data === "restart") {
    await start(chatId, getSession(chatId).source);
    return;
  }

  if (data === "back:path") {
    await showPath(chatId, messageId);
    return;
  }

  if (data.startsWith("path:")) {
    await showFormats(chatId, messageId, data.slice(5));
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
    await showConfirm(chatId);
    return;
  }

  if (data === "confirm:send") {
    await submit(chatId, query.from);
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

  if (text === "/help") {
    await send(chatId, helpText());
    return;
  }

  if (message.chat.type !== "private") {
    await send(chatId, "Напишите боту в личные сообщения.");
    return;
  }

  const startMatch = text.match(/^\/start(?:\s+(.+))?$/);

  if (startMatch) {
    await start(chatId, (startMatch[1] || "").trim());
    return;
  }

  if (text === "/cancel") {
    sessions.delete(chatId);
    await send(chatId, "Отменено. Начать заново: /start");
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
    await showContact(chatId);
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
    await send(chatId, "Нажмите «Согласен» в сообщении выше или /cancel.");
    return;
  }

  if (state.step === "confirm") {
    await send(chatId, "Проверьте заявку и нажмите «Отправить заявку».");
    return;
  }

  await send(chatId, "Начнём сначала.", pathKeyboard());
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
  await bot
    .setMyCommands([
      { command: "start", description: "Начать" },
      { command: "cancel", description: "Отменить заявку" },
      { command: "help", description: "Как работает бот" },
      { command: "id", description: "Показать chat_id" }
    ])
    .catch((error) => console.warn(`setMyCommands failed: ${error.message}`));

  console.log("run800 bot started");
  await poll();
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
