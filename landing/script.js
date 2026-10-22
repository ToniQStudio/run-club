(function () {
  "use strict";

  var form = document.getElementById("lead-form");
  var status = document.getElementById("form-status");

  if (!form || !status) {
    return;
  }

  var leadEndpoint = form.getAttribute("data-endpoint") || "/api/leads";

  var nameInput = document.getElementById("name");
  var contactInput = document.getElementById("contact");
  var consentInput = document.getElementById("consent");
  var companyInput = document.getElementById("company");
  var submitButton = form.querySelector('button[type="submit"]');
  var nameError = document.getElementById("name-error");
  var contactError = document.getElementById("contact-error");
  var consentError = document.getElementById("consent-error");

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

  function validateName() {
    var value = nameInput.value.trim();
    if (value.length < 2) {
      return setError(nameInput, nameError, "Напишите имя — хотя бы две буквы.");
    }
    return setError(nameInput, nameError, "");
  }

  function validateContact() {
    var value = contactInput.value.trim();
    var isPhone = /^[+\d][\d\s\-()]{5,}$/.test(value);
    var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    if (!isPhone && !isEmail) {
      return setError(
        contactInput,
        contactError,
        "Оставьте телефон или email: +7 999 000-00-00 или name@example.com."
      );
    }
    return setError(contactInput, contactError, "");
  }

  function validateConsent() {
    if (!consentInput.checked) {
      consentError.textContent = "Без согласия на обработку данных мы не можем принять заявку.";
      consentError.hidden = false;
      consentInput.setAttribute("aria-invalid", "true");
      return false;
    }
    consentError.textContent = "";
    consentError.hidden = true;
    consentInput.removeAttribute("aria-invalid");
    return true;
  }

  function validate() {
    var nameOk = validateName();
    var contactOk = validateContact();
    var consentOk = validateConsent();
    return nameOk && contactOk && consentOk;
  }

  nameInput.addEventListener("input", function () {
    if (nameInput.getAttribute("aria-invalid") === "true") {
      validateName();
    }
    track("form_start");
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

    status.textContent = "";
    status.classList.remove("is-success", "is-error");

    if (companyInput && companyInput.value) {
      return;
    }

    if (!validate()) {
      track("form_error", { reason: "validation" });
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Отправляем…";

    var params = new URLSearchParams(window.location.search);
    var source = params.get("utm_source") || window.location.pathname;
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
        consent_version: form.getAttribute("data-consent-version") || "2026-10-22",
        source: source,
        page: window.location.pathname,
        utm: utm
      })
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed");
        }
        return response.json();
      })
      .then(function () {
        form.reset();
        status.textContent = "Вы записаны. Пришлём точку сбора и время.";
        status.classList.add("is-success");
        track("form_submit");
      })
      .catch(function () {
        status.textContent =
          "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.";
        status.classList.add("is-error");
        track("form_error", { reason: "network" });
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.textContent = "Записаться на пробежку";
      });
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link) {
      return;
    }
    if (link.hash === "#signup") {
      track("cta_click", { place: link.textContent.trim().slice(0, 80) });
    }
  });
})();
