/**
 * TIERED SYSTEMS · Opportunity Radar Controller
 * Full-bleed satellite map + translucent black glass HUD + Vinora analytics + AI Matcher
 */
import "./glass-warp.js";
import { addAtlas } from "./atlas.js";
import { CAMPUSES, DatabaseService, downloadCompaniesCsv, filingStatus, formatAgreementDate, hasCoordinates, STORAGE_KEYS } from "./database.js";

const BASEMAPS = {
  atlas: {},
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
  distance: { title: "Filters", sub: "Campus, distance, and placement details" },
  catalog: { title: "MOA Partner Catalog", sub: "Browse industry agreements and filing status" },
  ai: { title: "Partner Matcher", sub: "Search available agreement details" },
  inventory: { title: "Register & Shortlist", sub: "Filing status, saved agreements & CSV export" },
  profile: { title: "Student Profile", sub: "Your program preferences & 4-Tier readiness" }
};

const CATALOG_PAGE_SIZE = 40;
const state = {
  companies: [],
  filtered: [],
  selectedId: null,
  activeCategory: "ALL",
  catalogLimit: CATALOG_PAGE_SIZE,
  activePanel: null,
  searchQuery: "",
  programFilter: "all",
  acceptsFilter: "all",
  campusKey: "alangilan",
  radiusKm: 120,
  allowanceOnly: false,
  sortBy: "register",
  basemap: "satellite",
  showRadius: true,
  railCollapsed: false,
  inspectorOpen: true,
  mobileSheet: "peek",
  profile: DatabaseService.getProfile(),
  prefs: DatabaseService.getPrefs(),
  aiMessages: []
};

let drawerTrigger = null;
let inspectorFromCatalog = false;
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
  if (!hasCoordinates(company)) return Infinity;
  const campus = getCampus();
  return haversineKm(campus.lat, campus.lng, company.lat, company.lng);
}

function distanceLabel(company) {
  return hasCoordinates(company) ? `${companyDistanceKm(company).toFixed(1)} km` : "Unmapped";
}

function slotLabel(company) {
  if (company.slots == null) return "Slots not listed";
  return company.slots > 0 ? `${company.slots} slots open` : "Cohort Full";
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
  if (!window.L) return;
  map = L.map("opportunity-map", {
    center: [14.02, 121.05],
    zoom: 10,
    zoomControl: false,
    attributionControl: true
  });

  addAtlas(map);
  markersLayer = L.layerGroup().addTo(map);
  setBasemap(state.basemap);
  updateCampusMarker();

  map.on("click", () => {
    if (!isMobileViewport()) return;
    if (state.activePanel) {
      closeDrawer();
    } else if (state.mobileSheet === "expanded") {
      state.mobileSheet = "peek";
      syncHudAttributes();
    }
  });
}

function setBasemap(styleKey, { persist = true } = {}) {
  const key = Object.hasOwn(BASEMAPS, styleKey) ? styleKey : "satellite";
  state.basemap = key;
  if (persist) {
    state.prefs = DatabaseService.savePrefs({ ...state.prefs, basemap: key });
  }

  activeTileLayers.forEach(layer => map?.removeLayer(layer));
  activeTileLayers = [];

  let baseLayer = null;
  if (map && key !== "atlas") {
    const cfg = BASEMAPS[key];
    baseLayer = L.tileLayer(cfg.base, { attribution: cfg.attribution, maxZoom: 18 }).addTo(map);
    activeTileLayers.push(baseLayer);

    if (cfg.reference) {
      const ref = L.tileLayer(cfg.reference, { maxZoom: 18, zIndex: 10, opacity: 0.9 }).addTo(map);
      activeTileLayers.push(ref);
    }
  }

  const preview = document.getElementById("os-layers-preview");
  if (preview) {
    preview.classList.remove("is-atlas", "is-satellite", "is-dark", "is-street");
    preview.classList.add(`is-${key}`);
  }

  document.querySelectorAll(".os-layer-opt[data-style]").forEach(btn => {
    const on = btn.dataset.style === key;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-checked", String(on));
  });

  return baseLayer;
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

  state.filtered.filter(hasCoordinates).forEach(company => {
    const selected = company.id === state.selectedId;
    const isFull = company.slots === 0;
    const code = company.registerNumber
      ? company.name.split(/\s+/, 2).map(word => word[0]).join("").toUpperCase()
      : sectorBadgeCode(company.type);
    const labelHtml = selected
      ? `<span class="os-pin-label">${escapeHtml(shortCompanyName(company.name))}</span>`
      : "";

    const icon = L.divIcon({
      className: "",
      html: `<div class="os-pin-wrap ${selected ? "is-selected" : ""} ${isFull ? "is-full" : ""}">${labelHtml}<div class="os-pin-orb">${escapeHtml(code)}</div></div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([company.lat, company.lng], {
      icon,
      title: company.name,
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
  const points = state.filtered.filter(hasCoordinates).map(c => [c.lat, c.lng]);
  points.push([campus.lat, campus.lng]);
  const bounds = L.latLngBounds(points);
  const top = Math.round(document.querySelector(".os-top-cluster").getBoundingClientRect().bottom);
  const inspectorWidth = document.getElementById("os-inspector").offsetWidth;
  const railWidth = document.getElementById("os-nav-rail").offsetWidth;
  const mobile = isMobileViewport();
  map.fitBounds(bounds, {
    paddingTopLeft: [mobile ? 24 : railWidth + 30, top + 24],
    paddingBottomRight: [mobile ? 24 : inspectorWidth + 30, mobile ? 185 : 86],
    animate: false,
    maxZoom: 13
  });
}

/* Filtering & Sorting ---------------------------------------------------- */
function computeFiltered() {
  const q = state.searchQuery.trim().toLowerCase();

  const list = state.companies.filter(company => {
    if (state.radiusKm < 120 && companyDistanceKm(company) > state.radiusKm) return false;
    if (state.activeCategory !== "ALL" && filingStatus(company).toUpperCase() !== state.activeCategory) return false;
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
        filingStatus(company),
        company.registerNumber,
        company.registerNumber ? `#${company.registerNumber}` : "",
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
    if (state.sortBy === "register") return (Number(b.registerNumber) || 0) - (Number(a.registerNumber) || 0);
    if (state.sortBy === "nearest") {
      const difference = companyDistanceKm(a) - companyDistanceKm(b);
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name);
  });

  state.filtered = list;
}

function refreshWorkspace({ refreshDrawer = true } = {}) {
  computeFiltered();
  updateRadiusCircle();

  document.getElementById("os-result-count").textContent = state.filtered.length.toLocaleString();
  document.getElementById("os-result-detail").textContent = ` MOAs · ${state.filtered.filter(hasCoordinates).length} mapped`;

  const clearBtn = document.getElementById("os-search-clear");
  if (clearBtn) clearBtn.hidden = state.searchQuery.length === 0;

  if (!state.filtered.some(c => c.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id || null;
  }

  renderMarkers();
  renderInspector();
  if (state.activePanel && refreshDrawer) renderActiveDrawer();
}

/* Selection & Right Floating Inspector ----------------------------------- */
function selectCompany(companyId, options = {}) {
  const { pan = true, expandMobile = false, closeDrawerOnMobile = false, fromCatalog = false } = options;
  const company = state.companies.find(c => c.id === companyId);
  if (!company) return;

  state.selectedId = company.id;
  const mobile = isMobileViewport();
  inspectorFromCatalog = mobile && fromCatalog;
  if (closeDrawerOnMobile && mobile) {
    closeDrawer();
  }
  if (mobile && expandMobile) {
    state.mobileSheet = "expanded";
    state.inspectorOpen = true;
  } else if (!mobile) {
    state.inspectorOpen = true;
  }

  syncHudAttributes();
  renderMarkers();
  renderInspector();

  if (state.activePanel === "catalog" || state.activePanel === "inventory") {
    renderActiveDrawer();
  }

  if (pan && map && hasCoordinates(company)) {
    map.flyTo([company.lat, company.lng], Math.max(map.getZoom(), 12), { duration: 0.65 });
  }

  if (inspectorFromCatalog) {
    document.querySelector("#os-inspector-content .os-insp-title")?.focus();
  } else if (fromCatalog) {
    document.querySelector(`.os-mini-open[data-inspect-id="${CSS.escape(company.id)}"]`)?.focus();
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

  const backToResults = document.getElementById("btn-inspector-results");
  if (backToResults) backToResults.hidden = !inspectorFromCatalog || state.mobileSheet !== "expanded" || !isMobileViewport();

  document.getElementById("os-browse-results")?.setAttribute("aria-expanded", String(state.activePanel === "catalog"));
  document.querySelectorAll(".os-nav-btn, .os-dock-btn").forEach(btn => {
    const active = btn.dataset.panel === state.activePanel;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-controls", "os-drawer");
    btn.setAttribute("aria-expanded", String(active));
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

  const company = state.companies.find(c => c.id === state.selectedId);
  if (!company) {
    content.innerHTML = `<p style="color:var(--ink-muted); font-size:0.86rem;">No agreements match the current filters.</p>`;
    actions.innerHTML = "";
    if (peek) peek.innerHTML = "";
    if (statusEl) statusEl.textContent = "MOA Register";
    if (bookmarkBtn) bookmarkBtn.disabled = true;
    if (reopenLabel) reopenLabel.textContent = "Agreement details";
    return;
  }

  const campus = getCampus();
  const dist = distanceLabel(company);
  const isFull = company.slots === 0;
  const savedSet = new Set(DatabaseService.getBookmarks());
  const isSaved = savedSet.has(company.id);
  const isRegisterRecord = Boolean(company.registerNumber);

  if (statusEl) {
    statusEl.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${escapeHtml(isRegisterRecord ? `REGISTER № ${company.registerNumber}` : company.moaRef || "MOA record")}</span>`;
  }
  if (bookmarkBtn) {
    bookmarkBtn.disabled = false;
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
          <div class="os-peek-sub">${escapeHtml(isRegisterRecord ? filingStatus(company) : `${dist} · ${slotLabel(company)}`)}</div>
        </div>
      </div>
      <div class="os-peek-actions">
        <button type="button" class="os-peek-btn" id="btn-mobile-expand-sheet">Inspect</button>
        <button type="button" class="os-peek-close" id="btn-mobile-hide-sheet" aria-label="Hide partner bar">&times;</button>
      </div>
    `;
    peek.querySelector("#btn-mobile-expand-sheet")?.addEventListener("click", e => {
      e.stopPropagation();
      state.mobileSheet = "expanded";
      syncHudAttributes();
    });
    peek.querySelector("#btn-mobile-hide-sheet")?.addEventListener("click", e => {
      e.stopPropagation();
      state.mobileSheet = "hidden";
      syncHudAttributes();
    });
  }

  if (isRegisterRecord) {
    content.innerHTML = `
      <div class="os-insp-header">
        <div class="os-monogram">${escapeHtml(company.name.slice(0, 2).toUpperCase())}</div>
        <div>
          <h3 class="os-insp-title" tabindex="-1">${escapeHtml(company.name)}</h3>
          <p class="os-insp-cat">${escapeHtml(filingStatus(company))}</p>
        </div>
      </div>
      <div class="os-kv-list">
        <div class="os-kv-row"><span>Date signed</span><span>${escapeHtml(formatAgreementDate(company.signedOn))}</span></div>
        <div class="os-kv-row"><span>Agreement term</span><span>${escapeHtml(company.agreementTerm || "Not listed")}</span></div>
        <div class="os-kv-row"><span>Contract end</span><span>${escapeHtml(formatAgreementDate(company.endsOn))}</span></div>
        <div class="os-kv-row"><span>Placement type</span><span>Face-to-face OJT</span></div>
      </div>
      <div class="os-insp-block">
        <h4>Location</h4>
        <p>${hasCoordinates(company) ? escapeHtml(`${company.address} · ${dist} from ${campus.shortName}`) : "The MOA register does not list a location for this partner."}</p>
      </div>
    `;
    const locationQuery = hasCoordinates(company) ? `${company.lat},${company.lng}` : company.name;
    actions.innerHTML = `
      <a href="https://www.google.com/maps/search/?api=1&query=${escapeHtml(encodeURIComponent(locationQuery))}" target="_blank" rel="noopener noreferrer" class="os-btn-ghost">
        ${hasCoordinates(company) ? "Open location in Maps" : "Search name in Maps"}
      </a>
    `;
    return;
  }

  content.innerHTML = `
    <div class="os-insp-header">
      <div class="os-monogram" style="width:44px; height:44px; font-size:0.9rem;">
        ${escapeHtml(company.name.slice(0, 2).toUpperCase())}
      </div>
      <div style="min-width:0;">
        <h3 class="os-insp-title" tabindex="-1">${escapeHtml(company.name)}</h3>
        <p class="os-insp-cat">${escapeHtml(company.category || company.type)}</p>
      </div>
    </div>

    <div class="os-insp-stats">
      <div class="os-insp-stat">
        <small>From ${escapeHtml(campus.shortName.split(" ")[0])}</small>
        <strong class="num is-accent">${dist}</strong>
      </div>
      <div class="os-insp-stat">
        <small>Open Slots</small>
        <strong class="num ${isFull ? "is-coral" : "is-sage"}">${isFull ? "Full (0)" : company.slots ?? "Not listed"}</strong>
      </div>
      <div class="os-insp-stat">
        <small>Work Setup</small>
        <strong>${escapeHtml(company.workSetup || "Not listed")}</strong>
      </div>
    </div>

    ${hasCoordinates(company) ? `<div class="os-insp-location">
      <div>
        <p>${escapeHtml(company.address)}</p>
        <span class="os-insp-coords">${Number(company.lat).toFixed(4)}, ${Number(company.lng).toFixed(4)} · ${escapeHtml(company.hub || "Calabarzon")}</span>
      </div>
      <button type="button" class="os-icon-btn" id="btn-insp-fly" title="Center map on partner" aria-label="Center map on partner">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.6" /></svg>
      </button>
    </div>` : ""}

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
      <div class="os-kv-row"><span>MOA Validity</span><span>${escapeHtml(filingStatus(company))}</span></div>
      <div class="os-kv-row"><span>Tracks</span><span>${escapeHtml((company.accepts || ["OJT / Internship"]).join(", "))}</span></div>
      <div class="os-kv-row"><span>Stipend</span><span>${escapeHtml(company.allowanceDesc || (company.hasAllowance ? "Allowance provided" : "Not listed"))}</span></div>
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
    ${hasCoordinates(company) ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.lat},${company.lng}`)}" target="_blank" rel="noopener noreferrer" class="os-btn-ghost">Directions</a>` : ""}
  `;
}

/* Contextual Drawer Modules ---------------------------------------------- */
function openDrawer(panelKey, { trigger = null, focus = false } = {}) {
  if (state.activePanel === panelKey) {
    closeDrawer();
    return;
  }
  state.activePanel = panelKey;
  drawerTrigger = trigger;
  if (isMobileViewport() && state.mobileSheet === "expanded") state.mobileSheet = "peek";

  const drawer = document.getElementById("os-drawer");
  const titleEl = document.getElementById("os-drawer-title");
  const subEl = document.getElementById("os-drawer-subtitle");
  const meta = DRAWER_META[panelKey] || DRAWER_META.catalog;

  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;
  if (drawer) drawer.hidden = false;

  syncHudAttributes();
  renderActiveDrawer();
  const body = document.getElementById("os-drawer-body");
  if (body) body.scrollTop = 0;
  if (focus) titleEl?.focus();
}

function closeDrawer({ restoreFocus = false } = {}) {
  state.activePanel = null;
  const drawer = document.getElementById("os-drawer");
  if (drawer) drawer.hidden = true;
  syncHudAttributes();

  if (restoreFocus) drawerTrigger?.focus();
  drawerTrigger = null;
}

function returnToCatalog() {
  const id = state.selectedId;
  inspectorFromCatalog = false;
  const catalogNav = document.querySelector('.os-dock-btn[data-panel="catalog"]');
  openDrawer("catalog", { trigger: catalogNav, focus: true });
  if (id) document.querySelector(`.os-mini-open[data-inspect-id="${CSS.escape(id)}"]`)?.focus();
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
  const programs = [...new Set(state.companies.flatMap(company => company.programs || []))].sort();
  const tracks = [...new Set(state.companies.flatMap(company => company.accepts || []))].sort();
  const hasAllowanceInfo = state.companies.some(company => typeof company.hasAllowance === "boolean");
  body.innerHTML = `
    <div>
      <span class="os-section-label"><span>Measure from campus</span></span>
      <div class="os-seg-grid" id="os-campus-pills" role="group" aria-label="Campus for distance">
        ${Object.values(CAMPUSES)
          .map(c => `<button type="button" class="os-seg-btn ${c.id === state.campusKey ? "active" : ""}" data-campus="${escapeHtml(c.id)}" aria-pressed="${c.id === state.campusKey}">${escapeHtml(c.shortName.replace(" Campus", ""))}</button>`)
          .join("")}
      </div>
    </div>

    <div class="os-slider-card">
      <div class="os-slider-head">
        <label for="os-radius-slider">Maximum distance</label>
        <span class="os-slider-val" id="os-radius-label">${state.radiusKm >= 120 ? "All (No Limit)" : `Within ${state.radiusKm} km`}</span>
      </div>
      <input type="range" id="os-radius-slider" class="os-range" min="10" max="120" step="5" value="${state.radiusKm}" aria-describedby="os-radius-note" style="--pct:${pct}%;" />
      <p class="os-toggle-sub" id="os-radius-note">A distance limit only includes partners with known locations.</p>
    </div>

    <div>
      <label class="os-section-label" for="os-filter-program"><span>Eligible Program</span></label>
      <select id="os-filter-program" class="os-select" ${programs.length ? "" : "disabled"}>
        <option value="all">${programs.length ? "All programs" : "No program eligibility listed"}</option>
        ${programs.map(program => `<option value="${escapeHtml(program)}">${escapeHtml(program)}</option>`).join("")}
      </select>
    </div>

    <div>
      <label class="os-section-label" for="os-filter-accepts"><span>Opportunity Track</span></label>
      <select id="os-filter-accepts" class="os-select" ${tracks.length > 1 ? "" : "disabled"}>
        <option value="all">${escapeHtml(tracks.length > 1 ? "All tracks" : tracks[0] || "No tracks listed")}</option>
        ${tracks.length > 1 ? tracks.map(track => `<option value="${escapeHtml(track)}">${escapeHtml(track)}</option>`).join("") : ""}
      </select>
    </div>

    <div class="os-toggle-row">
      <div>
        <div class="os-toggle-title">Paid Allowance Only</div>
        <div class="os-toggle-sub">${hasAllowanceInfo ? "Filter partners providing a stipend or shuttle" : "Allowance information is unavailable."}</div>
      </div>
      <button type="button" class="os-switch" id="os-allowance-toggle" role="switch" aria-checked="${state.allowanceOnly}" aria-label="Paid allowance only" ${hasAllowanceInfo ? "" : "disabled"}></button>
    </div>

    <button type="button" class="os-btn-ghost" id="os-distance-reset">Reset All Filters</button>
  `;

  body.querySelector("#os-filter-program").value = programs.includes(state.programFilter) ? state.programFilter : "all";
  body.querySelector("#os-filter-accepts").value = tracks.length > 1 && tracks.includes(state.acceptsFilter) ? state.acceptsFilter : "all";

  body.querySelectorAll("#os-campus-pills .os-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.campusKey = btn.dataset.campus;
      updateCampusMarker();
      refreshWorkspace();
      body.querySelector(`[data-campus="${state.campusKey}"]`)?.focus();
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
    refreshWorkspace({ refreshDrawer: false });
  });

  body.querySelector("#os-filter-program").addEventListener("change", e => {
    state.programFilter = e.target.value;
    refreshWorkspace({ refreshDrawer: false });
  });

  body.querySelector("#os-filter-accepts").addEventListener("change", e => {
    state.acceptsFilter = e.target.value;
    refreshWorkspace({ refreshDrawer: false });
  });

  body.querySelector("#os-allowance-toggle").addEventListener("click", event => {
    state.allowanceOnly = !state.allowanceOnly;
    event.currentTarget.setAttribute("aria-checked", String(state.allowanceOnly));
    refreshWorkspace({ refreshDrawer: false });
  });

  body.querySelector("#os-distance-reset").addEventListener("click", () => {
    resetFilters();
    body.querySelector("#os-distance-reset")?.focus();
  });
}

function renderCatalogPane(body) {
  const savedSet = new Set(DatabaseService.getBookmarks());
  const filters = [
    state.searchQuery.trim() && `“${state.searchQuery.trim()}”`,
    state.activeCategory !== "ALL" && document.querySelector(".os-cat-pill.active")?.textContent,
    state.radiusKm < 120 && `Within ${state.radiusKm} km of ${getCampus().shortName}`,
    state.programFilter !== "all" && state.programFilter,
    state.acceptsFilter !== "all" && state.acceptsFilter,
    state.allowanceOnly && "Paid allowance"
  ].filter(Boolean);
  body.innerHTML = `
    <div class="os-catalog-toolbar">
      <span class="os-section-label" id="os-catalog-count" style="margin:0;">${state.filtered.length.toLocaleString()} of ${state.companies.length.toLocaleString()} agreements</span>
      ${filters.length ? `<button type="button" class="os-btn-ghost" id="os-catalog-reset">Clear filters</button>` : ""}
    </div>
    ${filters.length ? `<p class="os-catalog-filters">${escapeHtml(filters.join(" · "))}</p>` : ""}

    <div class="os-seg-grid cols-3" id="os-sort-pills" role="group" aria-label="Sort agreements">
      <button type="button" class="os-seg-btn ${state.sortBy === "nearest" ? "active" : ""}" data-sort="nearest" aria-pressed="${state.sortBy === "nearest"}">Nearest</button>
      <button type="button" class="os-seg-btn ${state.sortBy === "register" ? "active" : ""}" data-sort="register" aria-pressed="${state.sortBy === "register"}">Register #</button>
      <button type="button" class="os-seg-btn ${state.sortBy === "name" ? "active" : ""}" data-sort="name" aria-pressed="${state.sortBy === "name"}">A–Z</button>
    </div>

    <div class="os-catalog-list" id="os-catalog-list">
      ${
        state.filtered.length === 0
          ? `<div class="os-catalog-empty os-ai-msg is-bot">
              <strong>${filters.length ? "No matching agreements" : "No agreements available"}</strong>
              <p>${filters.length ? "Try a shorter search or clear the filters to browse the full register." : "Reload the radar or try again once the directory is available."}</p>
            </div>`
          : state.filtered.slice(0, state.catalogLimit)
              .map(c => {
                const saved = savedSet.has(c.id);
                return `
                  <article class="os-mini-card ${c.id === state.selectedId ? "selected" : ""}" data-company-id="${escapeHtml(c.id)}">
                    <div class="os-mini-top">
                      <div class="os-monogram">${escapeHtml(c.name.slice(0, 2).toUpperCase())}</div>
                      <div class="os-mini-meta">
                        <h3><button type="button" class="os-mini-open" data-inspect-id="${escapeHtml(c.id)}" aria-controls="os-inspector" aria-current="${c.id === state.selectedId}">${escapeHtml(c.name)}</button></h3>
                        <span>${escapeHtml(c.registerNumber ? `Register № ${c.registerNumber}` : c.hub || c.address || "MOA record")}</span>
                      </div>
                      <button type="button" class="os-icon-btn ${saved ? "is-saved" : ""}" data-bookmark-id="${escapeHtml(c.id)}" aria-label="Shortlist: ${escapeHtml(c.name)}" title="${saved ? "Remove from shortlist" : "Save to shortlist"}" aria-pressed="${saved}" style="width:30px;height:30px;font-size:0.85rem;">
                        ${saved ? "★" : "☆"}
                      </button>
                    </div>
                    <div class="os-mini-bottom">
                      <span class="os-dist-badge">${escapeHtml(distanceLabel(c))}</span>
                      ${c.registerNumber
                        ? `<span class="os-filing-status ${c.moaStatus === "NOTARIZED" ? "is-notarized" : ""}">${escapeHtml(filingStatus(c))}</span>`
                        : `<span class="os-slots-txt ${c.slots === 0 ? "is-full" : ""}">${escapeHtml(slotLabel(c))}</span>`}
                    </div>
                  </article>
                `;
              })
              .join("")
      }
    </div>
    ${state.filtered.length > state.catalogLimit ? `<button type="button" class="os-btn-ghost" id="os-catalog-more">Show more agreements</button>` : ""}
  `;

  body.querySelector("#os-catalog-reset")?.addEventListener("click", () => {
    resetFilters();
    document.getElementById("os-drawer-title")?.focus();
  });

  body.querySelector("#os-catalog-more")?.addEventListener("click", () => {
    const firstNew = state.filtered[state.catalogLimit];
    state.catalogLimit += CATALOG_PAGE_SIZE;
    renderCatalogPane(body);
    body.querySelector(`[data-inspect-id="${CSS.escape(firstNew.id)}"]`)?.focus();
  });

  body.querySelectorAll("#os-sort-pills .os-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.sortBy = btn.dataset.sort;
      state.catalogLimit = CATALOG_PAGE_SIZE;
      refreshWorkspace();
      body.querySelector(`[data-sort="${state.sortBy}"]`)?.focus();
    });
  });

  body.querySelectorAll(".os-mini-card[data-company-id]").forEach(card => {
    const id = card.dataset.companyId;
    card.addEventListener("click", () => {
      selectCompany(id, { expandMobile: true, closeDrawerOnMobile: true, fromCatalog: true });
    });
  });

  body.querySelectorAll("[data-bookmark-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.bookmarkId;
      toggleBookmark(id);
      body.querySelector(`[data-bookmark-id="${CSS.escape(id)}"]`)?.focus();
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
  const wantsNearest = /\b(nearest|closest|near)\b/.test(q);
  const wantsSoftware = /\b(software|cloud|web|ai|ml|data|fintech|saas)\b/.test(q);
  const wantsHardware = /\b(hardware|semicon|semiconductor|fpga|embedded|robotics|manufacturing|plc|ic)\b/.test(q);
  const wantsEnergy = /\b(energy|power|scada|petrochemical|lng|plant)\b/.test(q);
  const searchText = q.replace(/^(?:find|search for|show me)\s+/, "").trim();

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

      if (c.moaStatus && q.includes(c.moaStatus.toLowerCase())) {
        score += 32;
        reasons.push(filingStatus(c));
      }
      if (searchText && c.name.toLowerCase().includes(searchText)) {
        score += 40;
        reasons.push("Organization name");
      }
      if (wantsNearest && Number.isFinite(dist)) {
        score += 1 + Math.max(0, 35 - dist * 0.6);
        reasons.push(distanceLabel(c));
      }
      if (score > 0 && c.slots > 0) score += Math.min(18, c.slots);
      return { company: c, score, reasons };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    summary: scored.length
      ? `${scored.length} matches from the available agreement details.`
      : "No matches in the available details. Try an organization name or filing status.",
    matches: scored
  };
}

function renderAiPane(body) {
  if (state.aiMessages.length === 0) {
    state.aiMessages.push({
      role: "bot",
      text: "Search by organization or filing status, or find mapped partners nearest your campus."
    });
  }

  body.innerHTML = `
    <div class="os-ai-prompts" id="os-ai-prompts">
      <button type="button" class="os-ai-chip" data-prompt="Find notarized agreements">Notarized agreements</button>
      <button type="button" class="os-ai-chip" data-prompt="Find nearest mapped partners">Nearest mapped</button>
      <button type="button" class="os-ai-chip" data-prompt="Find Epson">Find Epson</button>
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
                      <span>${escapeHtml(reasons.join(" · "))}</span>
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
  const mapped = state.filtered.filter(hasCoordinates);
  const nearestKm = mapped.length ? Math.min(...mapped.map(companyDistanceKm)).toFixed(1) : null;
  const totalCount = Math.max(state.filtered.length, 1);
  const notarized = state.filtered.filter(c => c.moaStatus?.toUpperCase() === "NOTARIZED").length;
  const unlisted = state.filtered.filter(c => !c.moaStatus).length;
  const rings = [
    { label: "Notarized", count: notarized, r: 42, color: "var(--os-accent)" },
    { label: "Other filing status", count: state.filtered.length - notarized - unlisted, r: 31, color: "#ffffff" },
    { label: "Status not listed", count: unlisted, r: 20, color: "#8a8a96" }
  ].map(ring => ({ ...ring, pct: Math.round(ring.count / totalCount * 100) }));

  body.innerHTML = `
    <div class="os-kpi-grid">
      <div class="os-kpi-card">
        <div class="os-kpi-label">Filtered MOAs</div>
        <div class="os-kpi-val num" id="os-inv-moas">${state.filtered.length}</div>
        <span class="os-kpi-pill">of ${state.companies.length} total</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Mapped Partners</div>
        <div class="os-kpi-val num">${mapped.length}</div>
        <span class="os-kpi-pill">Known locations</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Nearest Partner</div>
        <div class="os-kpi-val num" id="os-inv-nearest">${nearestKm ? `${nearestKm} km` : "—"}</div>
        <span class="os-kpi-pill">${escapeHtml(getCampus().shortName.split(" ")[0])}</span>
      </div>
      <div class="os-kpi-card">
        <div class="os-kpi-label">Saved Shortlist</div>
        <div class="os-kpi-val num" id="os-inv-saved">${savedCompanies.length}</div>
        <span class="os-kpi-pill">In browser</span>
      </div>
    </div>

    <div class="os-ring-card">
      <span class="os-section-label" style="margin:0;"><span>Filing status breakdown</span></span>
      <div class="os-ring-wrap">
        <svg id="os-sector-ring-svg" width="108" height="108" viewBox="0 0 108 108" aria-label="Filing status breakdown">
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
                    <span>${escapeHtml(filingStatus(c))} · ${escapeHtml(distanceLabel(c))}</span>
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
      <button type="button" class="os-btn-ghost" id="os-export-shortlist" ${savedCompanies.length ? "" : "disabled"}>Export Shortlist</button>
    </div>
  `;

  body.querySelectorAll("[data-shortlist-open]").forEach(el => {
    el.addEventListener("click", () => selectCompany(el.dataset.shortlistOpen, { pan: true, expandMobile: true, closeDrawerOnMobile: true }));
  });
  body.querySelectorAll("[data-shortlist-rm]").forEach(btn => {
    btn.addEventListener("click", () => toggleBookmark(btn.dataset.shortlistRm));
  });
  body.querySelector("#os-export-filtered")?.addEventListener("click", () => exportCSV(state.filtered, "Filtered"));
  body.querySelector("#os-export-shortlist")?.addEventListener("click", () => exportCSV(savedCompanies, "Shortlist"));
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
    const hasPrograms = state.companies.some(company => company.programs?.length);
    state.programFilter = hasPrograms ? body.querySelector("#os-prof-program").value : "all";
    state.campusKey = body.querySelector("#os-prof-campus")?.value || "alangilan";
    updateCampusMarker();
    refreshWorkspace();
    showToast(hasPrograms
      ? `Filtered Opportunity Radar for ${state.programFilter} from ${getCampus().shortName}.`
      : `Campus set to ${getCampus().shortName}. The register does not list eligible programs.`);
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

function syncFilingFilters() {
  document.querySelectorAll(".os-cat-pill").forEach(button => {
    const active = button.dataset.cat === state.activeCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function resetFilters() {
  state.searchQuery = "";
  state.activeCategory = "ALL";
  state.programFilter = "all";
  state.acceptsFilter = "all";
  state.radiusKm = 120;
  state.allowanceOnly = false;
  state.sortBy = "register";
  state.catalogLimit = CATALOG_PAGE_SIZE;

  const searchInput = document.getElementById("os-search-input");
  if (searchInput) searchInput.value = "";
  syncFilingFilters();

  refreshWorkspace();
  fitAllPins();
}

function exportCSV(companies, label) {
  downloadCompaniesCsv(companies, label, company => hasCoordinates(company) ? companyDistanceKm(company).toFixed(1) : "");
}

async function loadDirectory() {
  const res = await DatabaseService.loadCompanies();
  state.companies = res.companies || [];

  if (res.error) showToast(res.error, true);
  else if (res.source === "google-sheets") showToast("Live synced with published Google Sheet CSV.");

  refreshWorkspace();
  fitAllPins();
}

function bindVerticalSwipe(el, { onSwipeDown, onSwipeUp } = {}) {
  if (!el) return;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  el.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener("touchend", e => {
    if (!tracking || !e.changedTouches.length) return;
    tracking = false;
    const dx = Math.abs(e.changedTouches[0].clientX - startX);
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) < 36 || Math.abs(dy) <= dx * 1.2) return;
    if (dy > 0) onSwipeDown?.();
    else onSwipeUp?.();
  }, { passive: true });
}

function initMobileSheetGestures() {
  const drawerHead = document.querySelector("#os-drawer .os-drawer-head");
  const drawerGrabber = document.querySelector("#os-drawer .os-sheet-grabber");
  const inspGrabber = document.getElementById("os-inspector-grabber");
  const inspTopbar = document.querySelector("#os-inspector .os-inspector-topbar");
  const inspPeek = document.getElementById("os-inspector-peek");

  const collapseInspectorToPeek = () => {
    if (!isMobileViewport()) return;
    state.mobileSheet = "peek";
    syncHudAttributes();
  };

  bindVerticalSwipe(drawerHead, { onSwipeDown: closeDrawer });
  drawerGrabber?.addEventListener("click", closeDrawer);

  bindVerticalSwipe(inspGrabber, { onSwipeDown: collapseInspectorToPeek });
  bindVerticalSwipe(inspTopbar, { onSwipeDown: collapseInspectorToPeek });
  inspGrabber?.addEventListener("click", collapseInspectorToPeek);

  bindVerticalSwipe(inspPeek, {
    onSwipeUp: () => {
      if (!isMobileViewport()) return;
      state.mobileSheet = "expanded";
      syncHudAttributes();
    },
    onSwipeDown: () => {
      if (!isMobileViewport()) return;
      state.mobileSheet = "hidden";
      syncHudAttributes();
    }
  });
}

function initLaunchArrival() {
  const root = document.documentElement;
  if (!root.classList.contains("os-launch-entering")) return;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.replace("os-launch-entering", "os-launch-settling");
    window.setTimeout(() => root.classList.remove("os-launch-settling"), 320);
  }));
}

/* Boot & Event Bindings -------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  state.basemap = state.prefs.basemap || "satellite";
  state.showRadius = state.prefs.showRadius !== false;
  state.campusKey = state.profile.campus && CAMPUSES[state.profile.campus] ? state.profile.campus : "alangilan";
  state.mobileSheet = isMobileViewport() ? "peek" : "expanded";

  initLaunchArrival();
  initMap();
  syncHudAttributes();
  initMobileSheetGestures();
  loadDirectory();

  /* Search & Category Pills */
  const searchInput = document.getElementById("os-search-input");
  searchInput?.addEventListener("input", e => {
    state.searchQuery = e.target.value;
    state.catalogLimit = CATALOG_PAGE_SIZE;
    if (state.searchQuery.trim() && state.activePanel !== "catalog") openDrawer("catalog", { trigger: searchInput });
    refreshWorkspace();
  });

  const browseResults = document.getElementById("os-browse-results");
  browseResults?.addEventListener("click", () => openDrawer("catalog", { trigger: browseResults, focus: true }));
  searchInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    if (state.activePanel !== "catalog") openDrawer("catalog", { trigger: searchInput });
    (document.querySelector(".os-mini-open") || document.getElementById("os-drawer-title"))?.focus();
  });

  document.getElementById("os-search-clear")?.addEventListener("click", () => {
    state.searchQuery = "";
    state.catalogLimit = CATALOG_PAGE_SIZE;
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    refreshWorkspace();
  });

  document.querySelectorAll(".os-cat-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.cat || "ALL";
      state.catalogLimit = CATALOG_PAGE_SIZE;
      if (state.activePanel !== "catalog") openDrawer("catalog", { trigger: btn });
      syncFilingFilters();
      refreshWorkspace();
    });
  });

  /* Left Navigation Rail & Mobile Dock */
  document.querySelectorAll(".os-nav-btn, .os-dock-btn").forEach(btn => {
    btn.addEventListener("click", () => openDrawer(btn.dataset.panel, { trigger: btn, focus: true }));
  });

  document.getElementById("btn-toggle-rail")?.addEventListener("click", () => {
    state.railCollapsed = !state.railCollapsed;
    syncHudAttributes();
  });

  document.getElementById("btn-drawer-close")?.addEventListener("click", () => closeDrawer({ restoreFocus: true }));

  /* Inspector Controls */
  document.getElementById("btn-inspector-results")?.addEventListener("click", returnToCatalog);
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
        closeDrawer({ restoreFocus: document.getElementById("os-drawer").contains(document.activeElement) });
      } else if (inspectorFromCatalog && state.mobileSheet === "expanded" && isMobileViewport()) {
        returnToCatalog();
      }
    }
  });
});
