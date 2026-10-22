export const PATHS = {
  beginner: {
    label: "Первый километр",
    intro: "Новичкам рады: 3–5 км в своём темпе, без гонки и давления."
  },
  performance: {
    label: "Личный рекорд",
    intro: "Система, техника, темп и план под вашу цель."
  },
  unsure: {
    label: "Пока не знаю",
    intro: "Ничего страшного. Начнём с формата, который проще всего попробовать."
  }
};

export const FORMATS = {
  open: {
    label: "Открытая пробежка",
    price: "Бесплатно",
    description: "21 ноября, Лужники. 3–5 км, знакомство с тренерами и клубом."
  },
  trial: {
    label: "Пробная неделя",
    price: "1 900 ₽",
    description: "Две тренировки, знакомство с группой и рекомендации тренера."
  },
  club: {
    label: "Клуб",
    price: "9 900 ₽/мес",
    description: "8 групповых тренировок, чат клуба, открытые пробежки и тестирование."
  },
  premium: {
    label: "Премиум",
    price: "17 500 ₽/мес",
    description: "Раз в месяц — пробежка и разбор с Юрием Борзаковским, закрытый чат."
  },
  personal: {
    label: "Персональная тренировка",
    price: "5 000 ₽",
    description: "Работа над техникой, темпом и планом один на один с тренером."
  }
};

export function createState() {
  return {
    step: "path",
    path: null,
    format: null,
    name: "",
    contact: "",
    consent: false,
    consentAt: null,
    source: ""
  };
}

export function choosePath(state, path) {
  if (!PATHS[path]) {
    return { error: "Неизвестный путь." };
  }
  return {
    state: {
      ...state,
      path,
      step: "format"
    }
  };
}

export function chooseFormat(state, format) {
  if (!FORMATS[format]) {
    return { error: "Неизвестный формат." };
  }
  return {
    state: {
      ...state,
      format,
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
  return {
    state: {
      ...state,
      name,
      step: "contact"
    }
  };
}

export function isPhone(value) {
  return /^[+\d][\d\s\-()]{5,}$/.test(value);
}

export function isTelegram(value) {
  return /^@[a-zA-Z0-9_]{4,}$/.test(value) || /^https?:\/\/t\.me\/[a-zA-Z0-9_]{4,}$/.test(value);
}

export function setContact(state, rawContact) {
  const contact = String(rawContact || "").trim();
  if (contact.length < 5) {
    return { error: "Оставьте телефон или Telegram-username." };
  }
  if (contact.length > 120) {
    return { error: "Контакт слишком длинный." };
  }
  if (!isPhone(contact) && !isTelegram(contact)) {
    return { error: "Похоже на опечатку. Пример: +7 999 000-00-00 или @username." };
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

export function pathLabel(path) {
  return PATHS[path]?.label || "Не указан";
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

export function isReady(state) {
  return Boolean(
    state.path &&
    state.format &&
    state.name &&
    state.contact &&
    state.consent &&
    state.step === "confirm"
  );
}

export function summary(state) {
  return [
    `Формат: ${formatLabel(state.format)}`,
    `Путь: ${pathLabel(state.path)}`,
    `Имя: ${state.name}`,
    `Контакт: ${state.contact}`,
    "Согласие на обработку данных: да"
  ].join("\n");
}
