/* Regiefix-Kern: gemeinsame Teile für Pro und Lite.
   Hier ändern = gilt in beiden Apps. Aussehen und App-eigene Funktionen bleiben in den jeweiligen index.html. */
(function (global) {
  "use strict";
  var RF = {};

  /* ---------- Zahlen ---------- */
  RF.zahl = function (s) {
    var v = parseFloat(String(s == null ? "" : s).replace(",", "."));
    return isNaN(v) ? 0 : v;
  };
  RF.zahlText = function (v) {
    return (Math.round(v * 100) / 100).toString().replace(".", ",");
  };

  /* ---------- PDF: Text so umbauen, dass jsPDF ihn darstellen kann ---------- */
  RF.pdfSafe = function (s) {
    return String(s == null ? "" : s)
      .replace(/[–—−]/g, "-").replace(/[‘’‚]/g, "'")
      .replace(/[“”„]/g, '"').replace(/…/g, "...").replace(/ /g, " ")
      .replace(/[^\x00-\xFF\n]/g, "");
  };

  /* ---------- PDF: ansehen / teilen ---------- */
  RF.openBlob = function (blob, name) {
    var url = URL.createObjectURL(blob);
    var w = window.open(url, "_blank");
    if (!w) {
      var a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
  };
  RF.kannTeilen = function (file) {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
  };
  RF.teilen = function (file) {
    return navigator.share({ files: [file], title: file.name });
  };

  /* ---------- Unterschrift-Feld (Zeichnen + Zuschneiden) ----------
     opt: { farbe, breite, rand (mm-ähnlich in CSS-Pixeln), maxBreite, beiStrich: function } */
  RF.unterschriftFeld = function (canvas, opt) {
    opt = opt || {};
    var ctx = canvas.getContext("2d");
    var dpr = 1, malt = false, hat = false;

    function einrichten() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = opt.breite || 3.5;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = opt.farbe || "#000";
      hat = false;
    }
    function leeren() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      hat = false;
    }
    /* Fingerposition immer auf die Feldgröße umrechnen (auch nach Drehen des Handys) */
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / dpr) / r.width, y: (e.clientY - r.top) * (canvas.height / dpr) / r.height };
    }
    canvas.addEventListener("pointerdown", function (e) {
      malt = true; hat = true;
      if (opt.beiStrich) opt.beiStrich();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!malt) return;
      var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { malt = false; });
    });

    /* Zuschneiden auf die Schrift; null, wenn nichts gemalt wurde */
    function zuschneiden() {
      var w = canvas.width, h = canvas.height, d = ctx.getImageData(0, 0, w, h).data;
      var x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y += 2) {
        for (var x = 0; x < w; x += 2) {
          if (d[(y * w + x) * 4 + 3] > 10) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      var m = (opt.rand || 12) * dpr;
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
      x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
      var cw = x1 - x0, ch = y1 - y0, s = Math.min(1, (opt.maxBreite || 700) / cw);
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(cw * s)); c.height = Math.max(1, Math.round(ch * s));
      c.getContext("2d").drawImage(canvas, x0, y0, cw, ch, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    }
    /* Eine vorhandene Unterschrift unten ins Feld zeichnen (zum Ändern) */
    function bildLaden(url, nurWenn) {
      var im = new Image();
      im.onload = function () {
        if (nurWenn && !nurWenn()) return;
        var r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
        var sk = Math.min((w * 0.8) / im.width, (h * 0.4) / im.height, 1);
        var dw = im.width * sk, dh = im.height * sk;
        ctx.drawImage(im, (w - dw) / 2, h * 0.82 - dh - 6, dw, dh);
        hat = true;
      };
      im.src = url;
    }
    return {
      einrichten: einrichten, leeren: leeren, zuschneiden: zuschneiden, bildLaden: bildLaden,
      hatStrich: function () { return hat; }
    };
  };

  /* ---------- Update-Prüfung ----------
     Vergleicht APP_VERSION in der index.html auf dem Server mit der laufenden Version.
     Ist sie neu, werden alte Zwischenspeicher gelöscht und die Seite neu geladen. */
  RF.updateCheck = function (version) {
    if (!window.fetch) return;
    fetch("index.html?check=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var m = t.match(/APP_VERSION = "([^"]+)"/);
      if (!m || m[1] === version) { try { sessionStorage.removeItem("updTry"); } catch (e) {} return; }
      var tried = "";
      try { tried = sessionStorage.getItem("updTry") || ""; } catch (e) {}
      if (tried === m[1]) return;
      try { sessionStorage.setItem("updTry", m[1]); } catch (e) {}
      var go = function () { location.replace(location.pathname + "?v=" + encodeURIComponent(m[1])); };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); }));
        }).then(function () {
          return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null;
        }).then(go, go);
      } else go();
    }).catch(function () {});
  };

  global.RF = RF;
})(window);
