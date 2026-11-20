/**
 * TIERED SYSTEMS · Opportunity OS Controller
 * Full-bleed satellite map + translucent black glass HUD + Vinora analytics + AI Matcher
 */
import "./glass-warp.js";
import { CAMPUSES, DatabaseService, STORAGE_KEYS } from "./database.js";

const BASEMAPS = {
  satellite: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    reference: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; World Imagery"
  },
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Dark Gray Canvas"
  },
  street: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    reference: null,
    attribution: "Tiles &copy; Esri &mdash; Street Map"
  }
};

const TIER_MILESTONES = [
  { tier: 1, title: "Tier 01: Prepare", desc: "Technical resume overhaul & verified project artifact" },
  { tier: 2, title: "Tier 02: Level Up", desc: "LinkedIn profile architecture & 45s technical pitch" },
  { tier: 3, title: "Tier 03: Discover", desc: "Industry keynote & CpE alumni career benchmarks" },
  { tier: 4, title: "Tier 04: Connect", desc: "MOA partner shortlist & direct inquiry outreach" }
];

const DRAWER_META = {
  distance: { title: "Distance & Filters", sub: "Campus origin, radius ring & engineering tracks" },
  catalog: { title: "MOA Partner Catalog", sub: "Browse, sort & inspect verified industry partners" },
  ai: { title: "AI Partner Agent", sub: "Natural-language career & OJT matching" },
  inventory: { title: "Capacity & Shortlist", sub: "Sector distribution, open slots & CSV export" },
  profile: { title: "Student Profile", sub: "Your program preferences & 4-Tier readiness" }
};

const state = {
  companies: [],
  filtered: [],
  selectedId: null,
  activeCategory: "ALL",
  activePanel: null,
  searchQuery: "",
  programFilter: "all",
  acceptsFilter: "all",
  campusKey: "alangilan",
  radiusKm: 120,
  allowanceOnly: false,
  sortBy: "nearest",
  basemap: "satellite",
  showRadius: true,
  railCollapsed: false,
  inspectorOpen: true,
  mobileSheet: "peek",
  profile: DatabaseService.getProfile(),
  prefs: DatabaseService.getPrefs(),
  aiMessages: []
};

let map = null;
let markersLayer = null;
let radiusLayer = null;
let campusMarker = null;
let activeTileLayers = [];
const markersById = new Map();

/* Helpers ---------------------------------------------------------------- */
function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeUrl(url) {
  const raw = String(url ?? "").trim();
  return /^https?:\/\//i.test(raw) ? raw : "";
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getCampus() {
  return CAMPUSES[state.campusKey] || CAMPUSES.alangilan;
}

function companyDistanceKm(company) {
  const campus = getCampus();
  return haversineKm(campus.lat, campus.lng, Number(company.lat), Number(company.lng));
}

function shortCompanyName(name) {
  const clean = String(name || "").replace(/\s*\([^)]*\)/g, "").trim();
  return clean.length > 22 ? `${clean.slice(0, 20).trim()}…` : clean;
}

function sectorBadgeCode(type) {
  const mapCodes = {
    Semiconductor: "SC",
    "Software/AI": "SW",
    Manufacturing: "MF",
    Energy: "EN",
    Telecom: "TE"
  };
  return mapCodes[type] || "CO";
}

function matchesCategoryPill(company, cat) {
  if (cat === "ALL") return true;
  const text = `${company.type || ""} ${company.category || ""} ${company.description || ""} ${(company.acceptedRoles || []).join(" ")}`.toLowerCase();
  if (cat === "SOFTWARE") {
    return company.type === "Software/AI" || company.type === "Telecom" || /\b(software|cloud|saas|developer|web|mobile|devops|fintech|dx)\b/.test(text);
  }
  if (cat === "HARDWARE") {
    return company.type === "Semiconductor" || company.type === "Manufacturing";
  }
  if (cat === "AI / ML") {
    return /\b(ai|ml|genai|machine vision|data science|llm|fraud ai|ai processors)\b/.test(text);
  }
  if (cat === "ENERGY") {
    return company.type === "Energy";
  }
  return true;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("os-status-toast");
  const text = document.getElementById("os-status-text");
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
}

function hideToast() {
  const toast = document.getElementById("os-status-toast");
  if (toast) toast.hidden = true;
}

/* Map Initialization & Rendering ----------------------------------------- */
function initMap() {
  map = L.map("opportunity-map", {
    center: [14.02, 121.05],
    zoom: 10,
    zoomControl: false,
    attributionControl: true
  });

  markersLayer = L.layerGroup().addTo(map);
  setBasemap(state.basemap);
  updateCampusMarker();
}

function setBasemap(styleKey, { persist = true } = {}) {
  const key = BASEMAPS[styleKey] ? styleKey : "satellite";
  state.basemap = key;
  if (persist) {
    state.prefs = DatabaseService.savePrefs({ ...state.prefs, basemap: key });
  }

  activeTileLayers.forEach(layer => map?.removeLayer(layer));
  activeTileLayers = [];

  if (map) {
    const cfg = BASEMAPS[key];
    const base = L.tileLayer(cfg.base, { attribution: cfg.attribution, maxZoom: 18 }).addTo(map);
    activeTileLayers.push(base);

    if (cfg.reference) {
      const ref = L.tileLayer(cfg.reference, { maxZoom: 18, zIndex: 10, opacity: 0.9 }).addTo(map);
      activeTileLayers.push(ref);
    }
  }

  const preview = document.getElementById("os-layers-preview");
  if (preview) {
    preview.classList.remove("is-satellite", "is-dark", "is-street");
    preview.classList.add(`is-${key}`);
  }

  document.querySelectorAll(".os-layer-opt[data-style]").forEach(btn => {
    const on = btn.dataset.style === key;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-checked", String(on));
  });
}

function updateCampusMarker() {
  if (!map) return;
  const campus = getCampus();
  if (campusMarker) map.removeLayer(campusMarker);

  const icon = L.divIcon({
    className: "",
    html: `<div class="os-campus-pill"><span class="os-campus-badge">C</span><span>${escapeHtml(campus.shortName)}</span></div>`,
    iconSize: [148, 28],
    iconAnchor: [74, 14]
  });

  campusMarker = L.marker([campus.lat, campus.lng], { icon })
    .addTo(map)
    .bindPopup(`<strong>${escapeHtml(campus.name)}</strong><br><span style="font-size:12px;color:var(--os-ink-sub);">Origin node for distance calculation</span>`);
}

function updateRadiusCircle() {
  if (!map) return;
  if (radiusLayer) {
    map.removeLayer(radiusLayer);
    radiusLayer = null;
  }
  if (!state.showRadius || state.radiusKm >= 120) return;

  const campus = getCampus();
  radiusLayer = L.circle([campus.lat, campus.lng], {
    radius: state.radiusKm * 1000,
    color: "#E8590C",
    fillColor: "#E8590C",
    fillOpacity: 0.08,
    weight: 1.8,
    dashArray: "6, 8"
  }).addTo(map);
}

function renderMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  markersById.clear();

  state.filtered.forEach(company => {
    const selected = company.id === state.selectedId;
    const isFull = (company.slots || 0) <= 0;
    const labelHtml = selected
      ? `<span class="os-pin-label">${escapeHtml(shortCompanyName(company.name))} · ${company.slots || 0} slots</span>`
      : "";

    const icon = L.divIcon({
      className: "",
      html: `<div class="os-pin-wrap ${selected ? "is-selected" : ""} ${isFull ? "is-full" : ""}">${labelHtml}<div class="os-pin-orb">${escapeHtml(sectorBadgeCode(company.type))}</div></div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([company.lat, company.lng], {
      icon,
      zIndexOffset: selected ? 900 : 0
    });

    marker.on("click", () => {
      selectCompany(company.id, { pan: true, expandMobile: true });
    });

    markersLayer.addLayer(marker);
    markersById.set(company.id, marker);
  });
}

function fitAllPins() {
  if (!map) return;
  const campus = getCampus();
  const points = state.filtered.map(c => [c.lat, c.lng]);
  points.push([campus.lat, campus.lng]);
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: isMobileViewport() ? [60, 40] : [70, 70], maxZoom: 13 });
}

/* Filtering & Sorting ---------------------------------------------------- */
function computeFiltered() {
  const q = state.searchQuery.trim().toLowerCase();

  const list = state.companies.filter(company => {
    const dist = companyDistanceKm(company);
    if (state.radiusKm < 120 && dist > state.radiusKm) return false;
    if (!matchesCategoryPill(company, state.activeCategory)) return false;
    if (state.programFilter !== "all" && !(company.programs || []).includes(state.programFilter)) return false;
    if (state.acceptsFilter !== "all" && !(company.accepts || []).includes(state.acceptsFilter)) return false;
    if (state.allowanceOnly && !company.hasAllowance) return false;

    if (q) {
      const haystack = [
        company.name,
        company.category,
        company.type,
        company.hub,
        company.address,
        company.moaRef,
        ...(company.programs || []),
        ...(company.acceptedRoles || [])
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    if (state.sortBy === "slots") return (b.slots || 0) - (a.slots || 0);
    if (state.sortBy === "name") return String(a.name).localeCompare(String(b.name));
    return companyDistanceKm(a) - companyDistanceKm(b);
  });

  state.filtered = list;
}

function refreshWorkspace() {
  computeFiltered();
  updateRadiusCircle();
  renderMarkers();

  const pill = document.getElementById("os-result-pill");
  if (pill) {
    const slots = state.filtered.reduce((sum, c) => sum + (Number(c.slots) || 0), 0);
    pill.textContent = `${state.filtered.length} MOAs · ${slots} slots`;
  }

  const clearBtn = document.getElementById("os-search-clear");
  if (clearBtn) clearBtn.hidden = state.searchQuery.length === 0;

  if (!state.selectedId || !state.companies.some(c => c.id === state.selectedId)) {
    const preferred =
      state.filtered.find(c => c.id === "moa-009") ||
      state.filtered[0] ||
      state.companies.find(c => c.id === "moa-009") ||
      state.companies[0];
    state.selectedId = preferred ? preferred.id : null;
  }

  renderInspector();
  if (state.activePanel) renderActiveDrawer();
}

/* Selection & Right Floating Inspector ----------------------------------- */
function selectCompany(companyId, options = {}) {
  const { pan = true, expandMobile = false, closeDrawerOnMobile = false } = options;
  const company = state.companies.find(c => c.id === companyId);
  if (!company) return;

  state.selectedId = company.id;
  if (closeDrawerOnMobile && isMobileViewport()) {
    closeDrawer();
  }
  if (isMobileViewport() && expandMobile) {
    state.mobileSheet = "expanded";
    state.inspectorOpen = true;
  } else if (!isMobileViewport()) {
    state.inspectorOpen = true;
  }

  syncHudAttributes();
  renderMarkers();
  renderInspector();

  if (state.activePanel === "catalog" || state.activePanel === "inventory") {
    renderActiveDrawer();
  }

  if (pan && map) {
    map.flyTo([company.lat, company.lng], Math.max(map.getZoom(), 12), { duration: 0.65 });
  }
}

function syncHudAttributes() {
  const hud = document.getElementById("os-hud");
  if (!hud) return;

  hud.setAttribute("data-rail-collapsed", String(state.railCollapsed));
  hud.setAttribute("data-drawer-open", String(Boolean(state.activePanel)));
  hud.setAttribute("data-inspector-open", String(state.inspectorOpen));
  hud.setAttribute("data-mobile-sheet", state.mobileSheet);

  const reopenBtn = document.getElementById("os-inspector-reopen");
  if (reopenBtn) {
    const showReopen = isMobileViewport() ? state.mobileSheet === "hidden" : !state.inspectorOpen;
    reopenBtn.hidden = !showReopen;
  }

  document.querySelectorAll(".os-nav-btn, .os-dock-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.panel === state.activePanel);
  });
}

function renderInspector() {
  const content = document.getElementById("os-inspector-content");
  const actions = document.getElementById("os-inspector-actions");
  const peek = document.getElementById("os-inspector-peek");
  const statusEl = document.getElementById("os-inspector-status");
  const bookmarkBtn = document.getElementById("btn-inspector-bookmark");
  const reopenLabel = document.getElementById("os-reopen-label");
  if (!content || !actions) return;

  const company = state.companies.find(c => c.id === state.selectedId) || state.filtered[0] || state.companies[0];
  if (!company) {
    content.innerHTML = `<p style="color:var(--ink-muted); font-size:0.86rem;">No verified partner companies loaded yet.</p>`;
    actions.innerHTML = "";
    if (peek) peek.innerHTML = "";
    return;
  }

  const campus = getCampus();
  const distKm = companyDistanceKm(company).toFixed(1);
  const isFull = (company.slots || 0) <= 0;
  const savedSet = new Set(DatabaseService.getBookmarks());
  const isSaved = savedSet.has(company.id);
  const profProgram = state.profile.program;

  if (statusEl) {
    statusEl.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${escapeHtml(company.moaRef || "MOA Verified")}</span>`;
  }
  if (bookmarkBtn) {
    bookmarkBtn.textContent = isSaved ? "★" : "☆";
    bookmarkBtn.classList.toggle("is-saved", isSaved);
    bookmarkBtn.setAttribute("aria-label", isSaved ? "Remove from saved shortlist" : "Save partner to shortlist");
  }
  if (reopenLabel) {
    reopenLabel.textContent = shortCompanyName(company.name);
  }

  if (peek) {
    peek.innerHTML = `
      <div class="os-peek-main">
        <div class="os-monogram">${escapeHtml(company.name.slice(0, 2).toUpperCase())}</div>
        <div style="min-width:0;">
          <div class="os-peek-title">${escapeHtml(company.name)}</div>
          <div class="os-peek-sub">${distKm} km · ${isFull ? "Cohort Full" : `${company.slots} slots`}</div>
        </div>
      </div>
      <button type="button" class="os-peek-btn" id="btn-mobile-expand-sheet">Inspect</button>
    `;
    peek.querySelector("#btn-mobile-expand-sheet")?.addEventListener("click", e => {
      e.stopPropagation();
      state.mobileSheet = "expanded";
      syncHudAttributes();
    });
  }

  content.innerHTML = `
    <div class="os-insp-header">
      <div class="os-monogram" style="width:44px; height:44px; font-size:0.9rem;">
        ${escapeHtml(company.name.slice(0, 2).toUpperCase())}
      </div>
      <div style="min-width:0;">
        <h3 class="os-insp-title">${escapeHtml(company.name)}</h3>
        <p class="os-insp-cat">${escapeHtml(company.category || company.type)}</p>
      </div>
    </div>

    <div class="os-insp-stats">
      <div class="os-insp-stat">
        <small>From ${escapeHtml(campus.shortName.split(" ")[0])}</small>
        <strong class="num is-accent">${distKm} km</strong>
      </div>
      <div class="os-insp-stat">
        <small>Open Slots</small>
        <strong class="num ${isFull ? "is-coral" : "is-sage"}">${isFull ? "Full (0)" : company.slots}</strong>
      </div>
      <div class="os-insp-stat">
        <small>Work Setup</small>
        <strong>${escapeHtml(company.workSetup || "On-Site")}</strong>
      </div>
    </div>

    <div class="os-insp-location">
      <div>
        <p>${escapeHtml(company.address)}</p>
        <span class="os-insp-coords">${Number(company.lat).toFixed(4)}, ${Number(company.lng).toFixed(4)} · ${escapeHtml(company.hub || "Calabarzon")}</span>
      </div>
      <button type="button" class="os-icon-btn" id="btn-insp-fly" title="Center map on partner" aria-label="Center map on partner">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.6" /></svg>
      </button>
    </div>

    <div class="os-insp-block">
      <h4>Company Overview</h4>
      <p>${escapeHtml(company.description)}</p>
    </div>

    <div class="os-insp-block">
      <h4>Accepted Engineering &amp; Computing Programs</h4>
      <div class="os-tag-wrap">
        ${(company.programs || [])
          .map(p => `<span class="os-prog-pill">${escapeHtml(p)}</span>`)
          .join("")}
      </div>
    </div>

    ${
      company.acceptedRoles?.length
        ? `<div class="os-insp-block">
            <h4>Open Internship &amp; Training Tracks</h4>
            <ul class="os-insp-list">
              ${company.acceptedRoles.map(role => `<li>${escapeHtml(role)}</li>`).join("")}
            </ul>
          </div>`
        : ""
    }

    ${
      company.requirements?.length
        ? `<div class="os-insp-block">
            <h4>Application Requirements</h4>
            <ul class="os-insp-list">
              ${company.requirements.map(req => `<li>${escapeHtml(req)}</li>`).join("")}
            </ul>
          </div>`
        : ""
    }

    <div class="os-kv-list">
      <div class="os-kv-row"><span>MOA Validity</span><span>${escapeHtml(company.moaStatus || "Active MOA")}</span></div>
      <div class="os-kv-row"><span>Tracks</span><span>${escapeHtml((company.accepts || ["OJT / Internship"]).join(", "))}</span></div>
      <div class="os-kv-row"><span>Stipend</span><span>${escapeHtml(company.allowanceDesc || (company.hasAllowance ? "Allowance Provided" : "Standard Immersion"))}</span></div>
      <div class="os-kv-row"><span>Liaison</span><span>${escapeHtml(company.moaCoordinator || "Office of Industry Relations")}</span></div>
    </div>
  `;

  content.querySelector("#btn-insp-fly")?.addEventListener("click", () => {
    if (map) map.flyTo([company.lat, company.lng], 14, { duration: 0.7 });
  });

  const safeWebsite = sanitizeUrl(company.website);
  const mailHref = company.contactEmail
    ? `mailto:${encodeURIComponent(company.contactEmail)}?subject=${encodeURIComponent(`BatStateU MOA Internship Inquiry - ${company.name}`)}`
    : safeWebsite;

  actions.innerHTML = `
    ${
      mailHref
        ? `<a href="${escapeHtml(mailHref)}" ${company.contactEmail ? "" : 'target="_blank" rel="noopener noreferrer"'} class="os-cta-light ${isFull ? "is-disabled" : ""}">
            ${isFull ? "Cohort Full" : company.contactEmail ? "Inquire via Email" : "Visit Careers"}
          </a>`
        : `<button type="button" class="os-cta-light is-disabled" disabled>MOA Contact Pending</button>`
    }
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.lat},${company.lng}`)}" target="_blank" rel="noopener noreferrer" class="os-btn-ghost">
      Directions
    </a>
  `;
}

/* Contextual Drawer Modules ---------------------------------------------- */
function openDrawer(panelKey) {
  if (state.activePanel === panelKey) {
    closeDrawer();
    return;
  }
  state.activePanel = panelKey;

  const drawer = document.getElementById("os-drawer");
  const titleEl = document.getElementById("os-drawer-title");
  const subEl = document.getElementById("os-drawer-subtitle");
  const meta = DRAWER_META[panelKey] || DRAWER_META.catalog;

  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;
  if (drawer) drawer.hidden = false;

  syncHudAttributes();
  renderActiveDrawer();
}

function closeDrawer() {
  state.activePanel = null;
  const drawer = document.getElementById("os-drawer");
  if (drawer) drawer.hidden = true;
  syncHudAttributes();
}

function renderActiveDrawer() {
  const body = document.getElementById("os-drawer-body");
  if (!body || !state.activePanel) return;

  switch (state.activePanel) {
    case "distance":
      renderDistancePane(body);
      break;
    case "catalog":
      renderCatalogPane(body);
      break;
    case "ai":
      renderAiPane(body);
      break;
    case "inventory":
      renderInventoryPane(body);
      break;
    case "profile":
      renderProfilePane(body);
      break;
    default:
      break;
  }
}

function renderDistancePane(body) {
  const pct = Math.round(((state.radiusKm - 10) / (120 - 10)) * 100);
  body.innerHTML = `
    <div>
      <span class="os-section-label"><span>Campus Reference Node</span></span>
      <div class="os-seg-grid" id="os-campus-pills">
        ${Object.values(CAMPUSES)
          .map(c => `<button type="button" class="os-seg-btn ${c.id === state.campusKey ? "active" : ""}" data-campus="${escapeHtml(c.id)}">${escapeHtml(c.shortName.replace(" Campus", ""))}</button>`)
          .join("")}
      </div>
    </div>

    <div class="os-slider-card">
      <div class="os-slider-head">
        <label for="os-radius-slider">Max Distance Radius</label>
        <span class="os-slider-val" id="os-radius-label">${state.radiusKm >= 120 ? "All (No Limit)" : `Within ${state.radiusKm} km`}</span>
      </div>
      <input type="range" id="os-radius-slider" class="os-range" min="10" max="120" step="5" value="${state.radiusKm}" style="--pct:${pct}%;" />
    </div>

    <div>
      <label class="os-section-label" for="os-filter-program"><span>Engineering / Computing Program</span></label>
      <select id="os-filter-program" class="os-select">
        <option value="all">All Programs</option>
        <option value="CpE">CpE · Computer Engineering</option>
        <option value="ECE">ECE · Electronics Engineering</option>
        <option value="EE">EE · Electrical Engineering</option>
        <option value="ME">ME · Mechanical Engineering</option>
        <option value="IE">IE · Industrial Engineering</option>
        <option value="CS">CS · Computer Science</option>
        <option value="IT">IT · Information Technology</option>
        <option value="ChE">ChE · Chemical Engineering</option>
        <option value="CE">CE · Civil Engineering</option>
      </select>
    </div>

    <div>
      <label class="os-section-label" for="os-filter-accepts"><span>Opportunity Track</span></label>
      <select id="os-filter-accepts" class="os-select">
        <option value="all">All Tracks</option>
        <option value="OJT / Internship">OJT / Internship</option>
        <option value="Fresh Grad Hiring">Fresh Grad Hiring</option>
        <option value="Capstone / Industry Project">Capstone / Industry Project</option>
        <option value="Plant Visit / Immersion">Plant Visit / Immersion</option>
      </select>
    </div>

    <div class="os-toggle-row">
      <div>
        <div class="os-toggle-title">Paid Allowance Only</div>
        <div class="os-toggle-sub">Filter partners providing stipend or shuttle</div>
      </div>
      <button type="button" class="os-switch" id="os-allowance-toggle" role="switch" aria-checked="${state.allowanceOnly}" aria-label="Paid allowance only"></button>
    </div>

    <button type="button" class="os-btn-ghost" id="os-distance-reset">Reset All Filters</button>
  `;

  body.querySelector("#os-filter-program").value = state.programFilter;
  body.querySelector("#os-filter-accepts").value = state.acceptsFilter;

  body.querySelectorAll("#os-campus-pills .os-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.campusKey = btn.dataset.campus;
      updateCampusMarker();
      refreshWorkspace();
      const c = getCampus();
      if (map) map.flyTo([c.lat, c.lng], 11, { duration: 0.65 });
    });
  });

  const slider = body.querySelector("#os-radius-slider");
  slider.addEventListener("input", () => {
    state.radiusKm = parseInt(slider.value, 10) || 120;
    const label = body.querySelector("#os-radius-label");
    if (label) label.textContent = state.radiusKm >= 120 ? "All (No Limit)" : `Within ${state.radiusKm} km`;
    slider.style.setProperty("--pct", `${Math.round(((state.radiusKm - 10) / 110) * 100)}%`);
    refreshWorkspace();
  });

  body.querySelector("#os-filter-program").addEventListener("change", e => {
    state.programFilter = e.target.value;
    refreshWorkspace();
  });

  body.querySelector("#os-filter-accepts").addEventListener("change", e => {
    state.acceptsFilter = e.target.value;
    refreshWorkspace();
  });

  body.querySelector("#os-allowance-toggle").addEventListener("click", () => {
    state.allowanceOnly = !state.allowanceOnly;
    refreshWorkspace();
  });

  body.querySelector("#os-distance-reset").addEventListener("click", resetFilters);
}

function renderCatalogPane(body) {
  const savedSet = new Set(DatabaseService.getBookmarks());
  body.innerHTML = `
    <div class="os-catalog-toolbar">
      <span class="os-section-label" id="os-catalog-count" style="margin:0;">${state.filtered.length} of ${state.companies.length} partners</span>
    </div>

    <div class="os-seg-grid cols-3" id="os-sort-pills">
      <button type="button" class="os-seg-btn ${state.sortBy === "nearest" ? "active" : ""}" data-sort="nearest">Nearest</button>
      <button type="button" class="os-seg-btn ${state.sortBy === "slots" ? "active" : ""}" data-sort="slots">Most Slots</button>
      <button type="button" class="os-seg-btn ${state.sortBy === "name" ? "active" : ""}" data-sort="name">A–Z</button>
    </div>

    <div class="os-catalog-list" id="os-catalog-list">
      ${
        state.filtered.length === 0
          ? `<div class="os-ai-msg is-bot">No MOA partners match the active filters. Try widening the radius or choosing ALL.</div>`
          : state.filtered
              .map(c => {
                const dist = companyDistanceKm(c).toFixed(1);
                const full = (c.slots || 0) <= 0;
                const saved = savedSet.has(c.id);
                return `
                  <article class="os-mini-card ${c.id === state.selectedId ? "selected" : ""}" data-company-id="${escapeHtml(c.id)}" tabindex="0" role="button">
                    <div class="os-mini-top">
                      <div class="os-monogram">${escapeHtml(c.name.slice(0, 2).toUpperCase())}</div>
                      <div class="os-mini-meta">
                        <h3>${escapeHtml(c.name)}</h3>
                        <span>${escapeHtml(c.hub || c.address)}</span>
                      </div>
                      <button type="button" class="os-icon-btn ${saved ? "is-saved" : ""}" data-bookmark-id="${escapeHtml(c.id)}" aria-label="${saved ? "Remove bookmark" : "Bookmark partner"}" style="width:30px;height:30px;font-size:0.85rem;">
                        ${saved ? "★" : "☆"}
                      </button>
                    </div>
                    <div class="os-mini-bottom">
                      <span class="os-dist-badge">${dist} km</span>
                      <span class="os-slots-txt ${full ? "is-full" : ""}">${full ? "Cohort Full" : `${c.slots} slots open`}</span>
                    </div>
                  </article>
                `;
              })
              .join("")
      }
    </div>
  `;

  body.querySelectorAll("#os-sort-pills .os-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.sortBy = btn.dataset.sort;
      refreshWorkspace();
    });
  });

  body.querySelectorAll(".os-mini-card[data-company-id]").forEach(card => {
    const id = card.dataset.companyId;
    card.addEventListener("click", () => selectCompany(id, { pan: true, expandMobile: true, closeDrawerOnMobile: true }));
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectCompany(id, { pan: true, expandMobile: true, closeDrawerOnMobile: true });
      }
    });
  });

  body.querySelectorAll("[data-bookmark-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleBookmark(btn.dataset.bookmarkId);
    });
  });
}

function runAiMatch(query) {
  const q = query.toLowerCase();
  const prof = state.profile;
  const programTokens = ["cpe", "ece", "ee", "me", "ie", "cs", "it", "che", "ce"];
  const detectedProg = programTokens.find(p => new RegExp(`\\b${p}\\b`, "i").test(q));
  const targetProgram = detectedProg ? detectedProg.toUpperCase().replace("CPE", "CpE").replace("CHE", "ChE") : (q.includes("profile") ? prof.program : null);

  const wantsRemote = /\b(remote|wfh)\b/.test(q);
  const wantsHybrid = /\b(hybrid)\b/.test(q);
  const wantsAllowance = /\b(allowance|paid|stipend|shuttle)\b/.test(q);
  const wantsNearest = /\b(nearest|closest|near|batangas|alangilan|lipa|malvar|fpip|sto\.?\s*tomas)\b/.test(q);
  const wantsSoftware = /\b(software|cloud|web|ai|ml|data|fintech|saas)\b/.test(q);
  const wantsHardware = /\b(hardware|semicon|semiconductor|fpga|embedded|robotics|manufacturing|plc|ic)\b/.test(q);
  const wantsEnergy = /\b(energy|power|scada|petrochemical|lng|plant)\b/.test(q);

  const scored = state.companies
    .map(c => {
      let score = 0;
      const reasons = [];
      const dist = companyDistanceKm(c);
      const fullText = `${c.name} ${c.category} ${c.type} ${c.hub} ${c.address} ${c.description} ${(c.acceptedRoles || []).join(" ")}`.toLowerCase();

      if (targetProgram && (c.programs || []).some(p => p.toLowerCase() === targetProgram.toLowerCase())) {
        score += 40;
        reasons.push(`Accepts ${targetProgram}`);
      }
      if (wantsRemote && /remote/i.test(c.workSetup || "")) { score += 30; reasons.push("Remote Friendly"); }
      if (wantsHybrid && /hybrid/i.test(c.workSetup || "")) { score += 28; reasons.push("Hybrid Setup"); }
      if (wantsAllowance && c.hasAllowance) { score += 20; reasons.push("Paid Allowance"); }
      if (wantsSoftware && matchesCategoryPill(c, "SOFTWARE")) { score += 26; reasons.push("Software / AI"); }
      if (wantsHardware && matchesCategoryPill(c, "HARDWARE")) { score += 26; reasons.push("Hardware / Semicon"); }
      if (wantsEnergy && matchesCategoryPill(c, "ENERGY")) { score += 26; reasons.push("Clean Energy"); }

      if (/fpip|sto\.?\s*tomas/.test(q) && /fpip|sto\.?\s*tomas/i.test(fullText)) { score += 35; reasons.push("FPIP Sto. Tomas"); }
      if (/lima|lipa|malvar/.test(q) && /lima|lipa|malvar/i.test(fullText)) { score += 35; reasons.push("LIMA / Lipa"); }
      if (/laguna/.test(q) && /laguna/i.test(fullText)) { score += 35; reasons.push("Laguna"); }
      if (/manila|bgc|ortigas|makati/.test(q) && /manila|bgc|ortigas|makati/i.test(fullText)) { score += 35; reasons.push("Metro Manila"); }

      if ((c.slots || 0) > 0) score += Math.min(18, c.slots);
      else score -= 35;

      if (wantsNearest) score += Math.max(0, 35 - dist * 0.6);
      else score += Math.max(0, 14 - dist * 0.15);

      if (reasons.length === 0 && (c.programs || []).includes(prof.program)) {
        reasons.push(`Fits ${prof.program}`);
      }
      reasons.push(`${dist.toFixed(1)} km`);
      return { company: c, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    summary: `Top ${scored.length} verified MOA matches from ${getCampus().shortName}${targetProgram ? ` tailored for ${targetProgram}` : ""}:`,
    matches: scored
  };
}

function renderAiPane(body) {
  if (state.aiMessages.length === 0) {
    state.aiMessages.push({
      role: "bot",
      text: `Ask me about internships, distance from ${getCampus().shortName}, paid stipends, or your ${state.profile.program} profile.`
    });
  }

  body.innerHTML = `
    <div class="os-ai-prompts" id="os-ai-prompts">
      <button type="button" class="os-ai-chip" data-prompt="Nearest CpE OJT with allowance">Nearest CpE OJT</button>
      <button type="button" class="os-ai-chip" data-prompt="Hybrid or remote software roles">Remote / Hybrid SW</button>
      <button type="button" class="os-ai-chip" data-prompt="Semicon & hardware in FPIP or LIMA">FPIP / LIMA Hardware</button>
      <button type="button" class="os-ai-chip" data-prompt="Best match for my profile">Match my profile</button>
    </div>

    <div class="os-ai-thread" id="os-ai-thread">
      ${state.aiMessages
        .map(msg => {
          if (msg.role === "user") {
            return `<div class="os-ai-msg is-user">${escapeHtml(msg.text)}</div>`;
          }
          const matchesHtml = msg.matches
            ? `<div class="os-ai-match-list">
                ${msg.matches
                  .map(
                    ({ company, reasons }) => `
                  <div class="os-ai-match-card">
                    <div style="min-width:0;">
                      <strong>${escapeHtml(company.name)}</strong>
                      <span>${escapeHtml(reasons.join(" · "))} · ${(company.slots || 0) > 0 ? `${company.slots} slots` : "Full"}</span>
                    </div>
                    <button type="button" class="os-btn-ghost" data-ai-inspect="${escapeHtml(company.id)}" style="min-height:30px;padding:0 10px;font-size:0.72rem;flex-shrink:0;">Inspect</button>
                  </div>`
                  )
                  .join("")}
              </div>`
            : "";
          return `<div class="os-ai-msg is-bot"><p>${escapeHtml(msg.text)}</p>${matchesHtml}</div>`;
        })
        .join("")}
    </div>

    <form class="os-ai-form" id="os-ai-form">
      <label for="os-ai-input" class="visually-hidden">Ask AI Partner Agent</label>
      <input type="text" id="os-ai-input" class="os-input" placeholder="e.g. Paid ECE firmware OJT near Lipa..." required />
      <button type="submit" class="os-cta-light" style="padding:0 16px;">Ask</button>
    </form>
  `;

  const submitPrompt = promptText => {
    const clean = promptText.trim();
    if (!clean) return;
    state.aiMessages.push({ role: "user", text: clean });
    const result = runAiMatch(clean);
    state.aiMessages.push({ role: "bot", text: result.summary, matches: result.matches });
    renderAiPane(body);
    const thread = body.querySelector("#os-ai-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  };

  body.querySelectorAll(".os-ai-chip[data-prompt]").forEach(btn => {
    btn.addEventListener("click", () => submitPrompt(btn.dataset.prompt));
  });

  body.querySelector("#os-ai-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const input = body.querySelector("#os-ai-input");
    if (input) {
      submitPrompt(input.value);
    }
  });

  body.querySelectorAll("[data-ai-inspect]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectCompany(btn.dataset.aiInspect, { pan: true, expandMobile: true, closeDrawerOnMobile: true });
    });
  });
}

function renderInventoryPane(body) {
  const savedIds = new Set(DatabaseService.getBookmarks());
  const savedCompanies = state.companies.filter(c => savedIds.has(c.id));
  const totalSlots = state.filtered.reduce((s, c) => s + (Number(c.slots) || 0), 0);
  const nearestKm = state.filtered.length
    ? Math.min(...state.filtered.map(c => companyDistanceKm(c))).toFixed(1)
    : "—";

  // Concentric multi-ring calculations (Vinora Varietal Mix style)
  const totalCount = Math.max(state.companies.length, 1);
  const counts = {
    hw: state.companies.filter(c => c.type === "Semiconductor" || c.type === "Manufacturing").length,
    sw: state.companies.filter(c => c.type === "Software/AI" || c.type === "Telecom").length,
    en: state.companies.filter(c => c.type === "Energy").length
  };
  const rings = [
    { label: "Hardware & Mfg", pct: Math.round((counts.hw / totalCount) * 100), r: 42, color: "#ffffff" },
    { label: "Software & Telecom", pct: Math.round((counts.sw / totalCount) * 100), r: 31, color: "#E8590C" },
    { label: "Clean Energy", pct: Math.max(0, 100 - Math.round((counts.hw / totalCount) * 100) - Math.round((counts.sw / totalCount) * 100)), r: 20, color: "#8a8a96" }
  ];

  body.innerHTML = `
    <div class="os-kpi-grid">
      <div class="os-kpi-card">
        <div class="os-kpi-label">Filtered MOAs</div>
        <div class="os-kpi-val num" id="os-inv-moas">${state.filtered.length}</div>
        <span class="os-kpi-pill">of ${state.companies.length} total</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Open Slots</div>
        <div class="os-kpi-val num" id="os-inv-slots">${totalSlots}</div>
        <span class="os-kpi-pill">Active openings</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Nearest Partner</div>
        <div class="os-kpi-val num" id="os-inv-nearest">${nearestKm === "—" ? "—" : `${nearestKm} km`}</div>
        <span class="os-kpi-pill">${escapeHtml(getCampus().shortName.split(" ")[0])}</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Saved Shortlist</div>
        <div class="os-kpi-val num" id="os-inv-saved">${savedCompanies.length}</div>
        <span class="os-kpi-pill">In browser</span>
      </div>
    </div>

    <div class="os-ring-card">
      <span class="os-section-label" style="margin:0;"><span>Sector Mix · MOA Network</span></span>
      <div class="os-ring-wrap">
        <svg id="os-sector-ring-svg" width="108" height="108" viewBox="0 0 108 108" aria-label="Sector mix chart">
          ${rings
            .map(ring => {
              const circ = 2 * Math.PI * ring.r;
              const dash = ((ring.pct / 100) * circ).toFixed(1);
              return `
                <circle cx="54" cy="54" r="${ring.r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="7" />
                <circle cx="54" cy="54" r="${ring.r}" fill="none" stroke="${ring.color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash} ${circ.toFixed(1)}" transform="rotate(-90 54 54)" />
              `;
            })
            .join("")}
        </svg>
        <div class="os-ring-legend">
          ${rings
            .map(
              r => `
            <div class="os-ring-legend-row">
              <span><span class="os-ring-dot" style="background:${r.color};"></span>${r.label}</span>
              <strong class="num">${r.pct}%</strong>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </div>

    <div>
      <span class="os-section-label"><span>Saved Shortlist</span><span>${savedCompanies.length}</span></span>
      <div class="os-catalog-list" id="os-shortlist-list">
        ${
          savedCompanies.length === 0
            ? `<div class="os-ai-msg is-bot">Tap ☆ on any partner to save it to your personal OJT shortlist.</div>`
            : savedCompanies
                .map(
                  c => `
                <div class="os-ai-match-card">
                  <div style="min-width:0; cursor:pointer;" data-shortlist-open="${escapeHtml(c.id)}">
                    <strong>${escapeHtml(c.name)}</strong>
                    <span>${companyDistanceKm(c).toFixed(1)} km · ${(c.slots || 0) > 0 ? `${c.slots} slots` : "Cohort Full"}</span>
                  </div>
                  <button type="button" class="os-icon-btn is-saved" data-shortlist-rm="${escapeHtml(c.id)}" aria-label="Remove from shortlist" style="width:28px;height:28px;font-size:0.8rem;">★</button>
                </div>`
                )
                .join("")
        }
      </div>
    </div>

    <div class="os-seg-grid">
      <button type="button" class="os-cta-light" id="os-export-filtered">Export Filtered CSV</button>
      <button type="button" class="os-btn-ghost" id="os-export-shortlist">Export Shortlist</button>
    </div>
  `;

  body.querySelectorAll("[data-shortlist-open]").forEach(el => {
    el.addEventListener("click", () => selectCompany(el.dataset.shortlistOpen, { pan: true, expandMobile: true, closeDrawerOnMobile: true }));
  });
  body.querySelectorAll("[data-shortlist-rm]").forEach(btn => {
    btn.addEventListener("click", () => toggleBookmark(btn.dataset.shortlistRm));
  });
  body.querySelector("#os-export-filtered")?.addEventListener("click", () => exportCSV(state.filtered, "Filtered"));
  body.querySelector("#os-export-shortlist")?.addEventListener("click", () => {
    const list = savedCompanies.length ? savedCompanies : state.filtered;
    exportCSV(list, savedCompanies.length ? "Shortlist" : "Filtered");
  });
}

function renderProfilePane(body) {
  const prof = state.profile;
  const doneSet = new Set(prof.tiersCompleted || []);
  const pct = Math.round((doneSet.size / TIER_MILESTONES.length) * 100);

  body.innerHTML = `
    <div class="os-readiness-card">
      <div class="os-section-label" style="margin:0;">
        <span>Your Readiness</span>
        <span id="os-readiness-pct" class="num" style="color:var(--accent);">${pct}%</span>
      </div>
      <div class="os-progress-track">
        <div class="os-progress-fill" id="os-readiness-fill" style="width:${pct}%;"></div>
      </div>
      <div id="os-tier-checklist">
        ${TIER_MILESTONES.map(item => {
          const done = doneSet.has(item.tier);
          return `
            <button type="button" class="os-tier-check ${done ? "is-done" : ""}" data-tier="${item.tier}">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.desc)}</span>
              </div>
              <span class="os-tier-mark" aria-hidden="true">${done ? "✓" : item.tier}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <form id="os-profile-form" style="display:flex; flex-direction:column; gap:10px;">
      <div class="os-field">
        <label for="os-prof-name">Student Name</label>
        <input type="text" id="os-prof-name" class="os-input" value="${escapeHtml(prof.name)}" placeholder="e.g. BatStateU Engineer" />
      </div>
      <div class="os-field-grid-2">
        <div class="os-field">
          <label for="os-prof-program">Program</label>
          <select id="os-prof-program" class="os-select">
            <option value="CpE">CpE</option>
            <option value="ECE">ECE</option>
            <option value="EE">EE</option>
            <option value="ME">ME</option>
            <option value="IE">IE</option>
            <option value="CS">CS</option>
            <option value="IT">IT</option>
            <option value="ChE">ChE</option>
            <option value="CE">CE</option>
          </select>
        </div>
        <div class="os-field">
          <label for="os-prof-campus">Home Campus</label>
          <select id="os-prof-campus" class="os-select">
            ${Object.values(CAMPUSES)
              .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.shortName.replace(" Campus", ""))}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <div class="os-field">
        <label for="os-prof-setup">Preferred Work Setup</label>
        <select id="os-prof-setup" class="os-select">
          <option value="all">Any Setup</option>
          <option value="On-Site">On-Site</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Remote Friendly">Remote Friendly</option>
        </select>
      </div>
      <div class="os-seg-grid">
        <button type="submit" class="os-cta-light">Save Profile</button>
        <button type="button" class="os-btn-ghost" id="os-apply-profile-filters">Apply Filters</button>
      </div>
    </form>

    <a href="./program.html" class="os-btn-ghost" style="width:100%;">Explore 4-Tier Program Guide &rarr;</a>
  `;

  body.querySelector("#os-prof-program").value = prof.program || "CpE";
  body.querySelector("#os-prof-campus").value = prof.campus || "alangilan";
  body.querySelector("#os-prof-setup").value = prof.workSetup || "all";

  body.querySelectorAll(".os-tier-check[data-tier]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = parseInt(btn.dataset.tier, 10);
      const nextSet = new Set(state.profile.tiersCompleted || []);
      if (nextSet.has(t)) nextSet.delete(t);
      else nextSet.add(t);
      state.profile = DatabaseService.saveProfile({ ...state.profile, tiersCompleted: Array.from(nextSet).sort() });
      renderProfilePane(body);
    });
  });

  body.querySelector("#os-profile-form")?.addEventListener("submit", e => {
    e.preventDefault();
    state.profile = DatabaseService.saveProfile({
      ...state.profile,
      name: body.querySelector("#os-prof-name")?.value.trim() || "",
      program: body.querySelector("#os-prof-program")?.value || "CpE",
      campus: body.querySelector("#os-prof-campus")?.value || "alangilan",
      workSetup: body.querySelector("#os-prof-setup")?.value || "all"
    });
    state.campusKey = state.profile.campus;
    updateCampusMarker();
    refreshWorkspace();
    showToast(`Profile saved (${state.profile.program} · ${getCampus().shortName}).`);
  });

  body.querySelector("#os-apply-profile-filters")?.addEventListener("click", () => {
    state.programFilter = body.querySelector("#os-prof-program")?.value || "all";
    state.campusKey = body.querySelector("#os-prof-campus")?.value || "alangilan";
    updateCampusMarker();
    refreshWorkspace();
    showToast(`Filtered Opportunity OS for ${state.programFilter} from ${getCampus().shortName}.`);
  });
}

/* Actions, Bookmarks, CSV Export & Modals -------------------------------- */
function toggleBookmark(companyId) {
  DatabaseService.toggleBookmark(companyId);
  renderInspector();
  if (state.activePanel === "catalog" || state.activePanel === "inventory") {
    renderActiveDrawer();
  }
}

function resetFilters() {
  state.searchQuery = "";
  state.activeCategory = "ALL";
  state.programFilter = "all";
  state.acceptsFilter = "all";
  state.radiusKm = 120;
  state.allowanceOnly = false;
  state.sortBy = "nearest";

  const searchInput = document.getElementById("os-search-input");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".os-cat-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cat === "ALL");
  });

  refreshWorkspace();
  fitAllPins();
}

function exportCSV(companies, label) {
  const campus = getCampus();
  const header = "id,name,category,type,hub,address,lat,lng,distanceKm,moaStatus,moaRef,programs,accepts,workSetup,hasAllowance,allowanceDesc,slots,moaCoordinator,contactEmail\n";
  const rows = companies
    .map(c => {
      const dist = companyDistanceKm(c).toFixed(1);
      return [
        `"${c.id}"`,
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.category || "").replace(/"/g, '""')}"`,
        `"${c.type || ""}"`,
        `"${c.hub || ""}"`,
        `"${(c.address || "").replace(/"/g, '""')}"`,
        c.lat,
        c.lng,
        dist,
        `"${c.moaStatus || ""}"`,
        `"${c.moaRef || ""}"`,
        `"${(c.programs || []).join(";")}"`,
        `"${(c.accepts || []).join(";")}"`,
        `"${c.workSetup || "On-Site"}"`,
        c.hasAllowance ? "true" : "false",
        `"${(c.allowanceDesc || "").replace(/"/g, '""')}"`,
        c.slots || 0,
        `"${(c.moaCoordinator || "").replace(/"/g, '""')}"`,
        `"${c.contactEmail || ""}"`
      ].join(",");
    })
    .join("\n");

  const blob = new Blob([header + rows + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Tiered_Systems_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadDirectory() {
  const res = await DatabaseService.loadCompanies();
  state.companies = res.companies || [];

  if (res.error) showToast(res.error, true);
  else if (res.source === "google-sheets") showToast("Live synced with published Google Sheet CSV.");

  refreshWorkspace();
  fitAllPins();
}

function initLaunchArrival() {
  const root = document.documentElement;
  if (!root.classList.contains("os-launch-entering")) return;
  try {
    sessionStorage.removeItem("ts_os_launch_morph");
  } catch (_) {}
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove("os-launch-entering");
      root.classList.add("os-launch-settling");
      window.setTimeout(() => {
        root.classList.remove("os-launch-settling");
      }, 760);
    });
  });
}

/* Boot & Event Bindings -------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  state.basemap = state.prefs.basemap || "satellite";
  state.showRadius = state.prefs.showRadius !== false;
  state.campusKey = state.profile.campus && CAMPUSES[state.profile.campus] ? state.profile.campus : "alangilan";
  state.mobileSheet = isMobileViewport() ? "peek" : "expanded";

  initMap();
  syncHudAttributes();
  initLaunchArrival();
  loadDirectory();

  /* Search & Category Pills */
  const searchInput = document.getElementById("os-search-input");
  searchInput?.addEventListener("input", e => {
    state.searchQuery = e.target.value;
    refreshWorkspace();
  });

  document.getElementById("os-search-clear")?.addEventListener("click", () => {
    state.searchQuery = "";
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    refreshWorkspace();
  });

  document.querySelectorAll(".os-cat-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.cat || "ALL";
      document.querySelectorAll(".os-cat-pill").forEach(b => b.classList.toggle("active", b === btn));
      refreshWorkspace();
    });
  });

  /* Left Navigation Rail & Mobile Dock */
  document.querySelectorAll(".os-nav-btn, .os-dock-btn").forEach(btn => {
    btn.addEventListener("click", () => openDrawer(btn.dataset.panel));
  });

  document.getElementById("btn-toggle-rail")?.addEventListener("click", () => {
    state.railCollapsed = !state.railCollapsed;
    syncHudAttributes();
  });

  document.getElementById("btn-drawer-close")?.addEventListener("click", closeDrawer);

  /* Inspector Controls */
  document.getElementById("btn-inspector-bookmark")?.addEventListener("click", () => {
    if (state.selectedId) toggleBookmark(state.selectedId);
  });

  document.getElementById("btn-inspector-toggle")?.addEventListener("click", () => {
    if (isMobileViewport()) {
      state.mobileSheet = state.mobileSheet === "expanded" ? "peek" : "hidden";
    } else {
      state.inspectorOpen = false;
    }
    syncHudAttributes();
  });

  document.getElementById("os-inspector-reopen")?.addEventListener("click", () => {
    if (isMobileViewport()) state.mobileSheet = "expanded";
    else state.inspectorOpen = true;
    syncHudAttributes();
  });

  document.getElementById("os-inspector-peek")?.addEventListener("click", () => {
    state.mobileSheet = "expanded";
    syncHudAttributes();
  });

  /* Layers Switcher & Map Utility Pills */
  const layersBtn = document.getElementById("btn-layers-toggle");
  const layersMenu = document.getElementById("os-layers-menu");
  layersBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const open = layersMenu.hidden;
    layersMenu.hidden = !open;
    layersBtn.setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll(".os-layer-opt[data-style]").forEach(btn => {
    btn.addEventListener("click", () => {
      setBasemap(btn.dataset.style);
      if (layersMenu) layersMenu.hidden = true;
      layersBtn?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", e => {
    if (layersMenu && !layersMenu.hidden && !document.getElementById("os-layers-control")?.contains(e.target)) {
      layersMenu.hidden = true;
      layersBtn?.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("btn-jump-campus")?.addEventListener("click", () => {
    const c = getCampus();
    if (map) map.flyTo([c.lat, c.lng], 14, { duration: 0.75 });
  });
  document.getElementById("btn-fit-bounds")?.addEventListener("click", fitAllPins);
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => map?.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => map?.zoomOut());

  /* Toast, Offline / Online & Live Admin Storage Sync */
  document.getElementById("os-status-dismiss")?.addEventListener("click", hideToast);
  window.addEventListener("offline", () => showToast("Offline mode · Showing locally cached MOA directory."));
  window.addEventListener("online", hideToast);
  window.addEventListener("storage", e => {
    if (e.key === STORAGE_KEYS.OS_PREFS) {
      state.prefs = DatabaseService.getPrefs();
      const nextBasemap = state.prefs.basemap || "satellite";
      if (nextBasemap !== state.basemap) {
        setBasemap(nextBasemap, { persist: false });
      }
      state.showRadius = state.prefs.showRadius !== false;
      updateRadiusCircle();
    } else if (
      e.key === STORAGE_KEYS.CUSTOM_COMPANIES ||
      e.key === STORAGE_KEYS.SHEET_CSV_URL ||
      e.key === STORAGE_KEYS.CACHED_SHEET_DATA
    ) {
      loadDirectory();
    }
  });

  /* Resize & Keyboard Shortcuts */
  window.addEventListener("resize", () => {
    map?.invalidateSize();
    syncHudAttributes();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/i.test(document.activeElement?.tagName || "")) {
      e.preventDefault();
      searchInput?.focus();
    } else if (e.key === "Escape") {
      if (layersMenu && !layersMenu.hidden) {
        layersMenu.hidden = true;
        layersBtn?.setAttribute("aria-expanded", "false");
      } else if (state.activePanel) {
        closeDrawer();
      }
    }
  });
});
