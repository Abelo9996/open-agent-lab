// Tooltips for chart marks. Every value shown here is also on the page as a
// direct label or in a table view, so the tooltip only adds convenience.
(function () {
  "use strict";
  var tip = document.getElementById("tip");
  if (!tip) return;
  var current = null;

  function show(el, x, y) {
    var raw = el.getAttribute("data-tip") || "";
    var lines = raw.split("\n");
    // First block is the value; the remaining lines are labels.
    var value = lines.shift() || "";
    var label = lines.join(" · ");
    // Range charts carry several value lines before the label.
    if (el.closest(".chart-range")) {
      label = lines.pop() || "";
      value = [value].concat(lines).join("\n");
    }
    tip.textContent = "";
    var strong = document.createElement("strong");
    strong.textContent = value;
    tip.appendChild(strong);
    if (label) {
      var span = document.createElement("span");
      span.textContent = label;
      tip.appendChild(span);
    }
    tip.hidden = false;
    current = el;
    place(x, y);
  }

  function place(x, y) {
    var pad = 12;
    var w = tip.offsetWidth;
    var h = tip.offsetHeight;
    var left = x + pad;
    var top = y - h - pad;
    if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - pad);
    if (top < 8) top = y + pad;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hide() {
    tip.hidden = true;
    current = null;
  }

  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) {
      if (current && document.activeElement !== current) hide();
      return;
    }
    if (el !== current) show(el, e.clientX, e.clientY);
    else place(e.clientX, e.clientY);
  });

  document.addEventListener("focusin", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) return hide();
    var r = el.getBoundingClientRect();
    show(el, r.left + Math.min(r.width / 2, 160), r.top);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });
  window.addEventListener("scroll", function () {
    if (current && document.activeElement !== current) hide();
  }, { passive: true });
})();
