(function () {
  "use strict";

  var items = document.querySelectorAll("[data-reveal]");
  if (!items.length) {
    return;
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach(function (item) {
      item.classList.add("in");
    });
    return;
  }

  items.forEach(function (item) {
    var parent = item.parentElement;
    if (!parent) {
      return;
    }
    var siblings = Array.prototype.filter.call(parent.children, function (child) {
      return child.hasAttribute("data-reveal");
    });
    var index = siblings.indexOf(item);
    var step = Math.min(Math.max(index, 0), 3);
    item.style.setProperty("--reveal-delay", (step * 0.1).toFixed(1) + "s");
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  items.forEach(function (item) {
    observer.observe(item);
  });
})();
