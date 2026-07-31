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

  var GRADIENT = "linear-gradient(135deg, #7C3AED, #06B6D4)";
  var open = false;

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/widget/" + encodeURIComponent(channelId);
  iframe.title = "SpirChat";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText = [
    "position:fixed",
    "bottom:96px",
    "right:20px",
    "width:380px",
    "height:600px",
    "max-width:calc(100vw - 40px)",
    "max-height:calc(100vh - 130px)",
    "border:none",
    "border-radius:16px",
    "box-shadow:0 12px 40px rgba(0,0,0,0.18)",
    "z-index:2147483646",
    "display:none",
    "background:#fff",
  ].join(";");

  var button = document.createElement("button");
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText = [
    "position:fixed",
    "bottom:20px",
    "right:20px",
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

  button.addEventListener("click", function () {
    open = !open;
    iframe.style.display = open ? "block" : "none";
    button.innerHTML = open ? closeIcon : chatIcon;
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  });
  button.addEventListener("mouseenter", function () {
    button.style.transform = "scale(1.06)";
  });
  button.addEventListener("mouseleave", function () {
    button.style.transform = "scale(1)";
  });

  function mount() {
    document.body.appendChild(iframe);
    document.body.appendChild(button);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
