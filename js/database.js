/**
 * TIERED SYSTEM • MOA Opportunity Board Data & Persistence Layer
 * Handles:
 * Loads the bundled MOA register or a published Google Sheet and stores local additions and bookmarks.
 */

const STORAGE_KEYS = {
  CUSTOM_COMPANIES: "ts_moa_custom_companies_v1",
  BOOKMARKS: "ts_moa_saved_bookmarks_v1",
  SHEET_CSV_URL: "ts_moa_google_sheet_csv_url_v1",
  CACHED_SHEET_DATA: "ts_moa_cached_sheet_data_v1",
  STUDENT_PROFILE: "ts_moa_student_profile_v1",
  OS_PREFS: "ts_moa_os_prefs_v1"
};

const DEFAULT_PROFILE = {
  name: "",
  program: "CpE",
  campus: "alangilan",
  workSetup: "all",
  tiersCompleted: [1]
};

const DEFAULT_PREFS = {
  basemap: "satellite",
  showRadius: true
};

const CAMPUSES = {
  alangilan: {
    id: "alangilan",
    name: "BatStateU Alangilan (CEA / CICS)",
    shortName: "Alangilan Campus",
    lat: 13.7844,
    lng: 121.0744
  },
  pabloBorbon: {
    id: "pabloBorbon",
    name: "BatStateU Pablo Borbon (Main)",
    shortName: "Pablo Borbon",
    lat: 13.7542,
    lng: 121.0538
  },
  malvar: {
    id: "malvar",
    name: "BatStateU JPLPC Malvar",
    shortName: "Malvar Campus",
    lat: 14.0450,
    lng: 121.1578
  },
  lipa: {
    id: "lipa",
    name: "BatStateU Lipa Campus",
    shortName: "Lipa Campus",
    lat: 13.9566,
    lng: 121.1636
  }
};

function hasCoordinates(company) {
  return Number.isFinite(company.lat) && Math.abs(company.lat) <= 90 &&
    Number.isFinite(company.lng) && Math.abs(company.lng) <= 180;
}

function filingStatus(company) {
  return company.moaStatus || "Status not listed";
}

function formatAgreementDate(value) {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || "");
  if (!parts) return value || "Not listed";
  const [, day, month, year] = parts;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function downloadCompaniesCsv(companies, label, distance = () => "") {
  const fields = [
    "id", "name", "registerNumber", "signedOn", "agreementTerm", "endsOn", "moaStatus",
    "moaRef", "workSetup", "category", "type", "hub", "address", "lat", "lng",
    "distanceKm", "programs", "accepts", "hasAllowance", "allowanceDesc", "slots",
    "moaCoordinator", "contactEmail"
  ];
  const quote = value => {
    const text = Array.isArray(value) ? value.join(";") : String(value ?? "");
    const safeText = typeof value === "string" && /^[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const rows = companies.map(company => fields
    .map(key => quote(key === "distanceKm" ? distance(company) : company[key]))
    .join(","));
  const blob = new Blob([[fields.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Tiered_Systems_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Simple RFC-4180 compliant CSV parser for Google Sheets Published CSV links
 */
function parseCSVToObjects(csvText) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(current.trim());
        if (row.some(cell => cell !== "")) rows.push(row);
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some(cell => cell !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  const parseList = value => (value || "").split(/[;,]/).map(item => item.trim()).filter(Boolean);

  return rows.slice(1).map((vals, idx) => {
    const raw = {};
    headers.forEach((h, i) => {
      raw[h] = vals[i] !== undefined ? vals[i] : "";
    });
    return {
      ...raw,
      id: raw.id || `sheet-${idx + 1}`,
      registerNumber: raw.registerNumber || undefined,
      lat: raw.lat ? Number(raw.lat) : null,
      lng: raw.lng ? Number(raw.lng) : null,
      programs: parseList(raw.programs),
      accepts: parseList(raw.accepts),
      hasAllowance: raw.hasAllowance ? raw.hasAllowance.toLowerCase() === "true" : null,
      slots: raw.slots && Number.isFinite(Number(raw.slots)) ? Number(raw.slots) : null,
      acceptedRoles: parseList(raw.acceptedRoles)
    };
  }).filter(company => company.name);
}

const DatabaseService = {
  async loadCompanies() {
    const customSaved = this.getCustomCompanies();
    const sheetUrl = localStorage.getItem(STORAGE_KEYS.SHEET_CSV_URL);

    // 1. If a Google Sheet CSV URL is configured, attempt live fetch
    if (sheetUrl) {
      try {
        const res = await fetch(sheetUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csvText = await res.text();
        const parsed = parseCSVToObjects(csvText);
        if (parsed.length > 0) {
          localStorage.setItem(STORAGE_KEYS.CACHED_SHEET_DATA, JSON.stringify(parsed));
          return {
            source: "google-sheets",
            companies: [...customSaved, ...parsed],
            error: null
          };
        }
      } catch (err) {
        const cached = localStorage.getItem(STORAGE_KEYS.CACHED_SHEET_DATA);
        if (cached) {
          return {
            source: "cached-sheet",
            companies: [...customSaved, ...JSON.parse(cached)],
            error: `Live Google Sheet unreachable (${err.message}). Showing cached snapshot.`
          };
        }
      }
    }

    // 2. Try loading ./data/companies.json (works on GitHub Pages, Vercel, localhost)
    try {
      const res = await fetch("./data/companies.json");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          return {
            source: "json-file",
            companies: [...customSaved, ...json],
            error: null
          };
        }
      }
    } catch (_) {
      // Return any locally added records if the bundled register cannot be fetched.
    }

    return { source: "local", companies: customSaved, error: "Could not load the bundled MOA register." };
  },

  getCustomCompanies() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_COMPANIES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  },

  addCustomCompany(companyObj) {
    const existing = this.getCustomCompanies();
    existing.unshift(companyObj);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_COMPANIES, JSON.stringify(existing));
    return existing;
  },

  removeCustomCompany(companyId) {
    const next = this.getCustomCompanies().filter(c => c.id !== companyId);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_COMPANIES, JSON.stringify(next));
    return next;
  },

  clearCustomCompanies() {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_COMPANIES);
  },

  getBookmarks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  },

  toggleBookmark(companyId) {
    const current = new Set(this.getBookmarks());
    if (current.has(companyId)) {
      current.delete(companyId);
    } else {
      current.add(companyId);
    }
    const arr = Array.from(current);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(arr));
    return arr;
  },

  getSheetUrl() {
    return localStorage.getItem(STORAGE_KEYS.SHEET_CSV_URL) || "";
  },

  setSheetUrl(url) {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEYS.SHEET_CSV_URL);
      localStorage.removeItem(STORAGE_KEYS.CACHED_SHEET_DATA);
    } else {
      localStorage.setItem(STORAGE_KEYS.SHEET_CSV_URL, url.trim());
    }
  },

  getProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE);
      if (!raw) return { ...DEFAULT_PROFILE, tiersCompleted: [...DEFAULT_PROFILE.tiersCompleted] };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        tiersCompleted: Array.isArray(parsed.tiersCompleted) ? parsed.tiersCompleted : [...DEFAULT_PROFILE.tiersCompleted]
      };
    } catch (_) {
      return { ...DEFAULT_PROFILE, tiersCompleted: [...DEFAULT_PROFILE.tiersCompleted] };
    }
  },

  saveProfile(profile) {
    const merged = {
      ...DEFAULT_PROFILE,
      ...profile,
      tiersCompleted: Array.isArray(profile?.tiersCompleted) ? profile.tiersCompleted : [...DEFAULT_PROFILE.tiersCompleted]
    };
    localStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE, JSON.stringify(merged));
    return merged;
  },

  getPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OS_PREFS);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (_) {
      return { ...DEFAULT_PREFS };
    }
  },

  savePrefs(prefs) {
    const merged = { ...DEFAULT_PREFS, ...prefs };
    localStorage.setItem(STORAGE_KEYS.OS_PREFS, JSON.stringify(merged));
    return merged;
  }
};

window.CAMPUSES = CAMPUSES;
window.DatabaseService = DatabaseService;


export { CAMPUSES, DatabaseService, downloadCompaniesCsv, filingStatus, formatAgreementDate, hasCoordinates, STORAGE_KEYS };
