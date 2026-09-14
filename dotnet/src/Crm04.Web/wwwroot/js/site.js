/* Site helpers: CSV download + theme init. No CDN, no framework. */
(function () {
  window.crm04Download = function (filename, mime, text) {
    try {
      var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename || "download.txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        a.remove();
      }, 500);
    } catch (e) {
      console.error("crm04Download failed", e);
    }
  };

  /* Smooth-scroll helpers for the locate-on-mill interaction. */
  window.crm04ScrollTo = function (id) {
    try {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) { /* scroll unavailable - highlight still shows */ }
  };

  window.crm04ScrollToGroup = function (title) {
    try {
      var el = document.querySelector('[data-group="' + title + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) { /* scroll unavailable - flash still shows */ }
  };

  /* Trend hover: cursor line + tooltip, driven purely from embedded JSON.
     Blazor calls crm04TrendHover() after each render; nodes already wired are
     skipped via dataset, so re-renders never double-bind and no interop happens
     on the mousemove path. */
  /* Trend hover: cursor line + tooltip, driven from embedded JSON.
     Blazor RENDERS the hover nodes (.chart-hover-line/.chart-tooltip/.chart-hover-dot)
     and only JS mutates their position/content — JS never appends children, so the
     500 ms refresh can't orphan them. The payload is re-read whenever the embedded
     JSON changes (string compare, parse only on change), so values never go stale.
     No interop on the mousemove path. */
  window.crm04TrendHover = function () {
    document.querySelectorAll(".chart-svg-wrap").forEach(function (wrap) {
      if (wrap.dataset.wired === "1" || !wrap.isConnected) return;
      wrap.dataset.wired = "1";

      var cache = { text: null, payload: null };

      function readPayload() {
        var dataEl = wrap.querySelector(".chart-data");
        if (!dataEl) return null;
        var text = dataEl.textContent;
        if (text === cache.text) return cache.payload;
        try { cache.payload = JSON.parse(text); } catch (e) { return null; }
        cache.text = text;
        return cache.payload;
      }

      function nodes() {
        return {
          line: wrap.querySelector(".chart-hover-line"),
          tip: wrap.querySelector(".chart-tooltip"),
          dots: wrap.querySelectorAll(".chart-hover-dot"),
        };
      }

      function hideAll() {
        var n = nodes();
        if (n.line) n.line.style.display = "none";
        if (n.tip) n.tip.style.display = "none";
        n.dots.forEach(function (d) { d.style.display = "none"; });
      }

      function dims() {
        return {
          W: parseFloat(wrap.dataset.w), H: parseFloat(wrap.dataset.h),
          PL: parseFloat(wrap.dataset.pl), PW: parseFloat(wrap.dataset.pw),
          PT: parseFloat(wrap.dataset.pt), PH: parseFloat(wrap.dataset.ph),
          tMin: parseFloat(wrap.dataset.tmin), tMax: parseFloat(wrap.dataset.tmax),
        };
      }

      function yOf(d, p, v) {
        var min = p.min - Math.abs(p.min) * 0.03 - 1e-9;
        var max = p.max + Math.abs(p.max) * 0.03 + 1e-9;
        if (p.flat) return d.PT + d.PH - 3;
        return d.PT + d.PH - ((v - min) / (max - min)) * d.PH;
      }

      function nearest(p, t) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < p.t.length; i++) {
          var dd = Math.abs(p.t[i] - t);
          if (dd < bd) { bd = dd; best = i; }
        }
        return best;
      }

      wrap.addEventListener("mousemove", function (e) {
        var payload = readPayload();
        if (!payload || !payload.pens || !payload.pens.length) { hideAll(); return; }
        var d = dims();
        var n = nodes();
        if (!n.line || !n.tip) return;
        var rect = wrap.getBoundingClientRect();
        if (rect.width < 2) return;
        var fx = (e.clientX - rect.left) / rect.width;
        var vx = fx * d.W;
        var t = d.tMin + ((vx - d.PL) / d.PW) * (d.tMax - d.tMin);
        var sx = ((vx / d.W) * rect.width);

        n.line.style.display = "block";
        n.line.style.left = sx + "px";
        n.tip.style.display = "block";

        var html = "";
        var tShown = 0;
        var dots = Array.prototype.slice.call(n.dots);
        payload.pens.forEach(function (p, pi) {
          if (!p.t.length) return;
          var i = nearest(p, t);
          tShown = tShown || p.t[i];
          var yFrac = yOf(d, p, p.v[i]) / d.H;
          var dot = dots[pi];
          if (dot) {
            dot.style.display = "block";
            dot.style.left = sx + "px";
            dot.style.top = (yFrac * rect.height) + "px";
          }
          var val = Number(p.v[i]).toFixed(p.decimals);
          html += '<div class="chart-tooltip-row" style="color:' + p.color + '">' +
            "<span>" + escapeHtml(p.label) + " : " + escapeHtml(val) + " " + escapeHtml(p.unit) + "</span></div>";
        });
        var dt = new Date(tShown);
        n.tip.innerHTML = '<div class="chart-tooltip-time">' + escapeHtml(dt.toLocaleTimeString()) + "</div>" + html;
        var tw = n.tip.offsetWidth;
        var left = sx + 14;
        if (left + tw > rect.width - 4) left = sx - tw - 14;
        n.tip.style.left = Math.max(4, left) + "px";
        n.tip.style.top = "12px";
      });
      wrap.addEventListener("mouseleave", hideAll);
    });
  };

  /* Tween numbers: ease [data-tween] text toward data-target at 60 fps.
     Blazor owns the attributes (target/decimals); JS owns the text node. Each render tick
     moves the goalposts by a small step and the rAF loop softens it into a glide.
     Reduced-motion: snap instantly. Started once; new nodes join automatically. */
  window.crm04TweenTick = function () {
    if (window.__crm04TweenOn) return;
    window.__crm04TweenOn = true;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fmt = function (v, d, signed) {
      var t = Number(v).toFixed(d);
      return signed && Number(v) >= 0 ? "+" + t : t;
    };
    var step = function () {
      requestAnimationFrame(step);
      if (document.hidden) return;
      document.querySelectorAll("[data-tween]").forEach(function (el) {
        if (!el.isConnected) return;
        var target = parseFloat(el.getAttribute("data-tween"));
        if (!isFinite(target)) return;
        var dec = parseInt(el.getAttribute("data-decimals") || "1", 10);
        var signed = el.getAttribute("data-signed") === "1";
        var shown = parseFloat((el.textContent || "").replace(/[^0-9.\-+eE]/g, ""));
        if (!isFinite(shown)) { el.textContent = fmt(target, dec, signed); return; }
        if (reduce || Math.abs(target - shown) < Math.pow(10, -dec) / 2) {
          var exact = fmt(target, dec, signed);
          if (el.textContent !== exact) el.textContent = exact;
          return;
        }
        // Ease ~300 ms: cover 1/6 of the remaining gap per 60 fps frame.
        el.textContent = fmt(shown + (target - shown) / 6, dec, signed);
      });
    };
    requestAnimationFrame(step);
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  window.crm04TwinFullscreen = function (el) {
    try {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (el && el.requestFullscreen) el.requestFullscreen();
    } catch (e) {
      console.error("crm04TwinFullscreen failed", e);
    }
  };

  try {
    var saved = localStorage.getItem("crm04-theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  } catch (e) { /* private mode — light theme stands */ }
})();
