// Progressive enhancement for the static pages. Everything here is optional:
// with this file missing, every page still shows its final numbers, the
// still frame of each demo and the full command text.
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() {
    return !!(reduceQuery && reduceQuery.matches);
  }
  var live = document.getElementById("live");
  // If the renderer is not producing frames (some headless renderers and
  // capture tools), animations would sit at their first keyframe. After the
  // time an animation should have taken, jump it to its end state.
  function finishLater(anims, ms) {
    return setTimeout(function () {
      for (var i = 0; i < anims.length; i++) {
        try {
          if (anims[i].playState !== "finished") anims[i].finish();
        } catch (e) {
          /* already removed */
        }
      }
    }, ms);
  }
  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    setTimeout(function () {
      live.textContent = msg;
    }, 30);
  }

  window.addEventListener("load", function () {
    setTimeout(function () {
      doc.classList.add("smooth");
    }, 0);
  });

  // ------------------------------------------------------------ tooltips
  // Every value shown in a tooltip is also on the page as a direct label or
  // in a table view, so the tooltip only adds convenience.
  (function () {
    var tip = document.getElementById("tip");
    if (!tip) return;
    var current = null;

    function show(el, x, y) {
      var raw = el.getAttribute("data-tip") || "";
      var lines = raw.split("\n");
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
    window.addEventListener(
      "scroll",
      function () {
        if (current && document.activeElement !== current) hide();
      },
      { passive: true },
    );
  })();

  // ------------------------------------------------------------ theme
  (function () {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    var order = ["auto", "light", "dark"];
    var names = { auto: "follows system", light: "light", dark: "dark" };
    function currentChoice() {
      return doc.getAttribute("data-theme") || "auto";
    }
    function render() {
      var c = currentChoice();
      btn.querySelector(".theme-label").textContent = c;
      btn.setAttribute("aria-label", "Color theme: " + names[c] + ". Change theme");
    }
    btn.addEventListener("click", function () {
      var next = order[(order.indexOf(currentChoice()) + 1) % order.length];
      if (!reduced()) {
        doc.classList.add("theme-fade");
        setTimeout(function () {
          doc.classList.remove("theme-fade");
        }, 450);
      }
      if (next === "auto") doc.removeAttribute("data-theme");
      else doc.setAttribute("data-theme", next);
      try {
        if (next === "auto") localStorage.removeItem("oal-theme");
        else localStorage.setItem("oal-theme", next);
      } catch (e) {
        /* storage unavailable: the choice lasts for this page only */
      }
      render();
      announce("Theme: " + names[next]);
    });
    render();
  })();

  // ------------------------------------------------------------ header shadow
  (function () {
    var hdr = document.querySelector(".site-header");
    if (!hdr) return;
    var queued = false;
    function update() {
      queued = false;
      hdr.classList.toggle("scrolled", window.scrollY > 4);
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!queued) {
          queued = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    update();
  })();

  // ------------------------------------------------------------ copy buttons
  (function () {
    var buttons = document.querySelectorAll("[data-copy]");
    for (var i = 0; i < buttons.length; i++) buttons[i].hidden = false;
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-copy]");
      if (!b) return;
      var code = b.parentNode.querySelector("code");
      if (!code) return;
      var text = code.textContent;
      function done(msg) {
        b.textContent = msg;
        b.classList.add("done");
        announce(msg === "Copied" ? "Command copied to the clipboard" : "Command selected. Press Control or Command and C to copy");
        clearTimeout(b._t);
        b._t = setTimeout(function () {
          b.textContent = "Copy";
          b.classList.remove("done");
        }, 1800);
      }
      function fallback() {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(range);
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (err) {
          ok = false;
        }
        done(ok ? "Copied" : "Selected");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          done("Copied");
        }, fallback);
      } else {
        fallback();
      }
    });
  })();

  // ------------------------------------------------------------ demos
  // The still frame is the page's image. The GIF replaces it while the demo
  // is on screen, unless the reader prefers reduced motion or pressed Pause.
  (function () {
    var figs = document.querySelectorAll(".demo");
    if (!figs.length) return;
    var items = [];
    for (var i = 0; i < figs.length; i++) {
      var img = figs[i].querySelector("img[data-gif]");
      var btn = figs[i].querySelector("[data-demo-toggle]");
      if (!img || !btn) continue;
      var name = (figs[i].closest(".toolsec") || {}).id || "terminal";
      items.push({ fig: figs[i], img: img, btn: btn, still: img.getAttribute("src"), gif: img.getAttribute("data-gif"), name: name, paused: reduced(), visible: false, loaded: false });
    }
    function render(it) {
      var playing = !it.paused && it.visible;
      it.btn.textContent = it.paused ? "Play" : "Pause";
      it.btn.setAttribute("aria-pressed", it.paused ? "true" : "false");
      it.btn.setAttribute("aria-label", (it.paused ? "Play " : "Pause ") + it.name + " demo");
      it.fig.classList.toggle("playing", playing);
      if (playing) {
        if (it.loaded) {
          if (it.img.getAttribute("src") !== it.gif) it.img.setAttribute("src", it.gif);
        } else if (!it.loading) {
          it.loading = true;
          it.fig.classList.add("loading");
          var pre = new Image();
          pre.onload = function () {
            it.loaded = true;
            it.loading = false;
            it.fig.classList.remove("loading");
            render(it);
          };
          pre.onerror = function () {
            it.loading = false;
            it.fig.classList.remove("loading");
          };
          pre.src = it.gif;
        }
      } else if (it.img.getAttribute("src") !== it.still) {
        it.img.setAttribute("src", it.still);
      }
    }
    items.forEach(function (it) {
      it.btn.hidden = false;
      it.btn.addEventListener("click", function () {
        it.paused = !it.paused;
        render(it);
      });
      render(it);
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          for (var j = 0; j < items.length; j++) {
            if (items[j].fig === en.target) {
              items[j].visible = en.isIntersecting;
              render(items[j]);
            }
          }
        });
      },
      { rootMargin: "120px 0px" },
    );
    items.forEach(function (it) {
      io.observe(it.fig);
    });
  })();

  // ------------------------------------------------------------ hero instrument
  // The pass counts are final in the HTML. While the CSS fill-in animation
  // runs, each count follows the cells that have filled so far.
  (function () {
    var fig = document.querySelector(".instrument");
    if (!fig) return;
    var grid = fig.querySelector(".hgrid");
    var replay = fig.querySelector("[data-replay]");
    var counters = fig.querySelectorAll("[data-count-agent]");
    if (!grid || typeof Element.prototype.getAnimations !== "function") return;
    var finals = [];
    for (var i = 0; i < counters.length; i++) finals.push(counters[i].textContent);
    var raf = 0;

    function tick() {
      var running = grid.getAnimations({ subtree: true }).length > 0;
      for (var c = 0; c < counters.length; c++) {
        var cells = grid.querySelectorAll('.hg-cell.pass[data-agent="' + c + '"]');
        var n = 0;
        for (var k = 0; k < cells.length; k++) {
          var anims = cells[k].getAnimations();
          if (!anims.length || anims[0].effect.getComputedTiming().progress > 0) n++;
        }
        counters[c].textContent = running ? String(n) : finals[c];
      }
      fig.classList.toggle("running", running);
      raf = running ? requestAnimationFrame(tick) : 0;
    }

    var guard = 0;
    function start() {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      guard = finishLater(grid.getAnimations({ subtree: true }), 3200);
      setTimeout(function () {
        if (!raf) return;
        cancelAnimationFrame(raf);
        raf = 0;
        fig.classList.remove("running");
        for (var f = 0; f < counters.length; f++) counters[f].textContent = finals[f];
      }, 3300);
      tick();
    }

    if (!reduced()) {
      start();
      if (replay) {
        replay.hidden = false;
        replay.addEventListener("click", function () {
          grid.setAttribute("data-run", grid.getAttribute("data-run") === "a" ? "b" : "a");
          requestAnimationFrame(start);
          announce("Replaying the runs. Final counts are unchanged.");
        });
      }
    }
  })();

  // ------------------------------------------------------------ chart entrance
  // Marks are drawn at their final position in the HTML. When a chart first
  // scrolls into view, each mark grows out of its estimate from a smaller,
  // still visible state. Nothing waits on this to be correct.
  (function () {
    if (reduced() || !("IntersectionObserver" in window) || typeof Element.prototype.animate !== "function") return;
    var charts = document.querySelectorAll("figure.chart");
    if (!charts.length) return;
    var ease = "cubic-bezier(.2,.75,.25,1)";
    function play(fig) {
      var made = [];
      var rows = fig.querySelectorAll(".crow:not(.crow-axis)");
      for (var r = 0; r < rows.length; r++) {
        var d = r * 70;
        each(rows[r], ".ci, .rng, .span", function (el) {
          made.push(el.animate([{ transform: "scaleX(0.15)" }, { transform: "scaleX(1)" }], { duration: 700, delay: d, easing: ease, fill: "backwards" }));
        });
        each(rows[r], ".est, .ctrack .mk", function (el) {
          made.push(el.animate([{ transform: "scale(0.45)" }, { transform: "scale(1)" }], { duration: 520, delay: d + 120, easing: ease, fill: "backwards" }));
        });
      }
      var marks = fig.querySelectorAll(".grid-table .run-mark");
      for (var m = 0; m < marks.length; m++) {
        made.push(marks[m].animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], { duration: 420, delay: Math.min(m * 9, 600), easing: ease, fill: "backwards" }));
      }
      finishLater(made, rows.length * 70 + 1600);
    }
    function each(root, sel, fn) {
      var els = root.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) fn(els[i]);
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          play(en.target);
        });
      },
      { threshold: 0.2 },
    );
    for (var i = 0; i < charts.length; i++) io.observe(charts[i]);
  })();
})();
