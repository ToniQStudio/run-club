const MAX_NAME = 80;
const MAX_CONTACT = 120;

function isPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && /^[+\d][\d\s\-()]*$/.test(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeBody(req) {
  if (!req.body) {
    return null;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

function validateLead(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Некорректная заявка." };
  }

  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  const consent = body.consent === true;
  const honeypot = String(body.company || "").trim();

  if (honeypot) {
    return { ok: false, error: "Некорректная заявка." };
  }
  if (name.length < 2 || name.length > MAX_NAME) {
    return { ok: false, error: "Проверьте имя." };
  }
  if (contact.length < 5 || contact.length > MAX_CONTACT || (!isPhone(contact) && !isEmail(contact))) {
    return { ok: false, error: "Проверьте телефон или почту." };
  }
  if (!consent) {
    return { ok: false, error: "Нужно согласие на обработку данных." };
  }

  return { ok: true, lead: { name, contact, source: String(body.source || "").slice(0, 200) } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Метод не поддерживается." });
    return;
  }

  const body = normalizeBody(req);
  const result = validateLead(body);

  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error });
    return;
  }

  if (process.env.MOCK_TELEGRAM === "1") {
    res.status(200).json({ ok: true });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.MANAGER_CHAT_ID;

  if (!token || !chatId) {
    res.status(500).json({ ok: false, error: "Приём заявок не настроен." });
    return;
  }

  const { name, contact, source } = result.lead;
  const text = [
    "<b>Заявка с сайта ЮБ800</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Телефон или почта:</b> ${escapeHtml(contact)}`,
    source ? `<b>Источник:</b> ${escapeHtml(source)}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      res.status(502).json({ ok: false, error: "Не удалось отправить заявку." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ ok: false, error: "Не удалось отправить заявку." });
  }
}
