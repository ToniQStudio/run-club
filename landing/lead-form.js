(function () {
  "use strict";

  var dialog = document.getElementById("lead-dialog");
  var closeButton = document.getElementById("lead-close");
  var form = document.getElementById("lead-form");
  var success = document.getElementById("lead-success");

  if (!dialog || !closeButton || !form || !success) {
    return;
  }

  var nameInput = document.getElementById("lead-name");
  var contactInput = document.getElementById("lead-contact");
  var consentInput = document.getElementById("lead-consent");
  var companyInput = document.getElementById("lead-company");
  var submitButton = form.querySelector('button[type="submit"]');
  var againButton = document.getElementById("lead-again");
  var status = document.getElementById("lead-status");
  var nameError = document.getElementById("lead-name-error");
  var contactError = document.getElementById("lead-contact-error");
  var consentError = document.getElementById("lead-consent-error");

  var isSending = false;
  var submitLabel = submitButton.textContent;
  var triggers = document.querySelectorAll("[data-lead-open]");
  var lastTrigger = triggers.length ? triggers[0] : null;
  var leadSource = window.location.pathname;
  var leadEndpoint = form.getAttribute("data-endpoint") || "/api/leads";
  var consentVersion = form.getAttribute("data-consent-version") || "2026-10-22";

  function track(event, params) {
    var payload = Object.assign({ event: event }, params || {});
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
    if (window.yaCounter && typeof window.yaCounter.reachGoal === "function") {
      window.yaCounter.reachGoal(event, payload);
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

  function validateName() {
    if (nameInput.value.trim().length < 2) {
      return setError(nameInput, nameError, "Напишите имя — хотя бы две буквы.");
    }
    return setError(nameInput, nameError, "");
  }

  function validateContact() {
    var value = contactInput.value.trim();
    if (!isPhone(value) && !isEmail(value)) {
      return setError(
        contactInput,
        contactError,
        "Оставьте телефон или почту: +7 999 000-00-00 или name@mail.ru."
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

  function lockScroll() {
    var scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--scrollbar-comp", Math.max(scrollbar, 0) + "px");
    document.documentElement.classList.add("is-locked");
  }

  function unlockScroll() {
    document.documentElement.classList.remove("is-locked");
    document.documentElement.style.removeProperty("--scrollbar-comp");
  }

  function showSuccess() {
    dialog.classList.add("is-sent");
    form.hidden = true;
    success.hidden = false;
    success.focus();
    track("form_submit");
  }

  function showForm() {
    dialog.classList.remove("is-sent");
    success.hidden = true;
    form.hidden = false;
    form.reset();
    showStatus("", "");
    if (dialog.open) {
      nameInput.focus();
    }
  }

  function openDialog(trigger) {
    if (dialog.open) {
      return;
    }
    if (trigger) {
      lastTrigger = trigger;
    }
    leadSource = (lastTrigger && lastTrigger.getAttribute("data-lead-source")) || window.location.pathname;
    track("form_open", { source: leadSource });
    if (dialog.classList.contains("is-sent")) {
      showForm();
    }
    dialog.showModal();
    lockScroll();
    nameInput.focus();
  }

  function closeDialog() {
    if (dialog.open) {
      dialog.close();
    }
  }

  closeButton.addEventListener("click", closeDialog);

  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      openDialog(trigger);
    });
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      closeDialog();
    }
  });

  dialog.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") {
      return;
    }

    var items = Array.prototype.filter.call(
      dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) {
        return el.offsetParent !== null && el.tabIndex !== -1;
      }
    );

    if (!items.length) {
      return;
    }

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener("close", function () {
    unlockScroll();
    if (lastTrigger && lastTrigger.isConnected && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
      return;
    }
    var fallback = document.querySelector("[data-lead-open]");
    if (fallback) {
      fallback.focus();
    }
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
      track("form_error", { reason: "validation" });
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    isSending = true;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "Отправляем…";

    var params = new URLSearchParams(window.location.search);
    var utmSource = params.get("utm_source");
    var source = (utmSource ? utmSource + " · " : "") + (leadSource || window.location.pathname);
    var utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (key) {
      var value = params.get(key);
      if (value) {
        utm[key] = value;
      }
    });

    fetch(leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "site",
        name: nameInput.value.trim(),
        contact: contactInput.value.trim(),
        consent: true,
        consent_version: consentVersion,
        source: source,
        page: window.location.pathname,
        utm: utm
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
        showSuccess();
      })
      .catch(function (error) {
        showStatus(
          error && error.message
            ? error.message
            : "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.",
          "is-error"
        );
        track("form_error", { reason: "network" });
      })
      .finally(function () {
        isSending = false;
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.textContent = submitLabel;
      });
  });

  againButton.addEventListener("click", showForm);
})();
