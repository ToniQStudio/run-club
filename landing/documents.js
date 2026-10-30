(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".doc-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".doc-panel"));
  if (!tabs.length || tabs.length !== panels.length) return;

  function panelFor(tab) {
    return document.getElementById(tab.getAttribute("aria-controls"));
  }

  function activate(tab, options) {
    var settings = options || {};
    tabs.forEach(function (item) {
      var selected = item === tab;
      item.setAttribute("aria-selected", selected ? "true" : "false");
      item.tabIndex = selected ? 0 : -1;
      var panel = panelFor(item);
      if (panel) panel.hidden = !selected;
    });

    if (settings.focus) tab.focus();
    if (settings.updateHash) {
      var id = tab.id === "tab-privacy" ? "privacy" : "offer";
      history.replaceState(null, "", "#" + id);
    }
  }

  function tabFromHash() {
    var hash = window.location.hash.replace("#", "");
    if (hash === "privacy") return document.getElementById("tab-privacy");
    return document.getElementById("tab-offer");
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      activate(tab, { updateHash: true });
    });

    tab.addEventListener("keydown", function (event) {
      var next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activate(next, { focus: true, updateHash: true });
    });
  });

  function applyHash() {
    activate(tabFromHash(), { updateHash: false });

    // Deep links into offer sections keep working through the tab page.
    var hash = window.location.hash;
    if (hash && hash !== "#offer" && hash !== "#privacy") {
      var target = document.querySelector(hash);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({ block: "start" });
        }, 0);
      }
    }
  }

  applyHash();
  window.addEventListener("hashchange", applyHash);
})();
