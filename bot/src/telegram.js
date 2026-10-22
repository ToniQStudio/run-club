export function createTelegram(token, options = {}) {
  const dryRun = options.dryRun === true;
  const baseUrl = `https://api.telegram.org/bot${token}`;

  async function call(method, payload = {}, timeoutMs = 15000) {
    if (dryRun) {
      console.log(`[dry-run] ${method}`, payload);
      return { message_id: 1, chat: { id: payload.chat_id } };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram ${method}: ${data.description || response.status}`);
      }

      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getUpdates(offset) {
    return call(
      "getUpdates",
      {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"]
      },
      40000
    );
  }

  async function sendMessage(chatId, text, replyMarkup) {
    return call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });
  }

  async function editMessageText(chatId, messageId, text, replyMarkup) {
    return call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });
  }

  async function answerCallbackQuery(callbackQueryId, text) {
    return call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {})
    });
  }

  async function setMyCommands(commands) {
    return call("setMyCommands", { commands });
  }

  return {
    call,
    getUpdates,
    sendMessage,
    editMessageText,
    answerCallbackQuery,
    setMyCommands
  };
}
