# TIERED SYSTEM • MOA Opportunity Board & Partner Locator

Interactive web directory and radar map of verified Memorandum of Agreement (MOA) industry partner companies for **Batangas State University (The National Engineering University) — Alangilan Campus**, built for the **Computer Engineering Students' Organization (CURSOR)**.

---

## Project Structure

```text
opportunity-board/
├── index.html                        # Main production entrypoint (GitHub Pages / Vercel ready)
├── css/
│   └── styles.css                    # Tokenized Helixa + Tiered System dark stylesheet
├── js/
│   ├── database.js                   # Data loader, Google Sheets CSV parser & LocalStorage layer
│   └── app.js                        # Map engine, filters, distance calculator & UI controller
├── data/
│   ├── companies.json                # Primary JSON database of verified MOA partner companies
│   └── moa_companies_template.csv    # Spreadsheet template ready to import into Google Sheets
├── design/
│   ├── STACK.md                      # Architecture & tech stack overview
│   └── tokens.md                     # Strict design system tokens & WCAG contrast ratios
├── vercel.json                       # Optional zero-config Vercel deployment settings
└── .gitignore                        # Excludes OS clutter & heavy raw PSD/Blender files
```

---

## How to Deploy to GitHub Pages (100% Free)

1. Create a new repository on GitHub (e.g. `tiered-system-opportunity-board`).
2. Open a terminal inside this `opportunity-board` folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial release: Tiered System MOA Opportunity Board"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch** → Branch: **`main`** / Folder: **`/ (root)`** → click **Save**.
5. Your live website will be published at `https://<your-username>.github.io/<your-repo-name>/` within 60 seconds.

---

## How to Manage & Update the Partner Database

You have **three ways** to add or update partner companies:

### Option A: Edit `data/companies.json` directly in GitHub
Open [`data/companies.json`](./data/companies.json) and add or edit any company entry:
```json
{
  "id": "moa-017",
  "name": "Company Name",
  "category": "Semiconductors & Embedded Systems",
  "type": "Semiconductor",
  "hub": "Lipa / Malvar",
  "address": "Lima Technology Center, Lipa City, Batangas",
  "lat": 14.0270,
  "lng": 121.1565,
  "moaStatus": "Active MOA • Valid thru 2028",
  "moaRef": "BSU-MOA-2025-099",
  "programs": ["CpE", "ECE", "EE"],
  "accepts": ["OJT / Internship", "Fresh Grad Hiring"],
  "workSetup": "On-Site",
  "hasAllowance": true,
  "allowanceDesc": "Monthly Stipend + Shuttle",
  "slots": 10,
  "description": "Company description...",
  "moaCoordinator": "Office of Industry Relations (OIR)",
  "contactEmail": "hr@company.com"
}
```

### Option B: Connect a Live Google Sheet (No-Code for Officers)
1. Upload [`data/moa_companies_template.csv`](./data/moa_companies_template.csv) to Google Sheets.
2. In Google Sheets, click **File → Share → Publish to web**.
3. Select **Entire Document** and **Comma-separated values (.csv)**, then copy the generated URL.
4. On the website, click **`🔗 Data Source`** in the top navigation bar and paste the link—or set `SHEET_CSV_URL` directly inside `js/database.js` so all visitors fetch from your Google Sheet automatically.

### Option C: Add via the In-App `＋ Add Partner` Button
Use the **`＋ Add Partner`** modal to test new pins live on the map, then click **`📥 Export CSV`** to download the updated table.
