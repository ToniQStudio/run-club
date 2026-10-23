import { randomBytes } from "node:crypto";

export const FORMATS = {
  open: {
    label: "Открытая тренировка",
    price: "Бесплатно",
    description: "21 ноября, Москва. 3–5 км, знакомство с тренерами и клубом.",
    contactOptional: true
  },
  trial: {
    label: "Пробная неделя",
    price: "2 500 ₽",
    description: "Две тренировки, знакомство с группой и рекомендации тренера.",
    contactOptional: false
  },
  club: {
    label: "Клуб",
    price: "12 000 ₽ / 4 недели",
    description: "8 групповых тренировок, чат клуба и тестирование.",
    contactOptional: false
  },
  premium: {
    label: "Премиум",
    price: "40 000 ₽ / 4 недели",
    description: "4 тренировки с Юрием за 4 недели, разбор, план и закрытый чат.",
    contactOptional: false
  },
  personal: {
    label: "Персональная тренировка",
    price: "5 000 ₽",
    description: "Работа над техникой, темпом и планом один на один с тренером.",
    contactOptional: false
  }
};

const PASS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createState() {
  return {
    step: "start",
    format: null,
    name: "",
    contact: "",
    consent: false,
    consentAt: null,
    source: "",
    passId: ""
  };
}

export function chooseFormat(state, format) {
  const info = FORMATS[format];
  if (!info) {
    return { error: "Неизвестный формат." };
  }
  return {
    state: {
      ...state,
      format,
      contactOptional: info.contactOptional,
      step: "name"
    }
  };
}

export function setName(state, rawName) {
  const name = String(rawName || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    return { error: "Напишите имя — хотя бы две буквы." };
  }
  if (name.length > 80) {
    return { error: "Имя слишком длинное. Сократите до 80 символов." };
  }
  const info = FORMATS[state.format];
  return {
    state: {
      ...state,
      name,
      step: info && info.contactOptional ? "consent" : "contact"
    }
  };
}

export function isPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && /^[+\d][\d\s\-()]*$/.test(String(value || ""));
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ""));
}

export function isTelegram(value) {
  const text = String(value || "").trim();
  return /^@[a-zA-Z0-9_]{4,}$/.test(text) || /^https?:\/\/t\.me\/[a-zA-Z0-9_]{4,}$/.test(text);
}

export function isContact(value) {
  return isPhone(value) || isEmail(value) || isTelegram(value);
}

export function setContact(state, rawContact) {
  const contact = String(rawContact || "").trim();
  if (contact.length < 5) {
    return { error: "Оставьте телефон, email или Telegram-username." };
  }
  if (contact.length > 120) {
    return { error: "Контакт слишком длинный." };
  }
  if (!isContact(contact)) {
    return { error: "Похоже на опечатку. Пример: +7 999 000-00-00, name@mail.ru или @username." };
  }
  return {
    state: {
      ...state,
      contact,
      step: "consent"
    }
  };
}

export function setConsent(state, value) {
  if (value !== true) {
    return { error: "Без согласия на обработку данных заявку принять нельзя." };
  }
  return {
    state: {
      ...state,
      consent: true,
      consentAt: new Date().toISOString(),
      step: "confirm"
    }
  };
}

export function resetState() {
  return createState();
}

export function formatLabel(format) {
  return FORMATS[format]?.label || "Не указан";
}

export function formatPrice(format) {
  return FORMATS[format]?.price || "";
}

export function formatDescription(format) {
  return FORMATS[format]?.description || "";
}

export function isContactOptional(format) {
  return Boolean(FORMATS[format]?.contactOptional);
}

export function createPassId() {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) {
    code += PASS_ALPHABET[byte % PASS_ALPHABET.length];
  }
  return `YB800-${code}`;
}

export function isReady(state) {
  const info = FORMATS[state.format];
  if (!info) {
    return false;
  }
  const contactOk = info.contactOptional || Boolean(state.contact);
  return Boolean(state.name && state.consent && contactOk && state.step === "confirm");
}

export function summary(state) {
  const lines = [
    `Формат: ${formatLabel(state.format)}`,
    `Имя: ${state.name}`,
    `Контакт: ${state.contact || "не оставлен"}`
  ];
  if (state.passId) {
    lines.push(`Пропуск: ${state.passId}`);
  }
  lines.push("Согласие на обработку данных: да");
  return lines.join("\n");
}
