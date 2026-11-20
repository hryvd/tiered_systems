/**
 * TIERED SYSTEMS · Direct Administrator Console Controller
 * Manages Opportunity OS defaults (basemap, radius ring), live Google Sheets CSV sync,
 * and local custom MOA partner entries with no login gate.
 */
import "./glass-warp.js";
import "./os-transition.js";
import { DatabaseService } from "./database.js";

const adminState = {
  companies: [],
  customIds: new Set(),
  source: "loading",
  searchQuery: "",
  prefs: DatabaseService.getPrefs()
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(message, isError = false) {
  const toast = document.getElementById("admin-toast");
  const text = document.getElementById("admin-toast-text");
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
}

function hideToast() {
  const toast = document.getElementById("admin-toast");
  if (toast) toast.hidden = true;
}

function formatSourceLabel(source) {
  const labels = {
    "google-sheets": "Google Sheets",
    "cached-sheet": "Cached Sheet",
    "json-file": "Repository JSON",
    "embedded-local": "Embedded Local"
  };
  return labels[source] || "Local Store";
}

function syncPreferenceControls() {
  const basemap = adminState.prefs.basemap || "satellite";
  const showRadius = adminState.prefs.showRadius !== false;

  document.querySelectorAll("#admin-basemap-pills .admin-seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.basemap === basemap);
  });

  const radiusSwitch = document.getElementById("admin-radius-ring-toggle");
  if (radiusSwitch) {
    radiusSwitch.setAttribute("aria-checked", String(showRadius));
  }
}

function renderSummary() {
  const totalEl = document.getElementById("admin-kpi-total");
  const customEl = document.getElementById("admin-kpi-custom");
  const slotsEl = document.getElementById("admin-kpi-slots");
  const sourceEl = document.getElementById("admin-kpi-source");

  const totalSlots = adminState.companies.reduce((sum, c) => sum + (Number(c.slots) || 0), 0);
  if (totalEl) totalEl.textContent = String(adminState.companies.length);
  if (customEl) customEl.textContent = String(adminState.customIds.size);
  if (slotsEl) slotsEl.textContent = String(totalSlots);
  if (sourceEl) sourceEl.textContent = formatSourceLabel(adminState.source);
}

function renderDirectoryTable() {
  const tbody = document.getElementById("admin-partner-list");
  const countEl = document.getElementById("admin-dir-count");
  if (!tbody) return;

  const q = adminState.searchQuery.trim().toLowerCase();
  const visible = adminState.companies.filter(c => {
    if (!q) return true;
    const haystack = [
      c.name,
      c.type,
      c.category,
      c.hub,
      c.address,
      c.moaRef,
      ...(c.programs || [])
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  if (countEl) {
    countEl.textContent = `${visible.length} of ${adminState.companies.length} partners shown`;
  }

  if (visible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty-cell">No partners match "${escapeHtml(adminState.searchQuery)}".</td></tr>`;
    return;
  }

  tbody.innerHTML = visible
    .map(c => {
      const isCustom = adminState.customIds.has(c.id);
      const programsText = (c.programs || []).join(", ") || "—";
      const slotsVal = Number(c.slots) || 0;
      const sectorHub = `${c.type || "Partner"} · ${c.hub || "Batangas"}`;
      return `
        <tr>
          <td class="admin-cell-partner" data-label="Partner">
            <span class="admin-partner-name">${escapeHtml(c.name)}</span>
            <span class="admin-partner-addr">${escapeHtml(c.address || "")}</span>
          </td>
          <td data-label="Sector &amp; Hub">${escapeHtml(sectorHub)}</td>
          <td class="num" data-label="Programs">${escapeHtml(programsText)}</td>
          <td class="num" data-label="Slots">${slotsVal > 0 ? `${slotsVal} open` : "Full"}</td>
          <td data-label="Origin">
            <span class="admin-origin-pill ${isCustom ? "is-custom" : ""}">
              ${isCustom ? "Custom Local" : "Verified Base"}
            </span>
          </td>
          <td class="t-right" data-label="Action">
            ${
              isCustom
                ? `<button type="button" class="admin-btn-ghost is-danger is-sm" data-remove-id="${escapeHtml(c.id)}">Remove</button>`
                : `<span class="admin-muted-txt">${escapeHtml(c.moaRef || "Locked")}</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-remove-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.removeId;
      DatabaseService.removeCustomCompany(id);
      await loadDirectory();
      showToast("Removed custom partner entry from local storage.");
    });
  });
}

async function loadDirectory() {
  const customList = DatabaseService.getCustomCompanies();
  adminState.customIds = new Set(customList.map(c => c.id));

  const res = await DatabaseService.loadCompanies();
  adminState.companies = res.companies || [];
  adminState.source = res.source || "embedded-local";

  if (res.error) {
    showToast(res.error, true);
  }

  renderSummary();
  renderDirectoryTable();
}

function exportDirectoryCSV() {
  const header = "id,name,category,type,hub,address,lat,lng,moaStatus,moaRef,programs,accepts,workSetup,hasAllowance,allowanceDesc,slots,moaCoordinator,contactEmail\n";
  const rows = adminState.companies
    .map(c =>
      [
        `"${c.id || ""}"`,
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.category || "").replace(/"/g, '""')}"`,
        `"${c.type || ""}"`,
        `"${c.hub || ""}"`,
        `"${(c.address || "").replace(/"/g, '""')}"`,
        c.lat,
        c.lng,
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
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([header + rows + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Tiered_Systems_Admin_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  const sheetInput = document.getElementById("admin-sheet-url");
  if (sheetInput) {
    sheetInput.value = DatabaseService.getSheetUrl();
  }

  syncPreferenceControls();
  loadDirectory();

  document.getElementById("admin-toast-dismiss")?.addEventListener("click", hideToast);

  document.querySelectorAll("#admin-basemap-pills .admin-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const styleKey = btn.dataset.basemap || "satellite";
      adminState.prefs = DatabaseService.savePrefs({ ...adminState.prefs, basemap: styleKey });
      syncPreferenceControls();
      showToast(`Default map style set to ${btn.textContent.trim()}.`);
    });
  });

  document.getElementById("admin-radius-ring-toggle")?.addEventListener("click", () => {
    const nextShow = !(adminState.prefs.showRadius !== false);
    adminState.prefs = DatabaseService.savePrefs({ ...adminState.prefs, showRadius: nextShow });
    syncPreferenceControls();
    showToast(`Distance radius ring ${nextShow ? "enabled" : "disabled"}.`);
  });

  document.getElementById("admin-sync-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const url = sheetInput?.value.trim() || "";
    DatabaseService.setSheetUrl(url);
    await loadDirectory();
    if (url && adminState.source === "google-sheets") {
      showToast("Google Sheets CSV saved and live-synced.");
    } else if (!url) {
      showToast("Google Sheets CSV cleared; using default dataset.");
    }
  });

  document.getElementById("admin-clear-sheet")?.addEventListener("click", async () => {
    DatabaseService.setSheetUrl("");
    if (sheetInput) sheetInput.value = "";
    await loadDirectory();
    showToast("Disconnected Google Sheets CSV feed.");
  });

  document.getElementById("admin-export-csv")?.addEventListener("click", exportDirectoryCSV);

  document.getElementById("admin-reset-cache")?.addEventListener("click", async () => {
    DatabaseService.clearCustomCompanies();
    DatabaseService.setSheetUrl("");
    if (sheetInput) sheetInput.value = "";
    hideToast();
    await loadDirectory();
    showToast("Cleared custom local partners and reset cache to defaults.");
  });

  document.querySelectorAll("[data-preset-lat][data-preset-lng]").forEach(btn => {
    btn.addEventListener("click", () => {
      const latEl = document.getElementById("admin-new-lat");
      const lngEl = document.getElementById("admin-new-lng");
      if (latEl) latEl.value = btn.dataset.presetLat;
      if (lngEl) lngEl.value = btn.dataset.presetLng;
    });
  });

  document.getElementById("admin-add-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const lat = parseFloat(document.getElementById("admin-new-lat").value);
    const lng = parseFloat(document.getElementById("admin-new-lng").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast("Enter valid numeric latitude and longitude coordinates.", true);
      return;
    }

    const allow = document.getElementById("admin-new-allowance").value === "true";
    const moaRef = document.getElementById("admin-new-moaref").value.trim() || "BSU-MOA-NEW";
    const contactEmail = document.getElementById("admin-new-email").value.trim();

    const newCompany = {
      id: `moa-custom-${Date.now()}`,
      name: document.getElementById("admin-new-name").value.trim(),
      category: document.getElementById("admin-new-category").value,
      type: document.getElementById("admin-new-category").value,
      hub: "Calabarzon / NCR",
      lat,
      lng,
      address: document.getElementById("admin-new-address").value.trim(),
      slots: parseInt(document.getElementById("admin-new-slots").value, 10) || 0,
      workSetup: document.getElementById("admin-new-setup").value || "On-Site",
      hasAllowance: allow,
      allowanceDesc: allow ? "Allowance Provided" : "Standard Educational Immersion",
      moaStatus: `Active MOA • Valid thru ${new Date().getFullYear() + 2}`,
      moaRef,
      contactEmail,
      programs: document.getElementById("admin-new-programs").value.split(",").map(s => s.trim()).filter(Boolean),
      accepts: ["OJT / Internship"],
      moaCoordinator: "CURSOR / Office of Industry Relations",
      description: document.getElementById("admin-new-desc").value.trim() || "Verified MOA partner added via Administrator settings."
    };

    DatabaseService.addCustomCompany(newCompany);
    e.target.reset();
    document.getElementById("admin-new-slots").value = "10";
    document.getElementById("admin-new-programs").value = "CpE, ECE, EE, CS";
    await loadDirectory();
    showToast(`Added ${newCompany.name} to Opportunity OS.`);
  });

  document.getElementById("admin-dir-search")?.addEventListener("input", e => {
    adminState.searchQuery = e.target.value;
    renderDirectoryTable();
  });
});