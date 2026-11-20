# Stack & Architecture Specification (`STACK.md`)

## Project Overview
- **Project**: Tiered System — MOA Partner Company Directory & Opportunity Board
- **Organization**: Computer Engineering Students' Organization (CURSOR) • BatStateU Alangilan
- **Aesthetic Direction**: Helixa Dark Tech Venture UI + Tiered System Brand System (Solar Orange `#FF6B00`, Obsidian Black `#070709`, Pure White `#FFFFFF`)

## Technology Stack
- **Core Markup & Semantics**: HTML5 with ARIA landmark roles (`<header>`, `<main>`, `<aside>`, `<section>`, `role="dialog"`)
- **Styling Architecture**: Vanilla CSS3 with Strict Design Token Custom Properties (`css/styles.css` & `design/tokens.md`), fluid `clamp()` typography, Flexbox/Grid layout
- **Mapping Engine**: Leaflet.js `1.9.4` + Esri ArcGIS Online Basemaps (Dark Gray Canvas, World Street Map, World Satellite Imagery — 100% API-key-free, works on both `https://` and `file:///`)
- **Database & Persistence Layer**:
  1. **Static JSON Database** (`data/companies.json`) for GitHub Pages / Vercel / Netlify hosting
  2. **Embedded JS Fallback Database** (`js/database.js`) for offline and local `file:///` execution
  3. **Browser `localStorage` Persistence** for custom added partners, student bookmarked companies, and live Google Sheets sync configuration
  4. **Google Sheets Live CSV Connector** allowing non-technical organization officers to update MOA companies from a published Google Sheet (`data/moa_companies_template.csv`)
- **Deployment Target**: GitHub Pages, Vercel, or Netlify (Static Web App, zero build step required)
