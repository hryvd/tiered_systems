/**
 * TIERED SYSTEM • MOA Opportunity Board Application Controller
 */

let allCompanies = [];
let currentMap = null;
let markersLayer = null;
let radiusCircleLayer = null;
let campusMarker = null;
let selectedCompanyId = null;
let activeQuickFilter = "all";
let selectedCampusKey = "alangilan";
let activeTileLayers = [];
const markersMap = {};

const BASEMAP_TILES = {
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Dark Gray Canvas"
  },
  street: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    reference: null,
    attribution: "Tiles &copy; Esri &mdash; Street Map"
  },
  satellite: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    reference: null,
    attribution: "Tiles &copy; Esri &mdash; Satellite Imagery"
  }
};

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* State 2: Render Shimmer Loading Skeletons */
function renderLoadingSkeletons() {
  const container = document.getElementById("companies-container");
  container.innerHTML = Array.from({ length: 4 })
    .map(
      () => `
      <div class="skeleton-card" aria-hidden="true">
        <div style="display:flex; gap:12px; align-items:center;">
          <div class="skeleton-bar" style="width:42px; height:42px; border-radius:10px;"></div>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <div class="skeleton-bar" style="width:68%; height:14px;"></div>
            <div class="skeleton-bar" style="width:42%; height:10px;"></div>
          </div>
        </div>
        <div class="skeleton-bar" style="width:85%; height:10px;"></div>
        <div style="display:flex; gap:6px;">
          <div class="skeleton-bar" style="width:48px; height:18px;"></div>
          <div class="skeleton-bar" style="width:48px; height:18px;"></div>
          <div class="skeleton-bar" style="width:72px; height:18px;"></div>
        </div>
      </div>
    `
    )
    .join("");
}

function showStatusBanner(message, isError = false) {
  const banner = document.getElementById("status-banner");
  const textEl = document.getElementById("status-banner-text");
  if (!banner || !textEl) return;
  textEl.textContent = message;
  banner.classList.toggle("error", isError);
  banner.classList.add("visible");
}

function hideStatusBanner() {
  const banner = document.getElementById("status-banner");
  if (banner) banner.classList.remove("visible");
}

function initMap() {
  currentMap = L.map("opportunity-map", {
    center: [14.05, 121.05],
    zoom: 10,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(currentMap);
  setBasemap("satellite");
  markersLayer = L.layerGroup().addTo(currentMap);
  updateCampusMarker();
}

function setBasemap(styleKey) {
  activeTileLayers.forEach(l => currentMap.removeLayer(l));
  activeTileLayers = [];

  const config = BASEMAP_TILES[styleKey] || BASEMAP_TILES.dark;
  const baseLayer = L.tileLayer(config.base, {
    attribution: config.attribution,
    maxZoom: 18
  }).addTo(currentMap);
  activeTileLayers.push(baseLayer);

  if (config.reference) {
    const refLayer = L.tileLayer(config.reference, {
      maxZoom: 18,
      zIndex: 10
    }).addTo(currentMap);
    activeTileLayers.push(refLayer);
  }

  document.querySelectorAll(".basemap-btn[data-style]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.style === styleKey);
  });
}

function updateCampusMarker() {
  const campus = window.CAMPUSES[selectedCampusKey];
  if (!campus || !currentMap) return;
  if (campusMarker) currentMap.removeLayer(campusMarker);

  const campusIcon = L.divIcon({
    className: "campus-pin-wrapper",
    html: `
      <div style="background:#000000; color:#ffffff; padding:5px 10px; border-radius:6px; font-weight:800; font-family:var(--font-mono); font-size:11px; white-space:nowrap; border:2px solid var(--brand-primary); box-shadow:0 0 14px rgba(255,107,0,0.65); display:flex; align-items:center; gap:5px;">
        <span style="color:var(--brand-primary);">C</span> ${escapeHtml(campus.shortName)}
      </div>
    `,
    iconSize: [165, 30],
    iconAnchor: [82, 15]
  });

  campusMarker = L.marker([campus.lat, campus.lng], { icon: campusIcon })
    .addTo(currentMap)
    .bindPopup(`<b>${escapeHtml(campus.name)}</b><br>Reference origin node for student distance calculation.`);
}

function updateRadiusCircle(radiusKm) {
  if (!currentMap) return;
  if (radiusCircleLayer) currentMap.removeLayer(radiusCircleLayer);
  if (radiusKm >= 120) return;

  const campus = window.CAMPUSES[selectedCampusKey];
  radiusCircleLayer = L.circle([campus.lat, campus.lng], {
    radius: radiusKm * 1000,
    color: "#ff6b00",
    fillColor: "#ff6b00",
    fillOpacity: 0.07,
    weight: 1.6,
    dashArray: "5, 8"
  }).addTo(currentMap);
}

function renderMarkers(companies) {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  const campus = window.CAMPUSES[selectedCampusKey];

  companies.forEach(company => {
    const markerLabel =
      company.type === "Semiconductor"
        ? "SC"
        : company.type === "Software/AI"
        ? "SW"
        : company.type === "Energy"
        ? "EN"
        : company.type === "Telecom"
        ? "TE"
        : "MF";

    const customIcon = L.divIcon({
      className: "custom-marker-wrapper",
      html: `
        <div class="custom-marker-pin ${company.id === selectedCompanyId ? "selected-pin" : ""}" id="marker-${escapeHtml(company.id)}">
          <span class="marker-inner-icon">${markerLabel}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -34]
    });

    const marker = L.marker([company.lat, company.lng], { icon: customIcon });
    const distKm = calculateDistanceKm(campus.lat, campus.lng, company.lat, company.lng);

    const popupHtml = `
      <div style="font-family:var(--font-sans); min-width:220px; padding:2px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <span style="font-size:10px; color:var(--brand-primary); font-weight:800; font-family:var(--font-mono); text-transform:uppercase;">${escapeHtml(company.type)}</span>
          <span style="font-size:10px; font-weight:700; font-family:var(--font-mono); color:var(--brand-primary); background:var(--brand-subtle); padding:1px 6px; border-radius:4px; border:1px solid var(--brand-border);">${distKm} km</span>
        </div>
        <h4 style="font-size:14px; font-weight:800; margin:3px 0 5px 0; color:#ffffff;">${escapeHtml(company.name)}</h4>
        <div style="font-size:11.5px; color:#cbd5e1; margin-bottom:8px;">${escapeHtml(company.address)}</div>
        <div style="display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap;">
          ${company.programs
            .map(
              p =>
                `<span style="background:rgba(255,255,255,0.07); color:#cbd5e1; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; font-family:var(--font-mono);">${escapeHtml(
                  p
                )}</span>`
            )
            .join("")}
        </div>
        <div style="font-size:11px; font-weight:700; color:#34d399; margin-bottom:9px; font-family:var(--font-mono);">Verified · ${escapeHtml(company.moaStatus)}</div>
        <button onclick="window.openCompanyModal('${escapeHtml(company.id)}')" style="width:100%; background:var(--brand-primary); color:#000; border:none; padding:7px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">
          Inspect MOA & Opportunities
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on("click", () => selectCompany(company.id, false));
    markersLayer.addLayer(marker);
    markersMap[company.id] = marker;
  });
}

function renderCompanyCards(companies) {
  const container = document.getElementById("companies-container");
  const countText = document.getElementById("results-count-text");
  const resetBtn = document.getElementById("btn-reset-filters");
  const campus = window.CAMPUSES[selectedCampusKey];
  const savedSet = new Set(window.DatabaseService.getBookmarks());

  countText.textContent = `Showing ${companies.length} of ${allCompanies.length} Partners`;
  const isFiltered = companies.length !== allCompanies.length || activeQuickFilter !== "all";
  resetBtn.style.display = isFiltered ? "inline-block" : "none";

  const totalSlots = companies.reduce((sum, c) => sum + (c.slots || 0), 0);
  document.getElementById("active-slots-count").textContent = `Open Slots: ${totalSlots}`;
  document.getElementById("saved-count-chip").textContent = `Saved (${savedSet.size})`;

  /* State 3: Empty State */
  if (companies.length === 0) {
    container.innerHTML = `
      <div class="empty-state" role="status">
        <div style="font-size:1.1rem; letter-spacing:.15em; color:var(--brand-primary);">NO MATCHES</div>
        <h4>No MOA partners match your current filters</h4>
        <p>Try widening the campus distance radius, switching discipline filters, or clearing your search keywords.</p>
        <button onclick="window.resetAllFilters()" class="btn-ts primary">
          Reset All Filters
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = companies
    .map(c => {
      const distKm = calculateDistanceKm(campus.lat, campus.lng, c.lat, c.lng);
      const isSaved = savedSet.has(c.id);
      const isFull = (c.slots || 0) <= 0;

      return `
        <article 
          class="company-card ${c.id === selectedCompanyId ? "selected" : ""} ${isFull ? "slots-full" : ""}" 
          id="card-${escapeHtml(c.id)}"
          tabindex="0"
          role="button"
          aria-label="${escapeHtml(c.name)} - ${escapeHtml(c.category)}, ${distKm} kilometers away"
          onclick="window.selectCompany('${escapeHtml(c.id)}', true)"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.selectCompany('${escapeHtml(c.id)}', true);}"
        >
          <div class="card-top">
            <div class="company-info-header">
              <div class="company-logo-badge">${escapeHtml(c.name.substring(0, 2).toUpperCase())}</div>
              <div class="company-title-area">
                <h3 title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</h3>
                <span class="company-category">${escapeHtml(c.category)}</span>
              </div>
            </div>
            <div class="card-top-right">
              <span class="moa-verified-pill">MOA Valid</span>
              <button 
                type="button"
                class="bookmark-btn ${isSaved ? "saved" : ""}" 
                title="${isSaved ? "Remove from Saved" : "Save Partner to Shortlist"}"
                aria-label="${isSaved ? "Remove from Saved" : "Save Partner"}"
                onclick="event.stopPropagation(); window.handleToggleBookmark('${escapeHtml(c.id)}')"
              >
                ${isSaved ? "★" : "☆"}
              </button>
            </div>
          </div>

          <div class="card-meta-line">
            <span class="address-truncate" title="${escapeHtml(c.address)}">${escapeHtml(c.address)}</span>
            <span class="distance-tag" title="Straight-line distance from ${escapeHtml(campus.shortName)}">${distKm} km</span>
          </div>

          <div class="card-tags">
            ${c.programs.map(p => `<span class="badge-course">${escapeHtml(p)}</span>`).join("")}
            ${c.workSetup ? `<span class="badge-setup">${escapeHtml(c.workSetup)}</span>` : ""}
            ${c.hasAllowance ? `<span class="badge-perk">Allowance</span>` : ""}
          </div>

          <div class="card-action-bar">
            <span class="slots-indicator ${isFull ? "full" : ""}" title="${isFull ? "Current cohort slots are filled" : "Active internship slots available"}">
              ● ${isFull ? "Cohort Full (0 Slots)" : `${c.slots} Slots Open`}
            </span>
            <button type="button" class="btn-view-details" onclick="event.stopPropagation(); window.openCompanyModal('${escapeHtml(c.id)}')">
              Inspect MOA &rarr;
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getFilteredAndSortedData() {
  const searchVal = document.getElementById("search-input").value.toLowerCase().trim();
  const programVal = document.getElementById("filter-program").value;
  const acceptsVal = document.getElementById("filter-accepts").value;
  const radiusLimit = parseInt(document.getElementById("radius-slider").value, 10);
  const sortOrder = document.getElementById("sort-order").value;
  const campus = window.CAMPUSES[selectedCampusKey];
  const savedSet = new Set(window.DatabaseService.getBookmarks());

  document.getElementById("search-clear-btn").classList.toggle("visible", searchVal.length > 0);
  document.getElementById("slider-val-label").textContent =
    radiusLimit >= 120 ? "All (No Limit)" : `Within ${radiusLimit} km`;
  updateRadiusCircle(radiusLimit);

  const result = allCompanies.filter(company => {
    const dist = parseFloat(calculateDistanceKm(campus.lat, campus.lng, company.lat, company.lng));
    if (radiusLimit < 120 && dist > radiusLimit) return false;

    const matchesSearch =
      !searchVal ||
      company.name.toLowerCase().includes(searchVal) ||
      company.category.toLowerCase().includes(searchVal) ||
      company.address.toLowerCase().includes(searchVal) ||
      (company.hub && company.hub.toLowerCase().includes(searchVal)) ||
      (company.moaRef && company.moaRef.toLowerCase().includes(searchVal)) ||
      company.programs.some(p => p.toLowerCase().includes(searchVal)) ||
      (company.acceptedRoles && company.acceptedRoles.some(r => r.toLowerCase().includes(searchVal)));

    const matchesProgram = programVal === "all" || company.programs.includes(programVal);
    const matchesAccepts =
      acceptsVal === "all" || (company.accepts && company.accepts.includes(acceptsVal));

    let matchesChip = true;
    if (activeQuickFilter === "Saved") {
      matchesChip = savedSet.has(company.id);
    } else if (activeQuickFilter === "Paid Allowance") {
      matchesChip = company.hasAllowance === true;
    } else if (activeQuickFilter === "Software/AI") {
      matchesChip = company.type === "Software/AI";
    } else if (activeQuickFilter === "Semiconductor") {
      matchesChip = company.type === "Semiconductor";
    } else if (activeQuickFilter === "Energy") {
      matchesChip = company.type === "Energy";
    } else if (activeQuickFilter === "Manufacturing") {
      matchesChip = company.type === "Manufacturing";
    }

    return matchesSearch && matchesProgram && matchesAccepts && matchesChip;
  });

  result.sort((a, b) => {
    const distA = parseFloat(calculateDistanceKm(campus.lat, campus.lng, a.lat, a.lng));
    const distB = parseFloat(calculateDistanceKm(campus.lat, campus.lng, b.lat, b.lng));

    if (sortOrder === "nearest") return distA - distB;
    if (sortOrder === "slots") return (b.slots || 0) - (a.slots || 0);
    if (sortOrder === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  return result;
}

function refreshDynamicData() {
  const filtered = getFilteredAndSortedData();
  renderCompanyCards(filtered);
  renderMarkers(filtered);
}

function selectCompany(companyId, panMap = true) {
  selectedCompanyId = companyId;
  const company = allCompanies.find(c => c.id === companyId);
  if (!company) return;

  document.querySelectorAll(".company-card").forEach(el => el.classList.remove("selected"));
  const activeCard = document.getElementById(`card-${companyId}`);
  if (activeCard) {
    activeCard.classList.add("selected");
    activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (panMap && markersMap[companyId]) {
    /* If on mobile and user clicked a card, switch to map view only if requested via modal, otherwise keep smooth */
    currentMap.flyTo([company.lat, company.lng], 14, { duration: 0.7 });
    markersMap[companyId].openPopup();
  }

  document.querySelectorAll(".custom-marker-pin").forEach(pin => pin.classList.remove("selected-pin"));
  const activePin = document.getElementById(`marker-${companyId}`);
  if (activePin) activePin.classList.add("selected-pin");
}

function handleToggleBookmark(companyId) {
  window.DatabaseService.toggleBookmark(companyId);
  refreshDynamicData();
}

function openCompanyModal(companyId) {
  const company = allCompanies.find(c => c.id === companyId);
  if (!company) return;

  const campus = window.CAMPUSES[selectedCampusKey];
  const distKm = calculateDistanceKm(campus.lat, campus.lng, company.lat, company.lng);
  const isFull = (company.slots || 0) <= 0;

  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div style="display:flex; gap:14px; align-items:center; margin-bottom:1.1rem; padding-right:28px;">
      <div class="company-logo-badge" style="width:50px; height:50px; font-size:1.15rem;">
        ${escapeHtml(company.name.substring(0, 2).toUpperCase())}
      </div>
      <div>
        <h2 style="font-size:var(--text-lg); font-weight:800; color:#ffffff;">${escapeHtml(company.name)}</h2>
        <p style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-mono);">
          ${escapeHtml(company.category)} • <strong style="color:var(--brand-primary);">${distKm} km from ${escapeHtml(campus.shortName)}</strong>
        </p>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px; margin-bottom:1rem; font-family:var(--font-mono); display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; font-size:var(--text-xs);">
        <span style="color:var(--text-muted);">MOA Status & Ref:</span>
        <span style="color:var(--status-success); font-weight:800;">✓ ${escapeHtml(company.moaStatus)} (${escapeHtml(company.moaRef || "Verified")})</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:var(--text-xs);">
        <span style="color:var(--text-muted);">Work Arrangement:</span>
        <span style="color:#38bdf8; font-weight:700;">${escapeHtml(company.workSetup || "On-Site")} • ${escapeHtml((company.accepts || ["OJT / Internship"]).join(", "))}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:var(--text-xs);">
        <span style="color:var(--text-muted);">University Focal Liaison:</span>
        <span style="color:#ffffff; font-weight:600;">${escapeHtml(company.moaCoordinator || "Office of Industry Relations")}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:var(--text-xs);">
        <span style="color:var(--text-muted);">Stipend / Benefits:</span>
        <span style="color:var(--brand-primary); font-weight:700;">${escapeHtml(company.allowanceDesc || "Standard Internship")}</span>
      </div>
    </div>

    <div style="margin-bottom:1rem;">
      <h4 style="font-size:var(--text-xs); font-weight:800; margin-bottom:6px; color:#fff; font-family:var(--font-mono); text-transform:uppercase;">Company Overview</h4>
      <p style="font-size:var(--text-sm); color:var(--text-secondary); line-height:1.55;">${escapeHtml(company.description)}</p>
      <p style="font-size:var(--text-xs); color:var(--text-muted); margin-top:6px;"><strong>Location:</strong> ${escapeHtml(company.address)} (${company.lat}, ${company.lng})</p>
    </div>

    <div style="margin-bottom:1rem;">
      <h4 style="font-size:var(--text-xs); font-weight:800; margin-bottom:8px; color:#fff; font-family:var(--font-mono); text-transform:uppercase;">Accepted Engineering & Computing Programs</h4>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${company.programs
          .map(
            p => `
            <span style="background:var(--brand-subtle); color:var(--brand-primary); border:1px solid var(--brand-border); font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; padding:4px 10px; border-radius:6px;">
              ${escapeHtml(p)}
            </span>
          `
          )
          .join("")}
      </div>
    </div>

    ${
      company.acceptedRoles && company.acceptedRoles.length > 0
        ? `
      <div style="margin-bottom:1rem;">
        <h4 style="font-size:var(--text-xs); font-weight:800; margin-bottom:6px; color:#fff; font-family:var(--font-mono); text-transform:uppercase;">Open Internship & Training Tracks</h4>
        <ul style="padding-left:1.2rem; font-size:var(--text-sm); color:var(--text-secondary); line-height:1.6;">
          ${company.acceptedRoles.map(r => `<li><strong>${escapeHtml(r)}</strong></li>`).join("")}
        </ul>
      </div>
    `
        : ""
    }

    ${
      company.requirements && company.requirements.length > 0
        ? `
      <div style="margin-bottom:1.2rem;">
        <h4 style="font-size:var(--text-xs); font-weight:800; margin-bottom:6px; color:#fff; font-family:var(--font-mono); text-transform:uppercase;">Application Requirements</h4>
        <ul style="padding-left:1.2rem; font-size:var(--text-xs); color:var(--text-muted); line-height:1.6;">
          ${company.requirements.map(req => `<li>${escapeHtml(req)}</li>`).join("")}
        </ul>
      </div>
    `
        : ""
    }

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:1.2rem;">
      <button type="button" onclick="window.closeModalAndCenter('${escapeHtml(company.id)}')" class="btn-ts primary" style="flex:1;">
        Locate on radar map
      </button>
      <a 
        href="https://www.google.com/maps/search/?api=1&query=${company.lat},${company.lng}" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="btn-ts"
        style="text-decoration:none;"
      >
        Google Maps directions
      </a>
      ${
        company.contactEmail
          ? `<a href="mailto:${escapeHtml(company.contactEmail)}?subject=BatStateU%20MOA%20Internship%20Inquiry%20-%20${encodeURIComponent(
              company.name
            )}" class="btn-ts" style="text-decoration:none;" ${isFull ? 'aria-disabled="true" style="opacity:0.55;" title="Current cohort slots are filled"' : ""}>
              Inquire (${escapeHtml(company.contactEmail)})
            </a>`
          : ""
      }
    </div>
  `;

  document.getElementById("company-modal").classList.add("active");
}

function closeCompanyModal() {
  document.getElementById("company-modal").classList.remove("active");
}

function closeModalAndCenter(companyId) {
  closeCompanyModal();
  setMobileView("map");
  selectCompany(companyId, true);
}

function resetAllFilters() {
  document.getElementById("search-input").value = "";
  document.getElementById("filter-program").value = "all";
  document.getElementById("filter-accepts").value = "all";
  document.getElementById("radius-slider").value = 120;
  document.getElementById("sort-order").value = "nearest";
  activeQuickFilter = "all";

  document.querySelectorAll(".chip-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.filter === "all");
  });

  refreshDynamicData();
  fitAllPins();
}

function fitAllPins() {
  const data = getFilteredAndSortedData();
  if (data.length === 0 || !currentMap) return;
  const bounds = L.latLngBounds(data.map(c => [c.lat, c.lng]));
  const campus = window.CAMPUSES[selectedCampusKey];
  bounds.extend([campus.lat, campus.lng]);
  currentMap.fitBounds(bounds, { padding: [50, 50], duration: 0.75 });
}

function exportToCSV() {
  const data = getFilteredAndSortedData();
  const campus = window.CAMPUSES[selectedCampusKey];

  let csv =
    "id,name,category,type,hub,address,lat,lng,distanceKm,moaStatus,moaRef,programs,accepts,workSetup,hasAllowance,allowanceDesc,slots,moaCoordinator,contactEmail\n";
  data.forEach(c => {
    const dist = calculateDistanceKm(campus.lat, campus.lng, c.lat, c.lng);
    const row = [
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
    ];
    csv += row.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Tiered_System_MOA_Partners_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function setMobileView(viewMode) {
  const workspace = document.querySelector(".app-workspace");
  if (!workspace) return;
  workspace.setAttribute("data-mobile-view", viewMode);
  document.querySelectorAll(".mobile-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewMode);
  });
  if (viewMode === "map" && currentMap) {
    setTimeout(() => currentMap.invalidateSize(), 60);
  }
}

async function bootApp() {
  renderLoadingSkeletons();
  initMap();

  const res = await window.DatabaseService.loadCompanies();
  allCompanies = res.companies;

  if (res.error) {
    showStatusBanner(res.error, true);
  } else if (res.source === "google-sheets") {
    showStatusBanner("✓ Live synced with committee Google Sheet CSV.", false);
  }

  refreshDynamicData();
}

document.addEventListener("DOMContentLoaded", () => {
  bootApp();

  /* Search & Filter Event Listeners */
  document.getElementById("search-input").addEventListener("input", refreshDynamicData);
  document.getElementById("search-clear-btn").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    refreshDynamicData();
  });
  document.getElementById("filter-program").addEventListener("change", refreshDynamicData);
  document.getElementById("filter-accepts").addEventListener("change", refreshDynamicData);
  document.getElementById("radius-slider").addEventListener("input", refreshDynamicData);
  document.getElementById("sort-order").addEventListener("change", refreshDynamicData);
  document.getElementById("btn-reset-filters").addEventListener("click", resetAllFilters);

  document.getElementById("filter-campus").addEventListener("change", e => {
    selectedCampusKey = e.target.value;
    updateCampusMarker();
    refreshDynamicData();
  });

  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeQuickFilter = btn.dataset.filter;
      refreshDynamicData();
    });
  });

  /* Basemap Switchers */
  document.querySelectorAll(".basemap-btn[data-style]").forEach(btn => {
    btn.addEventListener("click", () => setBasemap(btn.dataset.style));
  });

  document.getElementById("btn-jump-campus").addEventListener("click", () => {
    const campus = window.CAMPUSES[selectedCampusKey];
    currentMap.flyTo([campus.lat, campus.lng], 15, { duration: 0.9 });
  });
  document.getElementById("btn-fit-bounds").addEventListener("click", fitAllPins);

  document.getElementById("btn-export-csv").addEventListener("click", exportToCSV);

  /* Add Partner Modal */
  const addModal = document.getElementById("add-company-modal");
  document.getElementById("btn-open-add-modal").addEventListener("click", () => {
    addModal.classList.add("active");
  });
  document.getElementById("btn-add-modal-close").addEventListener("click", () => {
    addModal.classList.remove("active");
  });
  document.getElementById("btn-cancel-add").addEventListener("click", () => {
    addModal.classList.remove("active");
  });

  document.getElementById("form-add-company").addEventListener("submit", e => {
    e.preventDefault();
    const newCompany = {
      id: "moa-custom-" + Date.now(),
      name: document.getElementById("new-name").value.trim(),
      category: document.getElementById("new-category").value,
      type: document.getElementById("new-category").value,
      hub: "Calabarzon / NCR",
      lat: parseFloat(document.getElementById("new-lat").value),
      lng: parseFloat(document.getElementById("new-lng").value),
      address: document.getElementById("new-address").value.trim(),
      slots: parseInt(document.getElementById("new-slots").value, 10) || 5,
      workSetup: document.getElementById("new-setup").value || "On-Site",
      hasAllowance: document.getElementById("new-allowance").value === "true",
      allowanceDesc:
        document.getElementById("new-allowance").value === "true"
          ? "Allowance Provided"
          : "Standard Educational Immersion",
      moaStatus: "Active MOA • Valid thru " + (new Date().getFullYear() + 2),
      moaRef: "BSU-MOA-NEW",
      programs: document
        .getElementById("new-programs")
        .value.split(",")
        .map(s => s.trim())
        .filter(Boolean),
      accepts: ["OJT / Internship"],
      moaCoordinator: "CURSOR / Office of Industry Relations",
      description:
        document.getElementById("new-desc").value.trim() ||
        "Verified MOA partner added via Opportunity Board."
    };

    window.DatabaseService.addCustomCompany(newCompany);
    allCompanies.unshift(newCompany);
    addModal.classList.remove("active");
    document.getElementById("form-add-company").reset();
    refreshDynamicData();
    selectCompany(newCompany.id, true);
  });

  /* Data Sync (Google Sheets CSV) Modal */
  const syncModal = document.getElementById("sync-modal");
  const sheetInput = document.getElementById("sheet-csv-url-input");
  document.getElementById("btn-open-sync-modal").addEventListener("click", () => {
    sheetInput.value = window.DatabaseService.getSheetUrl();
    syncModal.classList.add("active");
  });
  document.getElementById("btn-sync-modal-close").addEventListener("click", () => {
    syncModal.classList.remove("active");
  });
  document.getElementById("form-sync-sheet").addEventListener("submit", async e => {
    e.preventDefault();
    window.DatabaseService.setSheetUrl(sheetInput.value);
    syncModal.classList.remove("active");
    await bootApp();
  });
  document.getElementById("btn-clear-custom-data").addEventListener("click", async () => {
    window.DatabaseService.clearCustomCompanies();
    window.DatabaseService.setSheetUrl("");
    hideStatusBanner();
    syncModal.classList.remove("active");
    await bootApp();
  });

  /* Company Modal Close */
  document.getElementById("btn-modal-close").addEventListener("click", closeCompanyModal);
  document.getElementById("company-modal").addEventListener("click", e => {
    if (e.target.id === "company-modal") closeCompanyModal();
  });

  /* Mobile Tab View Switcher */
  document.querySelectorAll(".mobile-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setMobileView(btn.dataset.view));
  });

  /* Offline / Online Detection (State 7) */
  window.addEventListener("offline", () => {
    showStatusBanner("Offline mode · Displaying locally cached MOA partner directory.", false);
  });
  window.addEventListener("online", () => {
    hideStatusBanner();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeCompanyModal();
      addModal.classList.remove("active");
      syncModal.classList.remove("active");
    }
  });
});

window.selectCompany = selectCompany;
window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.closeModalAndCenter = closeModalAndCenter;
window.resetAllFilters = resetAllFilters;
window.handleToggleBookmark = handleToggleBookmark;
