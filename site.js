// Factory Franchise site behaviour. No dependencies.
import { initChat } from "./chat.mjs?v=32";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Menu
const menu = document.querySelector("dialog.menu");
document.querySelectorAll("[data-menu-open]").forEach(b => b.addEventListener("click", () => menu.showModal()));
document.querySelectorAll("[data-menu-close]").forEach(b => b.addEventListener("click", () => menu.close()));

// Chat is offline until explicitly enabled in page metadata.
initChat();

// Hero carousel: photo and example question rotate together.
const track = document.querySelector(".slides-track");
if (track) {
  const slides = [...track.children];
  const heroInput = document.querySelector(".hero form.ask input");
  const live = document.querySelector("#example-live");
  const pauseBtn = document.querySelector("[data-carousel=pause]");
  const bg = document.querySelector(".hero-bg");
  let i = 0, timer = null;
  const show = n => {
    i = (n + slides.length) % slides.length;
    track.style.transform = `translateX(${-100 * i}%)`;
    slides.forEach((s, k) => s.setAttribute("aria-hidden", k !== i));
    heroInput.placeholder = `Try ‘${slides[i].dataset.q}’`;
    heroInput.lang = slides[i].lang || "en";
    live.textContent = `Example ${i + 1} of ${slides.length}: ${slides[i].dataset.q}`;
    const photo = slides[i].querySelector("img");
    bg.style.backgroundImage = `url(${photo.currentSrc || photo.src})`;
  };
  const PAUSE = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const PLAY = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11l9-5.5z" fill="currentColor"/></svg>';
  const play = () => { live.setAttribute("aria-live", "off"); timer = setInterval(() => show(i + 1), 4000); pauseBtn.setAttribute("aria-label", "Pause the example questions"); pauseBtn.innerHTML = PAUSE; };
  const stop = () => { clearInterval(timer); timer = null; live.setAttribute("aria-live", "polite"); pauseBtn.setAttribute("aria-label", "Play the example questions"); pauseBtn.innerHTML = PLAY; };
  document.querySelector("[data-carousel=prev]").onclick = () => { stop(); show(i - 1); };
  document.querySelector("[data-carousel=next]").onclick = () => { stop(); show(i + 1); };
  pauseBtn.onclick = () => (timer ? stop() : play());
  heroInput.addEventListener("focus", stop);
  show(0);
  if (!reduced) play(); else stop();
}

// Manifesto: words sharpen with scroll position.
const manifesto = document.querySelector('.manifesto p[aria-hidden="true"]');
if (manifesto && !reduced) {
  const words = [...manifesto.querySelectorAll(".w")];
  const update = () => {
    const r = manifesto.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const lit = Math.round(p * words.length);
    words.forEach((w, k) => w.classList.toggle("dim", k >= lit));
  };
  document.addEventListener("scroll", update, { capture: true, passive: true }); // capture: the artifact host may scroll an element, not the window
  update();
}

// Ask bar slides in once the hero ask box is out of view.
const dockAsk = document.querySelector(".dock-ask");
const heroAsk = document.querySelector(".hero form.ask");
if (dockAsk && heroAsk) {
  new IntersectionObserver(([e]) => dockAsk.classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(heroAsk);
}

// Station tiles: label plus a white clay model of the station (img/stations/<slug>.webp).
const STATIONS = [
  [["Loader", "loader"], ["Stencil printer", "stencil-printer"], ["Solder paste inspection", "paste-inspection"], ["Pick and place", "pick-and-place"],
   ["Reflow oven · N₂", "reflow-oven"], ["Optical inspection", "optical-inspection"], ["Unloader", "unloader"], ["Conveyor", "conveyor"]],
  [["Feeder cart", "feeder-cart"], ["Dry storage", "dry-storage"], ["Stencil cleaner", "stencil-cleaner"], ["Rework station", "rework"],
   ["First-article check", "first-article"], ["Reflow profile", "reflow-profile"], ["Traceability", "traceability"], ["Line status", "line-status"]],
  [["Component purchasing", "purchasing"], ["Maintenance", "maintenance"], ["IPC-A-610 training", "ipc-training"], ["ESD zone", "esd"],
   ["Nitrogen supply", "nitrogen"], ["Compressed air", "compressed-air"], ["Three-phase power", "three-phase"], ["Acceptance test", "acceptance-test"]],
];
document.querySelectorAll(".sq-stations .drift").forEach((row, r) => {
  const tiles = STATIONS[r].map(([label, slug]) => `<span>${label}<img src="img/stations/${slug}.webp" alt="" width="88" height="88" loading="lazy" decoding="async"></span>`).join("");
  row.innerHTML = tiles + tiles; // twice, so the loop is seamless
});
document.querySelectorAll(".sq-stations").forEach(sq => {
  new IntersectionObserver(([e]) => { sq.dataset.playing = e.isIntersecting; }).observe(sq);
});

// Planned standards from the concept, not certification marks.
const SEALS = [["IPC-7711", "Rework"], ["J-STD-001", "Soldering"], ["IEC 61340", "ESD control"], ["IPC-A-610", "Assemblies"], ["ISO 9001", "Quality"],
  ["ISO 13485", "Medical"], ["EN 9100", "Aerospace"], ["IATF 16949", "Automotive"], ["ISO 14001", "Environment"]];
document.querySelectorAll(".sq-standards").forEach(sq => {
  sq.innerHTML = SEALS.map(([code, topic]) => `<div class="badge"><span>${code}<small>${topic}</small></span></div>`).join("");
});

// Stations animation pause.
document.querySelectorAll(".sq-pause").forEach(b => b.addEventListener("click", () => {
  const sq = b.closest(".squircle");
  const paused = sq.classList.toggle("paused");
  b.setAttribute("aria-label", paused ? "Play the animation" : "Pause the animation");
  b.innerHTML = paused ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>' : '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
}));

// Night sky: six groups of stars twinkling out of phase, running only while visible.
document.querySelectorAll(".sq-data").forEach(sq => {
  const sky = sq.querySelector(".sky");
  for (let g = 0; g < 6; g++) {
    let dots = "";
    for (let k = 0; k < 20; k++) dots += `<circle cx="${(Math.random() * 400).toFixed(1)}" cy="${(Math.random() * 400).toFixed(1)}" r="${k % 7 === 0 ? 0.8 : 0.4}"/>`;
    sky.insertAdjacentHTML("beforeend", `<g style="animation-duration:${10 + g}s;animation-delay:${-1.7 * g}s">${dots}</g>`);
  }
  const lock = sq.querySelector(".lock");
  new IntersectionObserver(([e]) => {
    sky.dataset.playing = e.isIntersecting;
    sq.dataset.playing = e.isIntersecting;
    if (e.intersectionRatio > 0.6) lock.dataset.visible = "true"; // shackle snaps shut once
  }, { threshold: [0, 0.6] }).observe(sq);
  const beacon = sq.querySelector(".beacon"), status = sq.querySelector("[role=status]");
  beacon.addEventListener("click", () => {
    if (reduced) return;
    const t = document.createElement("span");
    t.className = "trail";
    t.addEventListener("animationend", () => t.remove());
    beacon.append(t);
    status.textContent = "A shooting star streaks across the night sky.";
  });
});

// Roadmap: canvas scales with the page; cards lag behind scroll velocity and settle back.
const art = document.querySelector(".roadmap-art");
if (art) {
  const canvas = art.querySelector(".roadmap-canvas");
  const setScale = () => canvas.style.setProperty("--scale", art.clientWidth / 1728);
  setScale();
  new ResizeObserver(setScale).observe(art);
  if (!reduced) {
    // shortcut: decorative inertia capped at 44 px, revisit only if the artwork changes.
    // Scroll is measured from the artwork's own position, so it works whichever element scrolls.
    const top = () => art.getBoundingClientRect().top;
    let last = top(), damp = 0, still = 0, frame = 0; // last is kept between bursts, so a single wheel jump counts
    const tick = () => {
      const now = top(), delta = last - now;
      last = now;
      damp = Math.max(-44, Math.min(44, (damp + delta) * 0.82));
      canvas.style.setProperty("--damp", `${damp.toFixed(2)}px`);
      still = Math.abs(damp) < 0.3 && delta === 0 ? still + 1 : 0;
      if (still > 2) { canvas.style.setProperty("--damp", "0px"); frame = 0; return; }
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(tick); }, { capture: true, passive: true });
    addEventListener("resize", () => { last = top(); });
  }
}
