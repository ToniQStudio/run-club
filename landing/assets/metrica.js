/* Яндекс.Метрика для run800.ru
 * Подключение: <script src="assets/metrica.js" data-counter="00000000" defer></script>
 * Пока data-counter не задан, счётчик не грузится и ничего не отправляется.
 */
(function () {
  "use strict";

  var self = document.currentScript;
  var counter = (self && self.getAttribute("data-counter")) || "";
  counter = counter.trim();

  window.dataLayer = window.dataLayer || [];

  window.trackGoal = function (goal, params) {
    if (!goal) return;
    var payload = Object.assign({ event: goal }, params || {});
    window.dataLayer.push(payload);
    if (/^\d{6,10}$/.test(counter) && typeof window.ym === "function") {
      try {
        window.ym(counter, "reachGoal", goal, params);
      } catch (error) {
        /* Метрика недоступна — не ломаем страницу */
      }
    }
  };

  if (!/^\d{6,10}$/.test(counter)) {
    return;
  }

  window.ym =
    window.ym ||
    function () {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
  window.ym.l = Date.now();

  var tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(tag);

  window.ym(counter, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true
  });

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.indexOf("pay.html") !== -1) {
      window.trackGoal("pay_open");
    } else if (href.indexOf("t.me") !== -1) {
      window.trackGoal("telegram_open", { href: href });
    }
  });
})();
