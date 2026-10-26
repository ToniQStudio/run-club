(function () {
  "use strict";

  var form = document.getElementById("join-form");
  var success = document.getElementById("join-success");
  var successTitle = document.getElementById("join-success-title");
  var successText = document.getElementById("join-success-text");
  var title = document.getElementById("join-title");
  var lead = document.getElementById("join-lead");
  var nameInput = document.getElementById("join-name");
  var contactInput = document.getElementById("join-contact");
  var contactLabel = document.getElementById("join-contact-label");
  var consentInput = document.getElementById("join-consent");
  var companyInput = document.getElementById("join-company");
  var submitButton = document.getElementById("join-submit");
  var status = document.getElementById("join-status");
  var nameError = document.getElementById("join-name-error");
  var contactError = document.getElementById("join-contact-error");
  var consentError = document.getElementById("join-consent-error");
  var formatInputs = form ? form.querySelectorAll('input[name="format"]') : [];

  if (!form || !success || !nameInput || !contactInput || !consentInput || !submitButton) {
    return;
  }

  var FORMATS = {
    open: {
      title: "Открытая тренировка 21 ноября",
      lead: "Оставьте имя. Телефон или почту можно не указывать — если оставите, напомним время и точку сбора.",
      contactLabel: "Телефон или почта — по желанию",
      contactOptional: true,
      submit: "Записаться",
      successTitle: "Вы записаны",
      successText: "Ждём вас 21 ноября. Точку сбора опубликуем на сайте; если оставили контакт — напомним."
    },
    starter: {
      title: "Тренировки по циклам",
      lead: "Цикл тренировок: 8 тренировок, тест и план. Оставьте контакт — расскажем про формат и базу.",
      contactLabel: "Телефон или почта",
      contactOptional: false,
      submit: "Оставить заявку",
      successTitle: "Заявка отправлена",
      successText: "Свяжемся с вами в течение дня: расскажем про тренировки и следующий шаг."
    },
    request: {
      title: "Заявка в Сборную",
      lead: "Оставьте контакт — поможем выбрать формат и ответим на вопросы.",
      contactLabel: "Телефон или почта",
      contactOptional: false,
      submit: "Оставить заявку",
      successTitle: "Заявка отправлена",
      successText: "Свяжемся с вами в течение дня и поможем выбрать формат."
    }
  };

  var params = new URLSearchParams(window.location.search);
  var source = params.get("source") || "join_page";
  var leadEndpoint = form.getAttribute("data-endpoint") || "/api/leads";
  var consentVersion = form.getAttribute("data-consent-version") || "2026-10-22";
  var currentFormat = "open";
  var submitLabel = submitButton.textContent;
  var isSending = false;

  function track(event, payload) {
    var data = Object.assign({ event: event }, payload || {});
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(data);
    }
    if (window.yaCounter && typeof window.yaCounter.reachGoal === "function") {
      window.yaCounter.reachGoal(event, data);
    }
  }

  function setError(input, errorNode, message) {
    if (message) {
      input.setAttribute("aria-invalid", "true");
      errorNode.textContent = message;
      errorNode.hidden = false;
      return false;
    }
    input.removeAttribute("aria-invalid");
    errorNode.textContent = "";
    errorNode.hidden = true;
    return true;
  }

  function isPhone(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 && /^[+\d][\d\s\-()]*$/.test(value);
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function currentInfo() {
    return FORMATS[currentFormat] || FORMATS.open;
  }

  function applyFormat() {
    var info = currentInfo();
    title.textContent = info.title;
    lead.textContent = info.lead;
    contactLabel.textContent = info.contactLabel;
    contactInput.required = !info.contactOptional;
    contactInput.setAttribute("placeholder", info.contactOptional ? "Можно не заполнять" : "Телефон или почта");
    submitButton.textContent = info.submit;
    submitLabel = info.submit;
    document.title = info.title + " — ЮБ800";
    if (info.contactOptional) {
      setError(contactInput, contactError, "");
    }
  }

  function selectedFormat() {
    var checked = form.querySelector('input[name="format"]:checked');
    return checked && FORMATS[checked.value] ? checked.value : "open";
  }

  function validateName() {
    if (nameInput.value.trim().length < 2) {
      return setError(nameInput, nameError, "Напишите имя — хотя бы две буквы.");
    }
    return setError(nameInput, nameError, "");
  }

  function validateContact() {
    var value = contactInput.value.trim();
    if (!value && currentInfo().contactOptional) {
      return setError(contactInput, contactError, "");
    }
    if (!isPhone(value) && !isEmail(value)) {
      return setError(
        contactInput,
        contactError,
        currentInfo().contactOptional
          ? "Проверьте телефон или почту — или оставьте поле пустым."
          : "Оставьте телефон или почту: +7 999 000-00-00 или name@mail.ru."
      );
    }
    return setError(contactInput, contactError, "");
  }

  function validateConsent() {
    if (!consentInput.checked) {
      consentInput.setAttribute("aria-invalid", "true");
      consentError.textContent = "Без согласия на обработку данных мы не можем принять заявку.";
      consentError.hidden = false;
      return false;
    }
    consentInput.removeAttribute("aria-invalid");
    consentError.textContent = "";
    consentError.hidden = true;
    return true;
  }

  function validate() {
    var nameOk = validateName();
    var contactOk = validateContact();
    var consentOk = validateConsent();
    return nameOk && contactOk && consentOk;
  }

  function showStatus(message, kind) {
    status.textContent = message;
    status.classList.remove("is-success", "is-error");
    if (kind) {
      status.classList.add(kind);
    }
  }

  function readUtm() {
    var utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (key) {
      var value = params.get(key);
      if (value) {
        utm[key] = value;
      }
    });
    return utm;
  }

  Array.prototype.forEach.call(formatInputs, function (input) {
    input.addEventListener("change", function () {
      currentFormat = selectedFormat();
      applyFormat();
    });
  });

  nameInput.addEventListener("input", function () {
    if (nameInput.getAttribute("aria-invalid") === "true") {
      validateName();
    }
  });

  contactInput.addEventListener("input", function () {
    if (contactInput.getAttribute("aria-invalid") === "true") {
      validateContact();
    }
  });

  consentInput.addEventListener("change", function () {
    if (consentInput.getAttribute("aria-invalid") === "true") {
      validateConsent();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (isSending) {
      return;
    }
    if (companyInput && companyInput.value) {
      return;
    }

    showStatus("", "");
    if (!validate()) {
      track("form_error", { reason: "validation", format: currentFormat });
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    var info = currentInfo();
    isSending = true;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "Отправляем…";

    fetch(leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "site",
        name: nameInput.value.trim(),
        format: currentFormat,
        contact_optional: info.contactOptional,
        contact: contactInput.value.trim(),
        consent: true,
        consent_version: consentVersion,
        source: source,
        page: window.location.pathname,
        utm: readUtm()
      })
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok || !data.ok) {
            throw new Error(data.error || "Не удалось отправить заявку.");
          }
          return data;
        });
      })
      .then(function () {
        form.hidden = true;
        success.hidden = false;
        successTitle.textContent = info.successTitle;
        successText.textContent = info.successText;
        success.focus();
        success.scrollIntoView({ block: "start", behavior: "smooth" });
        track("form_submit", { source: source, format: currentFormat });
      })
      .catch(function (error) {
        showStatus(
          error && error.message
            ? error.message
            : "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.",
          "is-error"
        );
        track("form_error", { reason: "network", format: currentFormat });
      })
      .finally(function () {
        isSending = false;
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.textContent = submitLabel;
      });
  });

  var requestedFormat = params.get("format");
  if (requestedFormat && FORMATS[requestedFormat]) {
    currentFormat = requestedFormat;
  } else {
    currentFormat = selectedFormat();
  }
  Array.prototype.forEach.call(formatInputs, function (input) {
    input.checked = input.value === currentFormat;
  });
  applyFormat();
  track("form_open", { source: source, format: currentFormat });
})();
