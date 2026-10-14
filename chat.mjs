// Text-only AI chat. The service must be explicitly enabled in the page metadata.
const CONTACT = "hello@factory-franchise.eu";
const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5.5 15.5 10 11 14.5"/></svg>';
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

export async function requestReply(messages, endpoint, signal) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 11 || messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 2000) || bodySize(messages) > 16384) throw new Error("Invalid messages");
  const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({messages}), signal});
  if (!response.ok) throw new Error(response.status === 429 ? "rate-limit" : "service-error");
  return readReply(await response.json());
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
      <section class="ff-chat-intro" aria-label="About this chat"><span class="ff-chat-label">AI assistant</span><h3>What would you like to know?</h3><p>Ask about the Factory Franchise concept, the planned pilot or setting up an electronics factory.</p><p id="ff-chat-disclosure">When AI chat is enabled, sending a message shares your conversation with our chat service and OpenAI. AI answers can be wrong. Do not share personal or confidential information. <a href="/legal.html#privacy-policy">Privacy details</a>.</p><p class="ff-chat-availability"${enabled && endpoint ? " hidden" : ""}>AI chat is not connected yet. You can prepare a question and email the team.</p><div class="ff-chat-suggestions" aria-label="Suggested questions"><button type="button">What is the current pilot plan?</button><button type="button">What would I need to bring?</button></div></section>
      <div class="ff-chat-messages" role="log" aria-live="off" aria-label="Conversation"></div>
    </div></div>
    <div class="ff-chat-bottom"><form class="ff-chat-composer" aria-label="Send a message"><label class="sr-only" for="ff-chat-input">Message</label><textarea id="ff-chat-input" rows="1" maxlength="1000" placeholder="Ask anything..." aria-describedby="ff-chat-disclosure" autocomplete="off" required></textarea><div class="ff-chat-tools"><span class="ff-chat-input-label">AI assistant</span><button type="submit" class="ff-chat-send" aria-label="Send message" disabled>${ARROW}</button></div></form><p class="ff-chat-footnote">AI answers may be inaccurate. <a href="/legal.html#privacy-policy">Privacy</a></p></div>
    <p class="sr-only" role="status" aria-live="polite"></p>`;
  document.body.append(chat);
  const brand = document.querySelector(".home-link .mark");
  if (brand) chat.querySelector(".ff-chat-brand").prepend(brand.cloneNode(true));
  const menu = document.createElement("dialog");
  menu.className = "ff-chat-menu";
  menu.setAttribute("aria-label", "Chat menu");
  menu.innerHTML = `<header><span>Menu</span><button type="button" aria-label="Close menu">✕</button></header><nav aria-label="Website"><a href="/index.html">Home</a><a href="/how-it-works.html">How it works</a><a href="/privacy.html">Privacy</a><a href="/about.html">About</a><a href="/coming-soon.html">Coming soon</a><a href="/faq.html">FAQ</a></nav><div class="ff-chat-menu-actions"><button type="button" data-chat-new>New chat</button><button type="button" data-chat-return>Return to website</button></div><p>A private initiative. Not affiliated with any government or EU institution.</p>`;
  document.body.append(menu);
  const input = chat.querySelector("textarea"), form = chat.querySelector("form"), send = chat.querySelector(".ff-chat-send");
  const log = chat.querySelector(".ff-chat-messages"), scroll = chat.querySelector(".ff-chat-scroll");
  const intro = chat.querySelector(".ff-chat-intro"), status = chat.querySelector('[role="status"]');
  let history = [], active = null, returnFocus, originalTitle = document.title, conversationVersion = 0;
  const resize = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; send.disabled = !active && !input.value.trim(); };
  const setBusy = busy => { send.innerHTML = busy ? STOP : ARROW; send.type = busy ? "button" : "submit"; send.setAttribute("aria-label", busy ? "Stop response" : "Send message"); input.readOnly = busy; resize(); };
  send.addEventListener("click", event => { if (active) { event.preventDefault(); active.abort(); } });
  const close = () => {
    active?.abort(); menu.close(); chat.close(); document.title = originalTitle;
    if (location.hash === "#chat") {
      if (window.history.state?.ffChat) window.history.back();
      else window.history.replaceState(window.history.state, "", location.pathname + location.search);
    }
    returnFocus?.focus();
  };
  const open = (question = "", push = true) => {
    if (!chat.open) { returnFocus = document.activeElement; originalTitle = document.title; chat.showModal(); document.title = "Chat | Factory Franchise"; }
    if (push && location.hash !== "#chat") window.history.pushState({ffChat: true}, "", "#chat");
    if (question && !active) input.value = question.slice(0, 1000);
    input.focus(); resize();
  };
  chat.querySelector(".ff-chat-brand").addEventListener("click", close);
  chat.addEventListener("cancel", event => { event.preventDefault(); close(); });
  chat.querySelector("[data-chat-menu]").addEventListener("click", () => menu.showModal());
  menu.querySelector("header button").addEventListener("click", () => menu.close());
  menu.querySelector("[data-chat-return]").addEventListener("click", close);
  menu.querySelector("[data-chat-new]").addEventListener("click", () => {
    conversationVersion++; active?.abort(); active = null; history = [];
    log.replaceChildren(); input.value = ""; intro.classList.remove("ff-chat-intro-compact");
    menu.close(); setBusy(false); scroll.scrollTop = 0; input.focus();
    status.textContent = "New chat. Previous conversation cleared from this page.";
  });
  menu.addEventListener("click", event => { if (event.target === menu) { const rect = menu.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close(); } });
  window.addEventListener("popstate", () => { if (location.hash === "#chat") open("", false); else if (chat.open) close(); });
  chat.querySelector(".ff-chat-skip").addEventListener("click", event => { event.preventDefault(); input.focus(); });
  chat.querySelectorAll(".ff-chat-suggestions button").forEach(button => button.addEventListener("click", () => { input.value = button.textContent; input.focus(); resize(); }));
  input.addEventListener("input", resize);
  window.addEventListener("resize", () => { if (chat.open) resize(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!active) form.requestSubmit(); } });
  const paragraph = (text, className) => { const p = document.createElement("p"); p.className = className; p.textContent = text; return p; };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (active) { active.abort(); return; }
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
    status.textContent = "Preparing your response.";
    scroll.scrollTop = Math.max(0, turn.offsetTop - 112);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      if (!enabled || !endpoint) throw new Error("offline");
      const messages = buildMessages(history, question);
      const reply = await requestReply(messages, endpoint, controller.signal);
      if (version !== conversationVersion) return;
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      history = [...messages, {role: "assistant", content: reply.answer}];
      answer.replaceChildren(paragraph(reply.answer, "ff-chat-answer-text"));
      if (reply.sources.length) {
        const sources = document.createElement("ul"); sources.className = "ff-chat-sources"; sources.setAttribute("aria-label", "Sources");
        reply.sources.forEach(source => { const li = document.createElement("li"), a = document.createElement("a"); a.href = source.url; a.textContent = source.title || "Source"; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", `${source.title || "Source"} (opens in a new tab)`); li.append(a); sources.append(li); });
        answer.append(sources);
      }
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "ff-chat-copy"; copy.setAttribute("aria-label", "Copy response"); copy.innerHTML = COPY;
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(reply.answer); status.textContent = "Response copied."; } catch { status.textContent = "Copy is unavailable. Select the response text to copy it."; } });
      answer.append(copy); status.textContent = "Response ready.";
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
  document.querySelectorAll("form.ask").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault(); const field = form.querySelector("input");
    const example = document.querySelector('.slide[aria-hidden="false"]');
    open(field.value.trim() || (form.closest(".hero") && example ? example.dataset.q : ""));
  }));
  if (location.hash === "#chat") open("", false);
}
