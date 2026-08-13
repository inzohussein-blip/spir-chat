/**
 * SpirChat website widget loader.
 *
 * Embed on any site:
 *   <script src="https://your-app/widget.js" data-spirchat="CHANNEL_ID" async></script>
 *
 * Injects a floating button that toggles an iframe of the SpirChat chat surface.
 */
(function () {
  "use strict";

  var current =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  if (!current) return;

  var channelId = current.getAttribute("data-spirchat");
  if (!channelId) {
    console.error("[SpirChat] Missing data-spirchat channel id on script tag.");
    return;
  }

  // Base origin: explicit override, else the origin the script was served from.
  var origin = current.getAttribute("data-spirchat-origin");
  if (!origin) {
    try {
      origin = new URL(current.src).origin;
    } catch (e) {
      origin = "";
    }
  }

  if (window.__spirchatLoaded) return;
  window.__spirchatLoaded = true;

  // Language: explicit data-spirchat-lang wins, else fall back to the visitor's
  // browser language ("ar" → Arabic/RTL, anything else → English).
  var lang = current.getAttribute("data-spirchat-lang");
  if (!lang) {
    lang = (navigator.language || "en").toLowerCase().indexOf("ar") === 0 ? "ar" : "en";
  }

  var GRADIENT = "linear-gradient(135deg, #7C3AED, #06B6D4)";
  var rtl = lang === "ar";
  var side = rtl ? "left" : "right";
  var open = false;

  var iframe = document.createElement("iframe");
  iframe.src =
    origin +
    "/widget/" +
    encodeURIComponent(channelId) +
    "?lang=" +
    encodeURIComponent(lang);
  iframe.title = "SpirChat";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText = [
    "position:fixed",
    "bottom:96px",
    side + ":20px",
    "width:380px",
    "height:600px",
    "max-width:calc(100vw - 40px)",
    "max-height:calc(100vh - 130px)",
    "border:none",
    "border-radius:16px",
    "box-shadow:0 12px 40px rgba(0,0,0,0.18)",
    "z-index:2147483646",
    "display:none",
    "opacity:0",
    "transform:translateY(8px) scale(0.98)",
    "transform-origin:bottom " + side,
    "transition:opacity 0.18s ease, transform 0.18s ease",
    "background:#fff",
  ].join(";");

  var button = document.createElement("button");
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText = [
    "position:fixed",
    "bottom:20px",
    side + ":20px",
    "width:60px",
    "height:60px",
    "border:none",
    "border-radius:50%",
    "cursor:pointer",
    "background:" + GRADIENT,
    "box-shadow:0 8px 24px rgba(124,58,237,0.4)",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:transform 0.15s ease",
  ].join(";");

  var chatIcon =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var closeIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  button.innerHTML = chatIcon;

  // Unread badge: a red counter shown on the launcher when the agent replies
  // while the chat is closed. Fed by postMessage from the iframe.
  var unread = 0;
  var badge = document.createElement("span");
  badge.style.cssText = [
    "position:absolute",
    "top:-2px",
    "right:-2px",
    "min-width:20px",
    "height:20px",
    "padding:0 5px",
    "box-sizing:border-box",
    "border-radius:10px",
    "background:#ef4444",
    "color:#fff",
    "font:bold 12px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "text-align:center",
    "box-shadow:0 0 0 2px #fff",
    "display:none",
  ].join(";");
  button.appendChild(badge);

  function updateBadge() {
    if (unread > 0 && !open) {
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.style.display = "block";
    } else {
      badge.style.display = "none";
    }
  }

  var closeTimer = null;

  function setOpen(state) {
    open = state;
    button.innerHTML = open ? closeIcon : chatIcon;
    button.appendChild(badge);
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      iframe.style.display = "block";
      // Next frame: animate in from the collapsed state.
      requestAnimationFrame(function () {
        iframe.style.opacity = "1";
        iframe.style.transform = "translateY(0) scale(1)";
      });
      unread = 0;
      hideTeaser();
    } else {
      iframe.style.opacity = "0";
      iframe.style.transform = "translateY(8px) scale(0.98)";
      closeTimer = setTimeout(function () {
        iframe.style.display = "none";
        closeTimer = null;
      }, 180);
    }
    updateBadge();
  }

  // The iframe reports unread agent messages while it is hidden.
  window.addEventListener("message", function (e) {
    if (origin && e.origin !== origin) return;
    var d = e.data;
    if (!d || d.source !== "spirchat") return;
    if (d.type === "unread") {
      unread = typeof d.count === "number" ? d.count : 0;
      updateBadge();
    }
  });

  button.addEventListener("click", function () {
    setOpen(!open);
  });
  button.addEventListener("mouseenter", function () {
    button.style.transform = "scale(1.06)";
  });
  button.addEventListener("mouseleave", function () {
    button.style.transform = "scale(1)";
  });

  // Proactive teaser bubble (shown after a delay to prompt the visitor).
  var teaser = null;
  var teaserKey = "spirchat_teaser_" + channelId;

  function hideTeaser() {
    if (teaser && teaser.parentNode) teaser.parentNode.removeChild(teaser);
    teaser = null;
  }

  function showTeaser(text) {
    if (open || teaser) return;
    try {
      if (sessionStorage.getItem(teaserKey)) return;
    } catch (e) {}

    teaser = document.createElement("div");
    teaser.setAttribute("dir", rtl ? "rtl" : "ltr");
    teaser.style.cssText = [
      "position:fixed",
      "bottom:92px",
      side + ":20px",
      "max-width:260px",
      "background:#fff",
      "color:#111827",
      "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "padding:12px 30px 12px 14px",
      "border-radius:14px",
      "box-shadow:0 10px 30px rgba(0,0,0,0.16)",
      "z-index:2147483646",
      "cursor:pointer",
    ].join(";");
    teaser.textContent = text;

    var close = document.createElement("span");
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss");
    close.style.cssText = [
      "position:absolute",
      "top:6px",
      (rtl ? "left" : "right") + ":8px",
      "cursor:pointer",
      "color:#9ca3af",
      "font-size:16px",
      "line-height:1",
    ].join(";");
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      try { sessionStorage.setItem(teaserKey, "1"); } catch (er) {}
      hideTeaser();
    });

    teaser.addEventListener("click", function () {
      try { sessionStorage.setItem(teaserKey, "1"); } catch (er) {}
      setOpen(true);
    });

    teaser.appendChild(close);
    document.body.appendChild(teaser);
  }

  function loadConfigAndSchedule() {
    fetch(origin + "/api/widget/" + encodeURIComponent(channelId) + "/config")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && cfg.proactive) {
          var delay = (cfg.proactiveDelay || 15) * 1000;
          setTimeout(function () { showTeaser(cfg.proactive); }, delay);
        }
      })
      .catch(function () {});
  }

  function mount() {
    document.body.appendChild(iframe);
    document.body.appendChild(button);
    loadConfigAndSchedule();
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
