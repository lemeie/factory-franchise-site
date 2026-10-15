// Text-only AI chat. The service must be explicitly enabled in the page metadata.
const CONTACT = "hello@factory-franchise.eu";
const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 8.59 4.41 13.17 9H3v2h10.17l-4.58 4.59L10 17l7-7Z" fill="currentColor" stroke="none"/></svg>';
const STOP = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="1" fill="currentColor" stroke="none"/></svg>';
const COPY = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="3" width="9" height="11" rx="2"/><path d="M4 6v9a2 2 0 0 0 2 2h7"/></svg>';
const SOURCE_ORIGIN = "https://factory-franchise.eu";
const SOURCE_PATHS = new Set(["/how-it-works.html", "/about.html", "/faq.html", "/coming-soon.html", "/privacy.html", "/legal.html"]);
const bodySize = messages => new TextEncoder().encode(JSON.stringify({messages})).length;

export function chatEndpoint(value, base) {
  const url = new URL(value || "/api/chat", base);
  const page = new URL(base), loopback = ["localhost", "127.0.0.1", "[::1]"];
  const local = loopback.includes(page.hostname) && loopback.includes(url.hostname);
  if (url.username || url.password || !(url.protocol === "https:" || (url.protocol === "http:" && (url.origin === page.origin || local)))) throw new Error("Invalid chat endpoint");
  return url.href;
}

export function readReply(data) {
  if (!data || typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > 20000) throw new Error("Invalid chat response");
  const sources = Array.isArray(data.sources) ? data.sources.slice(0, 10).flatMap(source => {
    if (!source || typeof source.title !== "string" || typeof source.url !== "string") return [];
    try {
      const url = new URL(source.url, SOURCE_ORIGIN);
      return url.origin === SOURCE_ORIGIN && SOURCE_PATHS.has(url.pathname) && !url.search && !url.username && !url.password ? [{title: source.title.slice(0, 200), url: url.href}] : [];
    } catch { return []; }
  }) : [];
  return {answer: data.answer.trim(), sources};
}

export function buildMessages(history, question) {
  const messages = [{role: "user", content: question}];
  for (let i = history.length - 2; i >= 0 && messages.length < 11; i -= 2) {
    const pair = history.slice(i, i + 2);
    if (pair[0]?.role !== "user" || pair[1]?.role !== "assistant" || pair.some(m => typeof m.content !== "string" || m.content.length > 2000)) continue;
    if (bodySize([...pair, ...messages]) > 16384) break;
    messages.unshift(...pair);
  }
  return messages;
}

export async function requestReply(messages, endpoint, signal, onDelta) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 11 || messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 2000) || bodySize(messages) > 16384) throw new Error("Invalid messages");
  const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json", ...(onDelta ? {Accept: "text/event-stream"} : {})}, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({messages}), signal});
  if (!response.ok) throw new Error(response.status === 429 ? "rate-limit" : "service-error");
  if (!response.headers?.get("content-type")?.includes("text/event-stream")) return readReply(await response.json());
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", bytes = 0, answer = "";
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 262144) throw new Error("Invalid chat response");
      buffer += decoder.decode(value, {stream: true}).replace(/\r/g, "");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const type = event.match(/^event: *(.+)$/m)?.[1];
        const data = JSON.parse(event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n") || "null");
        if (type === "delta") {
          if (typeof data?.text !== "string" || (answer += data.text).length > 20000) throw new Error("Invalid chat response");
          onDelta?.(data.text);
        } else if (type === "done") {
          const reply = readReply(data);
          if (answer && reply.answer !== answer.trim()) throw new Error("Invalid chat response");
          return reply;
        } else if (type === "error") throw new Error("service-error");
      }
    }
    throw new Error("Incomplete chat response");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Only the formatting we ask the model for. HTML and URLs always stay literal.
export function answerMarkup(text, streaming = false) {
  if (streaming && (text.match(/\*\*/g) || []).length % 2) text += text.endsWith("*") && !text.endsWith("**") ? "*" : "**";
  const inline = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return text.split(/\n{2,}/).map(block => {
    const lines = block.split("\n");
    if (lines.every(line => /^\d+[.)] /.test(line))) return `<ol start="${Math.min(999999, Number.parseInt(lines[0], 10))}">${lines.map(line => `<li>${inline(line.replace(/^\d+[.)] /, ""))}</li>`).join("")}</ol>`;
    if (lines.every(line => /^[-*] /.test(line))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join("")}</ul>`;
    if (/^#{1,3} /.test(block)) return `<h3>${inline(block.replace(/^#{1,3} /, ""))}</h3>`;
    return `<p>${inline(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

export function emailDraft(question) {
  return `mailto:${CONTACT}?subject=${encodeURIComponent("Question about Factory Franchise")}&body=${encodeURIComponent(question)}`;
}

export function initChat() {
  const enabled = document.querySelector('meta[name="chat-enabled"]')?.content === "true";
  let endpoint;
  try { endpoint = chatEndpoint(document.querySelector('meta[name="chat-endpoint"]')?.content, location.href); } catch { /* An invalid configuration remains offline. */ }
  const chat = document.createElement("dialog");
  chat.className = "ff-chat";
  chat.setAttribute("aria-labelledby", "ff-chat-title");
  chat.innerHTML = `<a class="ff-chat-skip" href="#ff-chat-input">Skip to message input</a>
    <header class="ff-chat-header"><button type="button" class="ff-chat-brand" aria-label="Close chat and return to website">Factory Franchise</button><button type="button" class="pill pill-navy" data-chat-menu aria-haspopup="dialog">Menu</button></header>
    <div class="ff-chat-scroll"><div class="ff-chat-column">
      <h2 id="ff-chat-title" class="sr-only">Conversation with Factory Franchise</h2>
      <section class="ff-chat-intro" aria-label="About this chat"><span class="ff-chat-label">AI assistant</span><h3>What would you like to know?</h3><p>Ask about the Factory Franchise concept, the planned pilot or setting up an electronics factory.</p><p id="ff-chat-disclosure">Sending a message shares your conversation with our chat service and OpenAI. AI answers can be wrong. Do not share personal or confidential information. <a href="/legal.html#privacy-policy">Privacy details</a>.</p><p class="ff-chat-availability"${enabled && endpoint ? " hidden" : ""}>AI chat is not connected yet. You can prepare a question and email the team.</p><div class="ff-chat-suggestions" aria-label="Suggested questions"><button type="button">What is the current pilot plan?</button><button type="button">What would I need to bring?</button></div></section>
      <div class="ff-chat-messages" role="log" aria-live="off" aria-label="Conversation"></div>
    </div></div>
    <div class="ff-chat-bottom"><p class="ff-chat-notice"><a href="/legal.html#privacy-policy">Your privacy</a><span>·</span><a href="/how-it-works.html">How it works</a></p><form class="ff-chat-composer" aria-label="Send a message"><button type="button" class="ff-chat-scroll-end" aria-label="Scroll to end" hidden>${ARROW}</button><label class="sr-only" for="ff-chat-input">Message</label><div class="ff-chat-field"><textarea id="ff-chat-input" rows="1" maxlength="1000" placeholder="Ask anything…" aria-describedby="ff-chat-disclosure" autocomplete="off" required></textarea></div><div class="ff-chat-tools"><button type="submit" class="ff-chat-send" aria-label="Send message" disabled>${ARROW}</button></div></form></div>
    <p class="sr-only" role="status" aria-live="polite"></p>`;
  document.body.append(chat);
  const brand = document.querySelector(".home-link .mark");
  if (brand) chat.querySelector(".ff-chat-brand").prepend(brand.cloneNode(true));
  const menu = document.createElement("dialog");
  menu.className = "ff-chat-menu";
  menu.setAttribute("aria-label", "Chat menu");
  menu.innerHTML = `<header><span class="sr-only">Menu</span><button type="button" aria-label="Close menu">✕</button></header><nav aria-label="Website"><a href="/index.html">Home</a><a href="/how-it-works.html">How it works</a><a href="/privacy.html">Privacy</a><a href="/about.html">About</a><a href="/coming-soon.html">Coming soon</a><a href="/faq.html">FAQ</a></nav><div class="ff-chat-menu-actions"><button type="button" data-chat-new>New chat</button><button type="button" data-chat-return>Return to website</button></div><p>A private initiative. Not affiliated with any government or EU institution.</p>`;
  document.body.append(menu);
  const input = chat.querySelector("textarea"), form = chat.querySelector("form"), send = chat.querySelector(".ff-chat-send");
  const log = chat.querySelector(".ff-chat-messages"), scroll = chat.querySelector(".ff-chat-scroll");
  const endButton = chat.querySelector(".ff-chat-scroll-end");
  const updateScroll = () => { endButton.hidden = !log.children.length || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80; };
  scroll.addEventListener("scroll", updateScroll, {passive: true});
  new ResizeObserver(updateScroll).observe(log);
  endButton.addEventListener("click", () => scroll.scrollTo({top: scroll.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"}));
  const intro = chat.querySelector(".ff-chat-intro"), status = chat.querySelector('[role="status"]');
  let history = [], active = null, returnFocus, originalTitle = document.title, conversationVersion = 0;
  const resize = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; send.disabled = !active && !input.value.trim(); };
  const setBusy = busy => { send.innerHTML = busy ? STOP : ARROW; send.type = busy ? "button" : "submit"; send.setAttribute("aria-label", busy ? "Stop response" : "Send message"); input.readOnly = busy; resize(); };
  send.addEventListener("click", event => { if (active) { event.preventDefault(); if (event.detail < 2) active.abort(); } });
  const close = () => {
    active?.abort(); menu.close(); chat.close(); document.title = originalTitle;
    if (location.hash === "#chat") {
      if (window.history.state?.ffChat) window.history.back();
      else window.history.replaceState(window.history.state, "", location.pathname + location.search);
    }
    returnFocus?.focus();
  };
  const open = (question = "", push = true) => {
    if (!chat.open) { returnFocus = document.activeElement; originalTitle = document.title; document.body.classList.add("ff-chat-enter"); chat.showModal(); setTimeout(() => document.body.classList.remove("ff-chat-enter"), 400); document.title = "Chat | Factory Franchise"; }
    if (push && location.hash !== "#chat") window.history.pushState({ffChat: true}, "", "#chat");
    if (question && !active) input.value = question.slice(0, 1000);
    input.focus({preventScroll: true}); resize();
  };
  chat.querySelector(".ff-chat-brand").addEventListener("click", close);
  chat.addEventListener("cancel", event => { event.preventDefault(); close(); });
  chat.querySelector("[data-chat-menu]").addEventListener("click", () => menu.showModal());
  menu.querySelector("header button").addEventListener("click", () => menu.close());
  menu.querySelector("[data-chat-return]").addEventListener("click", close);
  menu.querySelector("[data-chat-new]").addEventListener("click", () => {
    conversationVersion++; active?.abort(); active = null; history = [];
    log.replaceChildren(); input.value = ""; intro.classList.remove("ff-chat-intro-compact");
    menu.close(); setBusy(false); scroll.scrollTop = 0; input.focus({preventScroll: true});
    status.textContent = "New chat. Previous conversation cleared from this page.";
  });
  menu.addEventListener("click", event => { if (event.target === menu) { const rect = menu.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close(); } });
  window.addEventListener("popstate", () => { if (location.hash === "#chat") open("", false); else if (chat.open) close(); });
  chat.querySelector(".ff-chat-skip").addEventListener("click", event => { event.preventDefault(); input.focus({preventScroll: true}); });
  chat.querySelectorAll(".ff-chat-suggestions button").forEach(button => button.addEventListener("click", () => { if (active) return; input.value = button.textContent; form.requestSubmit(); }));
  input.addEventListener("input", resize);
  window.addEventListener("resize", () => { if (chat.open) resize(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!active) form.requestSubmit(); } });
  const paragraph = (text, className) => { const p = document.createElement("p"); p.className = className; p.textContent = text; return p; };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (active) return;
    const question = input.value.trim();
    if (!question) return;
    intro.classList.add("ff-chat-intro-compact");
    const turn = document.createElement("section"); turn.className = "ff-chat-turn";
    turn.append(paragraph(question, "ff-chat-user"));
    const answer = document.createElement("div"); answer.className = "ff-chat-answer";
    answer.setAttribute("tabindex", "-1"); answer.setAttribute("aria-label", "Assistant response");
    turn.append(answer); log.append(turn);
    const version = conversationVersion;
    const controller = new AbortController(); active = controller;
    input.value = ""; setBusy(true);
    answer.append(paragraph("Working through your request…", "ff-chat-pending"));
    const streamed = document.createElement("div"); streamed.className = "ff-chat-answer-text";
    let streamedText = "";
    status.textContent = "Preparing your response.";
    scroll.scrollTop = Math.max(0, turn.offsetTop - (matchMedia("(min-width: 640px)").matches ? 124 : 116));
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      if (!enabled || !endpoint) throw new Error("offline");
      const messages = buildMessages(history, question);
      const reply = await requestReply(messages, endpoint, controller.signal, text => {
        if (version !== conversationVersion || controller.signal.aborted) return;
        if (!streamed.isConnected) answer.replaceChildren(streamed);
        let previousLength = streamed.textContent.length;
        streamedText += text;
        streamed.innerHTML = answerMarkup(streamedText, true);
        const walker = document.createTreeWalker(streamed, NodeFilter.SHOW_TEXT), nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
          const length = node.textContent.length, keep = Math.max(0, Math.min(previousLength, length));
          previousLength -= length;
          if (keep === length) return;
          const fresh = document.createElement("span"); fresh.className = "ff-chat-token"; fresh.textContent = node.textContent.slice(keep);
          node.replaceWith(document.createTextNode(node.textContent.slice(0, keep)), fresh);
        });
      });
      if (version !== conversationVersion) return;
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      history = [...messages, {role: "assistant", content: reply.answer}];
      const rendered = document.createElement("div"); rendered.className = "ff-chat-answer-text"; rendered.innerHTML = answerMarkup(reply.answer);
      answer.replaceChildren(rendered);
      const actions = document.createElement("div"); actions.className = "ff-chat-actions"; actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Message actions");
      answer.append(actions);
      if (reply.sources.length) {
        const sources = document.createElement("ul"); sources.className = "ff-chat-sources"; sources.setAttribute("aria-label", "Sources");
        reply.sources.forEach(source => { const li = document.createElement("li"), a = document.createElement("a"); a.href = source.url; a.textContent = source.title || "Source"; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", `${source.title || "Source"} (opens in a new tab)`); li.append(a); sources.append(li); });
        const details = document.createElement("details"); details.className = "ff-chat-source-panel";
        const toggle = document.createElement("summary"); toggle.className = "ff-chat-source-toggle"; toggle.innerHTML = '<img src="/favicon.svg?v=34" alt="">Sources';
        details.append(toggle, sources); actions.append(details);
      }
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "ff-chat-copy"; copy.setAttribute("aria-label", "Copy"); copy.innerHTML = COPY; copy.title = "Copy response";
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(reply.answer); status.textContent = "Response copied."; copy.setAttribute("aria-label", "Copied"); copy.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>'; setTimeout(() => { copy.innerHTML = COPY; copy.setAttribute("aria-label", "Copy"); }, 1500); } catch { status.textContent = "Copy is unavailable. Select the response text to copy it."; } });
      actions.append(copy);
      const followups = document.createElement("div"); followups.className = "ff-chat-followups"; followups.setAttribute("role", "group"); followups.setAttribute("aria-label", "Suggested follow-ups");
      ["What would I need to bring?", "What is the current pilot plan?", "How do I contact the team?"].filter(text => text !== question).forEach(text => {
        const button = document.createElement("button"); button.type = "button"; button.textContent = text;
        button.addEventListener("click", () => { if (active) return; input.value = text; form.requestSubmit(); }); followups.append(button);
      });
      answer.append(followups); status.textContent = "Response ready. Sources and suggested follow-ups are available.";
    } catch (error) {
      if (version !== conversationVersion) return;
      let message = "The AI service could not answer. Please try again, or email the team.";
      if (error.message === "offline") message = "AI chat is not connected yet. No message was sent to an AI service. Email the team for an answer.";
      else if (error.message === "rate-limit") message = "The chat has reached its request limit. Please try again later, or email the team.";
      else if (timedOut) message = "The response took too long. Please try again, or email the team.";
      else if (error.name === "AbortError") message = "Response stopped. You can edit your question and try again.";
      answer.replaceChildren(paragraph(message, "ff-chat-error"));
      const email = document.createElement("a"); email.href = emailDraft(question); email.textContent = "Open an email draft"; answer.append(email);
      input.value = question; status.textContent = message;
    } finally {
      clearTimeout(timeout);
      if (version === conversationVersion) {
        active = null; setBusy(false);
        if (chat.open && !menu.open) input.focus({preventScroll: true});
      }
    }
  });
  document.querySelectorAll("form.ask").forEach(entry => {
    const notice = document.createElement("p"); notice.className = "ff-entry-notice";
    notice.innerHTML = 'AI answers may be wrong. Messages go to OpenAI. <a href="/legal.html#privacy-policy">Privacy</a>';
    entry.append(notice);
    entry.querySelector("button[type=submit]")?.setAttribute("aria-label", "Send message");
    entry.addEventListener("submit", event => {
      event.preventDefault();
      if (active) { open(); return; }
      const field = entry.querySelector("input");
      const example = document.querySelector('.slide[aria-hidden="false"]');
      const question = field.value.trim() || (entry.closest(".hero") && example ? example.dataset.q : "");
      open(question);
      if (question) { field.value = ""; form.requestSubmit(); }
    });
  });
  if (location.hash === "#chat") open("", false);
}
