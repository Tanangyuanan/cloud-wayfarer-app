(() => {
  "use strict";

  const STORAGE_KEY = "cloud_wayfarer-ajing-chat-v1";
  const JOURNEY_KEY = "cloud_wayfarer-personal-journey-id";
  const USER_MEMORY_KEY = "cloud_wayfarer-user-memory-id-v1";
  const AVATAR_URL = "/prototype/assets/ajing-avatar-v1.png";
  const LOCATION_IDS = {
    "贵阳": "guiyang", "青岩": "qingyan", "修文": "xiuwen", "安顺": "anshun", "黄果树": "huangguoshu",
    "织金": "zhijin", "毕节": "bijie", "威宁": "weining", "六盘水": "liupanshui", "兴义": "xingyi",
    "荔波": "libo", "都匀": "duyun", "凯里": "kaili", "西江": "xijiang", "镇远": "zhenyuan",
    "铜仁": "tongren", "梵净山": "fanjingshan", "遵义": "zunyi", "海龙屯": "hailongtun", "茅台": "maotai", "赤水": "chishui"
  };
  let messages = loadMessages();
  let isSending = false;
  let previousFocus = null;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function inlineMarkdown(value) {
    const tokens = [];
    const hold = (html) => {
      const marker = `\uE000${tokens.length}\uE001`;
      tokens.push(html);
      return marker;
    };
    let source = String(value || "");
    source = source.replace(/`([^`\n]+)`/g, (_match, code) => hold(`<code>${escapeHtml(code)}</code>`));
    source = source.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, rawUrl) => {
      try {
        const url = new URL(rawUrl, window.location.href);
        if (!["http:", "https:"].includes(url.protocol)) return match;
        return hold(`<a href="${escapeHtml(url.href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`);
      } catch { return match; }
    });
    let html = escapeHtml(source)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    tokens.forEach((token, index) => { html = html.replace(`\uE000${index}\uE001`, token); });
    return html;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let index = 0;
    const special = (line) => /^(?:```|#{1,4}\s|>\s?|[-*]\s+|\d+[.)]\s+|\s*$)/.test(line);
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (line.startsWith("```")) {
        const language = line.slice(3).trim().replace(/[^a-z0-9_-]/gi, "");
        const code = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
        if (index < lines.length) index += 1;
        blocks.push(`<pre><code${language ? ` class="language-${language}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(heading[1].length + 2, 6);
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
        blocks.push(`<blockquote>${quote.map(inlineMarkdown).join("<br>")}</blockquote>`);
        continue;
      }
      const list = line.match(/^([-*]|\d+[.)])\s+(.+)$/);
      if (list) {
        const ordered = /^\d/.test(list[1]);
        const items = [];
        const pattern = ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*]\s+(.+)$/;
        while (index < lines.length) {
          const item = lines[index].match(pattern);
          if (!item) break;
          items.push(`<li>${inlineMarkdown(item[1])}</li>`);
          index += 1;
        }
        blocks.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      const paragraph = [line];
      index += 1;
      while (index < lines.length && !special(lines[index])) paragraph.push(lines[index++]);
      blocks.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
    }
    return blocks.join("");
  }

  function renderMarkdown(element, text) {
    element.innerHTML = markdownToHtml(text);
  }

  async function readEventStream(response, onEvent) {
    if (!response.body) throw new Error("stream_unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const consume = (block) => {
      let event = "message";
      const data = [];
      block.split(/\r?\n/).forEach((line) => {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      });
      if (!data.length) return;
      let payload;
      try { payload = JSON.parse(data.join("\n")); } catch { return; }
      onEvent(event, payload);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  }

  function loadMessages() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.slice(-20) : [];
    } catch { return []; }
  }

  function saveMessages() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); } catch { /* 本次页面内仍可继续。 */ }
  }

  function detectLocationId() {
    const candidates = [
      document.querySelector("#agent-live-place")?.textContent,
      document.querySelector("#now-location")?.textContent,
      document.querySelector("#workspace-agent-location")?.textContent,
      document.querySelector("#journey-title")?.textContent
    ].filter(Boolean).join(" ");
    for (const [name, id] of Object.entries(LOCATION_IDS)) if (candidates.includes(name)) return id;
    return "guiyang";
  }

  function journeyId() {
    try { return localStorage.getItem(JOURNEY_KEY) || null; } catch { return null; }
  }

  function userMemoryId() {
    try {
      let id = localStorage.getItem(USER_MEMORY_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(USER_MEMORY_KEY, id);
      }
      return id;
    } catch { return null; }
  }

  function recentConversationHistory() {
    let remaining = 16000;
    const history = [];
    for (const message of messages.slice(0, -1).slice(-20).reverse()) {
      if (!['user', 'assistant'].includes(message.role) || message.retryText) continue;
      const content = String(message.text || "").trim().slice(0, 1200);
      if (!content || remaining <= 0) continue;
      const clipped = content.slice(-remaining);
      history.unshift({ role: message.role, content: clipped });
      remaining -= clipped.length;
    }
    return history;
  }

  const root = node("section", "ajing-chat-root");
  root.setAttribute("aria-label", "阿镜聊天入口");
  root.innerHTML = `
    <div class="ajing-chat-backdrop" data-ajing-close aria-hidden="true"></div>
    <section class="ajing-chat-panel" id="ajing-chat-panel" role="dialog" aria-modal="true" aria-labelledby="ajing-chat-title" aria-hidden="true">
      <header class="ajing-chat-header">
        <img src="${AVATAR_URL}" alt="阿镜的角色头像">
        <div class="ajing-chat-title"><p id="ajing-chat-title">阿镜</p><span>在路上，也在听你说</span></div>
        <button class="ajing-chat-close" type="button" data-ajing-close aria-label="关闭与阿镜的聊天">×</button>
      </header>
      <div class="ajing-chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
      <footer class="ajing-chat-footer">
        <form class="ajing-chat-form">
          <textarea rows="1" maxlength="800" aria-label="给阿镜发消息" placeholder="问景点、地方故事，或者问问她……"></textarea>
          <button type="submit" aria-label="发送给阿镜">↑</button>
        </form>
        <p class="ajing-chat-note">涉及事实，我会尽量给出处；没把握的，我会直说。</p>
      </footer>
    </section>
    <button class="ajing-chat-launcher" type="button" aria-controls="ajing-chat-panel" aria-expanded="false" aria-label="和阿镜聊聊">
      <img src="${AVATAR_URL}" alt=""><span>有想知道的，问我吧</span><i aria-hidden="true"></i>
    </button>`;
  document.body.append(root);

  const panel = root.querySelector(".ajing-chat-panel");
  const launcher = root.querySelector(".ajing-chat-launcher");
  const log = root.querySelector(".ajing-chat-log");
  const form = root.querySelector(".ajing-chat-form");
  const input = form.querySelector("textarea");
  const submit = form.querySelector("button");

  function sourceElement(source) {
    const label = source.title || "资料来源";
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("unsupported");
      const link = node("a", "", label);
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      return link;
    } catch { return node("span", "", label); }
  }

  function messageElement(message, options = {}) {
    const row = node("article", `ajing-chat-message ${message.role === "user" ? "is-user" : "is-ajing"}${options.loading ? " is-loading" : ""}`);
    if (message.role !== "user") {
      const avatar = document.createElement("img");
      avatar.src = AVATAR_URL;
      avatar.alt = "";
      row.append(avatar);
    }
    const bubble = node("div", "ajing-chat-bubble");
    bubble.append(node("small", "", message.role === "user" ? "你" : options.loading ? "阿镜 · 正在想" : options.streaming ? "阿镜 · 正在写" : "阿镜"));
    const copy = node(message.role === "user" ? "p" : "div", `ajing-chat-copy${message.role === "user" ? "" : " ajing-chat-markdown"}`);
    if (message.role === "user") copy.textContent = message.text;
    else renderMarkdown(copy, message.text);
    bubble.append(copy);
    if (message.retryText) {
      const retry = node("button", "ajing-chat-retry", "再试一次");
      retry.type = "button";
      retry.addEventListener("click", () => retryFailed(message));
      bubble.append(retry);
    }
    if (message.sources?.length) {
      const sourceList = node("div", "ajing-chat-sources");
      message.sources.slice(0, 4).forEach((source) => sourceList.append(sourceElement(source)));
      bubble.append(sourceList);
    }
    row.append(bubble);
    return row;
  }

  function renderMessages() {
    log.replaceChildren();
    if (!messages.length) {
      log.append(messageElement({
        role: "assistant",
        text: "我在。你可以问眼前的地方，也可以问我这一路为什么这样走。想先从哪儿开始？"
      }));
    } else messages.forEach((message) => log.append(messageElement(message)));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  }

  function setOpen(open) {
    root.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    if (open) {
      previousFocus = document.activeElement;
      window.setTimeout(() => input.focus({ preventScroll: true }), 120);
    } else if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
  }

  function friendlyError(error) {
    if (error?.name === "AbortError") return "这次等得有点久。我还在，过一会儿再问我一次。";
    return "刚才没连上。你的话还在，点一下“再试一次”就好。";
  }

  function syncSubmitState() {
    submit.disabled = isSending || !input.value.trim();
  }

  function retryFailed(failedMessage) {
    if (isSending) return;
    const index = messages.indexOf(failedMessage);
    if (index >= 0) {
      messages.splice(index, 1);
      const previous = messages[index - 1];
      if (previous?.role === "user" && previous.text === failedMessage.retryText) messages.splice(index - 1, 1);
      saveMessages();
      renderMessages();
    }
    sendMessage(failedMessage.retryText);
  }

  async function sendMessage(rawText) {
    const text = String(rawText || input.value).trim();
    if (isSending || text.length < 1) {
      if (!isSending) input.focus();
      return;
    }
    isSending = true;
    input.value = "";
    resizeInput();
    submit.disabled = true;
    const userMessage = { role: "user", text };
    messages.push(userMessage);
    log.append(messageElement(userMessage));
    const loading = messageElement({ role: "assistant", text: "我在听" }, { loading: true });
    let activeReply = loading;
    log.append(loading);
    log.scrollTop = log.scrollHeight;

    const controller = new AbortController();
    const waiting = window.setTimeout(() => {
      const copy = loading.querySelector(".ajing-chat-copy");
      if (copy) copy.textContent = "我还在找，稍等一下";
    }, 7000);
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({
          question: text,
          locationId: detectLocationId(),
          journeyId: journeyId(),
          memoryId: userMemoryId(),
          conversationHistory: recentConversationHistory(),
          stream: true
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message || `请求失败（${response.status}）`);
      }
      let payload = null;
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const streamed = { role: "assistant", text: "", sources: [] };
        const streamedRow = messageElement(streamed, { streaming: true });
        loading.replaceWith(streamedRow);
        activeReply = streamedRow;
        const streamedCopy = streamedRow.querySelector(".ajing-chat-copy");
        let streamError = null;
        await readEventStream(response, (event, data) => {
          if (event === "delta" && data.delta) {
            streamed.text += data.delta;
            renderMarkdown(streamedCopy, streamed.text);
            log.scrollTop = log.scrollHeight;
          } else if (event === "final") payload = data;
          else if (event === "error") streamError = new Error(data.error?.message || "stream_failed");
        });
        if (streamError) throw streamError;
        if (!payload?.ok) throw new Error("stream_incomplete");
        streamed.text = payload.answer || streamed.text || "我这次没能把答案带回来。";
        streamed.sources = payload.sources || [];
        const completedRow = messageElement(streamed);
        streamedRow.replaceWith(completedRow);
        activeReply = completedRow;
      } else {
        payload = await response.json().catch(() => ({}));
        if (payload.ok === false) throw new Error(payload.error?.message || "请求失败");
        const completedRow = messageElement({ role: "assistant", text: payload.answer || "我这次没能把答案带回来。", sources: payload.sources || [] });
        loading.replaceWith(completedRow);
        activeReply = completedRow;
      }
      const answer = { role: "assistant", text: payload.answer || "我这次没能把答案带回来。", sources: payload.sources || [] };
      messages.push(answer);
      saveMessages();
    } catch (error) {
      const answer = { role: "assistant", text: friendlyError(error), sources: [], retryText: text };
      messages.push(answer);
      activeReply.replaceWith(messageElement(answer));
      saveMessages();
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(waiting);
      isSending = false;
      syncSubmitState();
      input.focus({ preventScroll: true });
      log.scrollTop = log.scrollHeight;
    }
  }

  launcher.addEventListener("click", () => setOpen(!root.classList.contains("is-open")));
  root.querySelectorAll("[data-ajing-close]").forEach((item) => item.addEventListener("click", () => setOpen(false)));
  form.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(); });
  input.addEventListener("input", () => { resizeInput(); syncSubmitState(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("is-open")) {
      event.stopImmediatePropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Tab" && root.classList.contains("is-open")) {
      const focusable = [...panel.querySelectorAll("button:not([disabled]), textarea, a[href]")].filter((item) => item.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, true);

  renderMessages();
  syncSubmitState();
})();
