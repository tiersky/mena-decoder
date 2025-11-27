'use client';

import { useEffect } from 'react';

export default function HeyGenAvatar() {
  useEffect(() => {
    // Check if script is already loaded
    if (document.getElementById('heygen-streaming-embed')) {
      return;
    }

    const host = "https://labs.heygen.com";
    const url = host + "/guest/streaming-embed?share=eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJSaWthX0JsdWVfU3VpdF9wdWJsaWMiLCJw%0D%0AcmV2aWV3SW1nIjoiaHR0cHM6Ly9maWxlczIuaGV5Z2VuLmFpL2F2YXRhci92My9lOWE2OTMzZTEw%0D%0AZjk0MjczYTcyYTQ4NGQ5OWZmNTYxOF81NTQzMC9wcmV2aWV3X3RhbGtfMS53ZWJwIiwibmVlZFJl%0D%0AbW92ZUJhY2tncm91bmQiOnRydWUsImtub3dsZWRnZUJhc2VJZCI6IjVkMGQ3ZjRlZDY3NTQyMTg4%0D%0AZDQxYzhjZDYyZmI5YWQxIiwidXNlcm5hbWUiOiJiOWJiNjUwNTI4Yzk0MTgwOTI4ODc2MTA4NWFi%0D%0AMDYxZiJ9&inIFrame=1";

    const clientWidth = document.body.clientWidth;
    const wrapDiv = document.createElement("div");
    wrapDiv.id = "heygen-streaming-embed";

    const container = document.createElement("div");
    container.id = "heygen-streaming-container";

    const stylesheet = document.createElement("style");
    stylesheet.innerHTML = `
      #heygen-streaming-embed {
        z-index: 9999;
        position: fixed;
        right: 40px;
        bottom: 40px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.12);
        transition: all linear 0.1s;
        overflow: hidden;

        opacity: 0;
        visibility: hidden;
      }
      #heygen-streaming-embed.show {
        opacity: 1;
        visibility: visible;
      }
      #heygen-streaming-embed.expand {
        ${clientWidth < 540
          ? "height: 266px; width: 96%; left: 50%; transform: translateX(-50%);"
          : "height: 366px; width: calc(366px * 16 / 9);"
        }
        border: 0;
        border-radius: 8px;
      }
      #heygen-streaming-container {
        width: 100%;
        height: 100%;
      }
      #heygen-streaming-container iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
    `;

    const iframe = document.createElement("iframe");
    iframe.allowFullscreen = false;
    iframe.title = "Streaming Embed";
    iframe.role = "dialog";
    iframe.allow = "microphone";
    iframe.src = url;

    let visible = false;
    let initial = false;

    window.addEventListener("message", (e) => {
      if (e.origin === host && e.data && e.data.type && e.data.type === "streaming-embed") {
        if (e.data.action === "init") {
          initial = true;
          wrapDiv.classList.toggle("show", initial);
        } else if (e.data.action === "show") {
          visible = true;
          wrapDiv.classList.toggle("expand", visible);
        } else if (e.data.action === "hide") {
          visible = false;
          wrapDiv.classList.toggle("expand", visible);
        }
      }
    });

    container.appendChild(iframe);
    wrapDiv.appendChild(stylesheet);
    wrapDiv.appendChild(container);
    document.body.appendChild(wrapDiv);

    // Cleanup function
    return () => {
      const element = document.getElementById('heygen-streaming-embed');
      if (element) {
        element.remove();
      }
    };
  }, []);

  return null; // This component doesn't render anything itself
}
