/**
 * Tiered Systems · Dynamic Landing Page Controller
 * Includes:
 * 1. 3D Card Gyro / Mouse Perspective Tilts
 * 2. Animated Number Counter Tickers
 * 3. Dynamic In-Page Program & Campus Filter
 * 4. 3D WebGL Orbital Stage Sync
 * 5. Live Manila Event Countdown & Status
 */

(function () {
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
  const EVENT_DAYS = [
    { day: 1, date: "2026-11-18", start: "2026-11-18T13:00:00+08:00", end: "2026-11-18T17:00:00+08:00", where: "on Zoom" },
    { day: 2, date: "2026-11-25", start: "2026-11-25T13:00:00+08:00", end: "2026-11-25T17:00:00+08:00", where: "at the 5th Floor STEER Hub" }
  ];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cachedCompanies = [];
  let previewMapInstance = null;
  let previewMarkersLayer = null;

  function haversineKm(a, b) {
    const R = 6371;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function manilaDateString(ms) {
    return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
  }

  /* Nav border on scroll & Mobile Drawer ---------------------------------- */
  function initNav() {
    const nav = document.getElementById("nav");
    if (nav) {
      const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const toggle = document.getElementById("mobile-nav-toggle");
    const links = document.getElementById("primary-nav-links");
    if (!toggle || !links) return;

    const closeMenu = () => {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", e => {
      e.stopPropagation();
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    links.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));

    document.addEventListener("click", e => {
      if (links.classList.contains("is-open") && !links.contains(e.target) && !toggle.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* Live event status ---------------------------------------------------- */
  function initEventStatus() {
    const statusEl = document.getElementById("event-status");
    const textEl = document.getElementById("event-status-text");
    if (!statusEl || !textEl) return;

    function update() {
      const now = Date.now();
      const today = manilaDateString(now);
      let text = "";
      let state = "";

      const live = EVENT_DAYS.find(d => now >= Date.parse(d.start) && now < Date.parse(d.end));
      const next = EVENT_DAYS.find(d => now < Date.parse(d.start));

      if (live) {
        text = `Live now: Day ${live.day} ${live.where}, until 5:00 PM`;
        state = "is-live";
      } else if (next) {
        const tomorrow = manilaDateString(now + 24 * 60 * 60 * 1000);
        const when = next.date === today ? "today" : next.date === tomorrow ? "tomorrow" : next.day === 1 ? "Nov 18" : "Nov 25";
        text = `Day ${next.day} starts ${when} at 1:00 PM ${next.where}`;
        state = "is-soon";
      } else {
        text = "The event has concluded. The Opportunity Board remains active.";
      }

      statusEl.classList.remove("is-live", "is-soon");
      if (state) statusEl.classList.add(state);
      textEl.textContent = text;

      EVENT_DAYS.forEach(d => {
        const card = document.getElementById(`day-${d.day}`);
        if (!card) return;
        const badge = card.querySelector("[data-day-badge]");
        const isLive = live && live.day === d.day;
        const isDone = now >= Date.parse(d.end);
        const isToday = d.date === today;

        card.classList.toggle("is-today", isToday && !isDone);
        if (badge) {
          badge.classList.toggle("is-live", Boolean(isLive));
          if (isLive) { badge.hidden = false; badge.textContent = "Live now"; }
          else if (isToday && !isDone) { badge.hidden = false; badge.textContent = "Today"; }
          else if (isDone) { badge.hidden = false; badge.textContent = "Concluded"; badge.classList.remove("is-live"); }
          else { badge.hidden = true; }
        }

        const rows = card.querySelectorAll(".timeline li");
        rows.forEach(r => r.classList.remove("is-now"));
        if (isLive) {
          const clock = new Date(now + MANILA_OFFSET_MS);
          const nowMin = clock.getUTCHours() * 60 + clock.getUTCMinutes();
          let current = null;
          rows.forEach(r => {
            const timeSpan = r.querySelector(".t");
            if (timeSpan) {
              const [h, m] = timeSpan.textContent.split(":").map(Number);
              const minutes = (h < 12 ? h + 12 : h) * 60 + m;
              if (minutes <= nowMin) current = r;
            }
          });
          if (current) current.classList.add("is-now");
        }
      });
    }

    update();
    setInterval(update, 30 * 1000);
  }

  /* Flat Card Mode (No 3D Perspective Tilt) ------------------------------ */
  function init3DTilt() {}

  /* Animated Number Counter Tickers -------------------------------------- */
  function initCounters() {
    const counters = document.querySelectorAll(".js-counter");
    if (!counters.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target, 10);
          if (isNaN(target)) return;

          let start = 0;
          const duration = reduceMotion ? 100 : 1200;
          const startTime = performance.now();

          function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * ease);
            el.textContent = current;
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = target + (el.id === "fact-partners" ? "+" : el.id === "fact-slots" ? "+" : "");
            }
          }

          requestAnimationFrame(step);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.25 });

    counters.forEach(c => observer.observe(c));
  }

  /* Tier Tabs & 3D WebGL Synchronization --------------------------------- */
  function initTiers() {
    const tabs = Array.from(document.querySelectorAll(".tier-tab"));
    if (!tabs.length) return;

    function select(tab, focus) {
      const tierNum = parseInt(tab.dataset.tier, 10) || 1;

      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });

      // Synchronize with 3D model
      if (typeof window.set3DActiveTier === "function") {
        window.set3DActiveTier(tierNum);
      }

      // Sync stage buttons in 3D section
      document.querySelectorAll(".tier-stage-btn, .orbit-stage-item").forEach(btn => {
        const stageNum = parseInt(btn.dataset.stageTier || btn.dataset.orbitTier, 10);
        btn.classList.toggle("active", stageNum === tierNum);
      });

      if (focus) tab.focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", e => {
        let target = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") target = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") target = tabs[0];
        if (e.key === "End") target = tabs[tabs.length - 1];
        if (target) { e.preventDefault(); select(target, true); }
      });
    });

    // Tier stage click triggers (synchronized with 3D model and Roadmap tabs)
    document.querySelectorAll(".tier-stage-btn, .orbit-stage-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const tierNum = parseInt(btn.dataset.stageTier || btn.dataset.orbitTier, 10);
        document.querySelectorAll(".tier-stage-btn, .orbit-stage-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        if (typeof window.set3DActiveTier === "function") {
          window.set3DActiveTier(tierNum);
        }

        const correspondingTab = document.querySelector(`.tier-tab[data-tier="${tierNum}"]`);
        if (correspondingTab) select(correspondingTab, false);
      });
    });
  }

  /* Data-driven sections & Dynamic Landing Filter ------------------------ */
  function renderFacts(companies) {
    const hubs = new Set(companies.map(c => c.hub).filter(Boolean));
    const totalSlots = companies.reduce((sum, c) => sum + (c.slots || 0), 0);

    const partnersCounter = document.getElementById("fact-partners");
    if (partnersCounter) {
      partnersCounter.dataset.target = companies.length;
      partnersCounter.textContent = `${companies.length}+`;
    }

    const slotsCounter = document.getElementById("fact-slots");
    if (slotsCounter) {
      slotsCounter.dataset.target = totalSlots;
      slotsCounter.textContent = `${totalSlots}+`;
    }

    const previewCount = document.getElementById("preview-count");
    if (previewCount) previewCount.textContent = `${companies.length} verified partners`;

    const tableSlots = document.getElementById("table-total-slots");
    if (tableSlots) tableSlots.textContent = `${totalSlots} open slots`;
  }

  function renderPreviewList(companies, origin) {
    const list = document.getElementById("preview-list");
    if (!list) return;

    const nearest = companies
      .map(c => ({ c, km: haversineKm(origin, c) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);

    if (nearest.length === 0) {
      list.innerHTML = `<li class="preview-item"><span class="preview-name">No partners match selected discipline.</span></li>`;
      return;
    }

    list.innerHTML = nearest
      .map(({ c, km }) => `
        <li class="preview-item">
          <span class="preview-name">${escapeHtml(c.name)}</span>
          <span class="preview-dist num">${km.toFixed(1)} km</span>
        </li>`)
      .join("");
  }

  function renderHubTable(companies) {
    const tbody = document.getElementById("hub-table");
    if (!tbody) return;

    const groups = new Map();
    companies.forEach(c => {
      const key = c.hub || "Other";
      const g = groups.get(key) || { partners: 0, slots: 0 };
      g.partners += 1;
      g.slots += Number(c.slots) || 0;
      groups.set(key, g);
    });

    const rows = Array.from(groups.entries()).sort((a, b) => b[1].partners - a[1].partners || a[0].localeCompare(b[0]));
    const totalSlots = rows.reduce((s, [, g]) => s + g.slots, 0);

    tbody.innerHTML = rows
      .map(([hub, g]) => `
        <tr>
          <td>${escapeHtml(hub)}</td>
          <td class="t-right num">${g.partners}</td>
          <td class="t-right num">${g.slots}</td>
        </tr>`)
      .join("");

    const tfoot = document.createElement("tfoot");
    tfoot.innerHTML = `<tr><td>Total Capacity</td><td class="t-right num">${companies.length}</td><td class="t-right num">${totalSlots}</td></tr>`;
    tbody.parentElement.querySelector("tfoot")?.remove();
    tbody.parentElement.appendChild(tfoot);
  }

  function renderPreviewMap(companies, origin) {
    const skeleton = document.getElementById("map-skeleton");
    const done = () => skeleton && skeleton.classList.add("is-done");

    if (!window.L || !document.getElementById("preview-map")) { done(); return; }

    if (!previewMapInstance) {
      previewMapInstance = L.map("preview-map", {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        attributionControl: true
      });

      const base = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Esri", maxZoom: 16 }
      ).addTo(previewMapInstance);
      base.once("load", done);
      setTimeout(done, 3000);

      previewMarkersLayer = L.layerGroup().addTo(previewMapInstance);
    }

    if (previewMarkersLayer) {
      previewMarkersLayer.clearLayers();

      const pinIcon = L.divIcon({ className: "", html: '<div class="preview-pin"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
      const campusIcon = L.divIcon({ className: "", html: '<div class="preview-campus"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

      companies.forEach(c => L.marker([c.lat, c.lng], { icon: pinIcon, interactive: false, keyboard: false }).addTo(previewMarkersLayer));
      L.marker([origin.lat, origin.lng], { icon: campusIcon, interactive: false, keyboard: false }).addTo(previewMarkersLayer);

      const bounds = L.latLngBounds(companies.map(c => [c.lat, c.lng]).concat([[origin.lat, origin.lng]]));
      previewMapInstance.fitBounds(bounds, { padding: [24, 24] });
    }
  }

  // Dynamic Landing Filter Handler
  function filterLandingData() {
    const program = document.getElementById("landing-filter-program")?.value || "all";
    const campusKey = document.getElementById("landing-filter-campus")?.value || "alangilan";
    const origin = window.CAMPUSES[campusKey] || window.CAMPUSES.alangilan;

    const filtered = cachedCompanies.filter(c => {
      return program === "all" || (c.programs && c.programs.includes(program));
    });

    renderPreviewList(filtered, origin);
    renderPreviewMap(filtered, origin);
  }

  async function initData() {
    try {
      const { companies } = await window.DatabaseService.loadCompanies();
      cachedCompanies = companies;
      const origin = window.CAMPUSES.alangilan;
      renderFacts(companies);
      renderPreviewList(companies, origin);
      renderHubTable(companies);
      renderPreviewMap(companies, origin);

      // Bind filter controls
      document.getElementById("landing-filter-program")?.addEventListener("change", filterLandingData);
      document.getElementById("landing-filter-campus")?.addEventListener("change", filterLandingData);
    } catch (err) {
      const list = document.getElementById("preview-list");
      if (list) list.innerHTML = '<li class="preview-item"><span class="preview-name">Explore full directory on the board.</span></li>';
      const sk = document.getElementById("map-skeleton");
      if (sk) sk.classList.add("is-done");
    }
  }

  /* Reveal on scroll ----------------------------------------------------- */
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(".section-head, .tiers, .board-copy, .partner-table-wrap, .day, .faq-list, .closing-inner, .emblem-copy, .emblem-canvas-wrap");
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    targets.forEach(t => { t.classList.add("reveal"); io.observe(t); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initEventStatus();
    init3DTilt();
    initCounters();
    initTiers();
    initReveal();
    initData();
  });
})();
