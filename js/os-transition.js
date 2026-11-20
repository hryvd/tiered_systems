/**
 * TIERED SYSTEMS · Opportunity OS Launch Morph Transition
 * Morphs any clicked [data-os-launch] CTA button into the exact screen geometry
 * of the Opportunity OS .os-search-pill search bar, blooms with a luminous
 * burnt-orange/white glow while fading the backdrop to #09090b, then hands off
 * across navigation via sessionStorage so index.html fades the glow directly into
 * the live search bar.
 */

const LAUNCH_STORAGE_KEY = "ts_os_launch_morph";
const NAVIGATE_DELAY_MS = 540;

let isLaunching = false;

function computeTargetSearchRect() {
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  if (vw <= 400) {
    return { left: 8, top: 8, width: Math.max(240, vw - 16), height: 48 };
  }
  if (vw <= 768) {
    return { left: 12, top: 10, width: Math.max(240, vw - 24), height: 48 };
  }
  if (vw <= 1080) {
    return { left: 14, top: 12, width: Math.max(280, vw - 350), height: 54 };
  }
  const inspectorW = Math.min(378, Math.max(316, vw * 0.28));
  return { left: 18, top: 16, width: Math.max(320, vw - 52 - inspectorW), height: 54 };
}

function cleanupLaunchOverlay() {
  isLaunching = false;
  document.querySelectorAll(".os-launch-veil, .os-launch-pill").forEach(el => el.remove());
  document.querySelectorAll(".os-launch-origin-hidden").forEach(el => el.classList.remove("os-launch-origin-hidden"));
}

function createMorphPill(startRect, bgColor, textColor, labelText) {
  const pill = document.createElement("div");
  pill.className = "os-launch-pill";
  pill.setAttribute("aria-hidden", "true");
  pill.style.left = `${startRect.left}px`;
  pill.style.top = `${startRect.top}px`;
  pill.style.width = `${startRect.width}px`;
  pill.style.height = `${startRect.height}px`;
  pill.style.setProperty("--launch-start-bg", bgColor);
  pill.style.setProperty("--launch-start-color", textColor);

  const halo = document.createElement("div");
  halo.className = "os-launch-halo";

  const core = document.createElement("div");
  core.className = "os-launch-core";

  const btnLabel = document.createElement("span");
  btnLabel.className = "os-launch-btn-label";
  btnLabel.textContent = labelText;

  const searchGhost = document.createElement("div");
  searchGhost.className = "os-launch-search-ghost";
  searchGhost.innerHTML = `
    <span class="os-launch-ghost-badge" aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="9" ry="4" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
      </svg>
    </span>
    <span class="os-launch-ghost-label">SEARCH</span>
    <span class="os-launch-ghost-placeholder">Companies, Batangas hubs, CpE/ECE, MOA ref…</span>
  `;

  const flash = document.createElement("div");
  flash.className = "os-launch-flash";

  core.appendChild(btnLabel);
  core.appendChild(searchGhost);
  core.appendChild(flash);

  pill.appendChild(halo);
  pill.appendChild(core);
  return pill;
}

function handleLaunchClick(e, link) {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    link.target === "_blank" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    isLaunching
  ) {
    return;
  }

  e.preventDefault();
  isLaunching = true;

  const startRect = link.getBoundingClientRect();
  const targetRect = computeTargetSearchRect();
  const computed = window.getComputedStyle(link);
  const bgColor = computed.backgroundColor && computed.backgroundColor !== "rgba(0, 0, 0, 0)"
    ? computed.backgroundColor
    : "#f7f7f8";
  const textColor = computed.color || "#09090b";
  const labelText = (link.textContent || "Open Opportunity OS").replace(/\s+/g, " ").trim();

  const veil = document.createElement("div");
  veil.className = "os-launch-veil";
  veil.setAttribute("aria-hidden", "true");

  const pill = createMorphPill(startRect, bgColor, textColor, labelText);

  document.body.appendChild(veil);
  document.body.appendChild(pill);
  link.classList.add("os-launch-origin-hidden");

  void pill.offsetWidth;

  window.requestAnimationFrame(() => {
    veil.classList.add("is-active");
    pill.style.left = `${targetRect.left}px`;
    pill.style.top = `${targetRect.top}px`;
    pill.style.width = `${targetRect.width}px`;
    pill.style.height = `${targetRect.height}px`;
    pill.classList.add("is-expanding");
  });

  window.setTimeout(() => {
    try {
      sessionStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify({ ts: Date.now() }));
    } catch (_) {}
    window.location.href = link.href;
  }, NAVIGATE_DELAY_MS);
}

function initOsLaunchTransitions() {
  window.addEventListener("pageshow", cleanupLaunchOverlay);

  document.querySelectorAll("a[data-os-launch]").forEach(link => {
    if (link.dataset.osLaunchBound === "true") return;
    link.dataset.osLaunchBound = "true";
    link.addEventListener("click", e => handleLaunchClick(e, link));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOsLaunchTransitions, { once: true });
} else {
  initOsLaunchTransitions();
}

export { LAUNCH_STORAGE_KEY, computeTargetSearchRect };
