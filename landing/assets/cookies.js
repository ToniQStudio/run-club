/* Плашка про cookies и Яндекс.Метрику. Показывается один раз, скрывается по кнопке. */
(function () {
  "use strict";

  var KEY = "run800_cookies_ok";
  try {
    if (window.localStorage && localStorage.getItem(KEY) === "1") return;
  } catch (error) {
    /* приватный режим — показываем */
  }

  var css =
    ".cookie-note{position:fixed;left:16px;right:16px;bottom:16px;z-index:80;" +
    "display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;" +
    "max-width:720px;margin:0 auto;padding:16px 18px;border-radius:14px;" +
    "background:rgba(11,18,32,.96);border:1px solid rgba(204,255,0,.35);" +
    "box-shadow:0 18px 48px rgba(0,0,0,.45);" +
    "font-family:Jost,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.45;" +
    "color:#e5e7eb;transform:translateY(140%);transition:transform .25s ease}" +
    ".cookie-note.is-visible{transform:translateY(0)}" +
    ".cookie-note p{margin:0;max-width:520px}" +
    ".cookie-note a{color:#ccff00;text-decoration:underline}" +
    ".cookie-note button{flex:none;padding:10px 18px;border-radius:999px;border:1px solid #ccff00;" +
    "background:#ccff00;color:#1a2400;font:inherit;font-weight:700;cursor:pointer}" +
    ".cookie-note button:hover{background:#baeb00;border-color:#baeb00}" +
    "@media (max-width:520px){.cookie-note{left:12px;right:12px;bottom:12px;padding:14px}" +
    ".cookie-note button{width:100%}}";

  function build() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var note = document.createElement("div");
    note.className = "cookie-note";
    note.setAttribute("role", "region");
    note.setAttribute("aria-label", "Использование cookies");

    var text = document.createElement("p");
    text.innerHTML =
      "Мы используем cookies и Яндекс.Метрику, чтобы понимать, как используется сайт. " +
      'Подробнее — в <a href="/privacy.html">политике обработки данных</a>.';
    note.appendChild(text);

    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Понятно";
    note.appendChild(button);

    document.body.appendChild(note);
    requestAnimationFrame(function () {
      note.classList.add("is-visible");
    });

    button.addEventListener("click", function () {
      try {
        localStorage.setItem(KEY, "1");
      } catch (error) {
        /* ничего */
      }
      note.classList.remove("is-visible");
      setTimeout(function () {
        note.remove();
      }, 260);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
