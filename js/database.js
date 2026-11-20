/**
 * TIERED SYSTEM • MOA Opportunity Board Data & Persistence Layer
 * Handles:
 * 1. Embedded Verified Dataset (works offline & on file:///)
 * 2. Remote JSON Fetch (./data/companies.json on GitHub Pages / Vercel)
 * 3. Live Google Sheets Published CSV Sync
 * 4. LocalStorage Persistence (Custom Added Partners & Student Saved Bookmarks)
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

const DEFAULT_MOA_COMPANIES = [
  {
    id: "moa-001",
    name: "Analog Devices Gen. Trias (ADGT)",
    category: "Semiconductors & Embedded Systems",
    type: "Semiconductor",
    hub: "Cavite",
    address: "Gateway Business Park, Javalera, General Trias, Cavite",
    lat: 14.2882,
    lng: 120.9126,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2024-018",
    programs: ["CpE", "ECE", "EE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring", "Capstone / Industry Project"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Competitive Monthly Stipend + Free Shuttle Routes",
    slots: 15,
    description: "Global semiconductor leader designing and manufacturing precision analog, mixed-signal, and DSP integrated circuits for industrial, automotive, and communications hardware.",
    moaCoordinator: "Office of Industry Relations (OIR) - Alangilan",
    contactEmail: "university.relations@analog.com",
    website: "https://www.analog.com/en/careers.html",
    acceptedRoles: [
      "Embedded Firmware Verification Intern",
      "Automated Test Equipment (ATE) Hardware Intern",
      "Product & Failure Analysis Engineering Intern"
    ],
    requirements: [
      "Official BatStateU Endorsement Letter",
      "Updated CV with C/C++, Verilog, or Lab Instrumentation projects",
      "Minimum 240–480 required OJT hours"
    ]
  },
  {
    id: "moa-002",
    name: "First Gen Clean Energy Complex",
    category: "Energy, Power Grid & SCADA Automation",
    type: "Energy",
    hub: "Batangas City",
    address: "Brgy. Sta. Rita Aplaya, Batangas City, Batangas",
    lat: 13.7548,
    lng: 121.0315,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-004",
    programs: ["EE", "ME", "ECE", "IE", "CpE"],
    accepts: ["OJT / Internship", "Plant Visit / Immersion"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Daily Meal Subsidy & Batangas City Shuttle",
    slots: 8,
    description: "The Philippines' largest clean and renewable energy producer operating natural gas-fired power plants (Santa Rita, San Lorenzo, San Gabriel, Avion) with industrial SCADA/DCS telemetry.",
    moaCoordinator: "College of Engineering OJT Placement Unit",
    contactEmail: "internship@firstgen.com.ph",
    website: "https://www.firstgen.com.ph",
    acceptedRoles: [
      "Instrumentation & Control Systems Intern",
      "Plant Operations & Reliability Intern",
      "Industrial IT & OT Network Security Intern"
    ],
    requirements: [
      "Endorsement from Department Chair",
      "Medical Clearance & PPE Orientation",
      "Strong foundation in Control Systems or Power Engineering"
    ]
  },
  {
    id: "moa-003",
    name: "Seiko Epson Precision Philippines (SEP)",
    category: "Precision Robotics & Mechatronics",
    type: "Manufacturing",
    hub: "Lipa / Malvar",
    address: "Lima Technology Center, Lipa City / Malvar, Batangas",
    lat: 14.0270,
    lng: 121.1565,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2025-011",
    programs: ["CpE", "ME", "IE", "ECE", "EE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Daily Allowance + Free Canteen Meals + Shuttle Service",
    slots: 25,
    description: "Flagship manufacturing and R&D facility producing high-precision robotic assembly systems, optical projection engines, and micro-piezo printheads.",
    moaCoordinator: "Dean's Office - College of Engineering",
    contactEmail: "recruitment@sep.epson.com.ph",
    website: "https://corporate.epson",
    acceptedRoles: [
      "Factory Automation & PLC Intern",
      "Embedded Firmware Diagnostics Intern",
      "Quality Assurance & Six Sigma Intern"
    ],
    requirements: [
      "BatStateU MOA Endorsement",
      "Academic Transcript of Records (TOR) copy",
      "Interview with SEP Engineering Department"
    ]
  },
  {
    id: "moa-004",
    name: "Accenture Philippines Innovation Hub",
    category: "Enterprise Software, Cloud & GenAI",
    type: "Software/AI",
    hub: "Metro Manila",
    address: "Uptown Bonifacio Tower 2, BGC, Taguig / Alabang Hub",
    lat: 14.5517,
    lng: 121.0531,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2025-002",
    programs: ["CpE", "CS", "IT", "ECE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring", "Capstone / Industry Project"],
    workSetup: "Hybrid",
    hasAllowance: true,
    allowanceDesc: "Paid Internship Allowance + Hybrid Laptop Provision",
    slots: 30,
    description: "Global technology consulting powerhouse delivering cloud-native engineering, AI/ML pipelines, cybersecurity operations, and full-stack digital transformation.",
    moaCoordinator: "CURSOR / CICS & CEA Placement Liaison",
    contactEmail: "campus.ph@accenture.com",
    website: "https://www.accenture.com/ph-en/careers",
    acceptedRoles: [
      "Full-Stack Cloud Engineering Intern",
      "Data & AI Engineering Associate Intern",
      "Cybersecurity & SOC Analyst Intern",
      "Quality Engineering & Test Automation Intern"
    ],
    requirements: [
      "GitHub Portfolio or Capstone Repository",
      "Coding Assessment (Python, Java, JS/TS, or C#)",
      "Official University Endorsement"
    ]
  },
  {
    id: "moa-005",
    name: "Brother Industries (Philippines), Inc.",
    category: "Smart Manufacturing & Industrial IoT",
    type: "Manufacturing",
    hub: "Sto. Tomas",
    address: "First Philippine Industrial Park (FPIP), Sto. Tomas, Batangas",
    lat: 14.1086,
    lng: 121.1610,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-029",
    programs: ["CpE", "IE", "ME", "ECE", "IT"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring", "Plant Visit / Immersion"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Allowance + Shuttle Pick-up (Lipa, Tanauan, Sto. Tomas)",
    slots: 14,
    description: "Large-scale smart factory in FPIP integrating Industry 4.0 IoT sensor networks, automated guided vehicles (AGVs), and lean production systems.",
    moaCoordinator: "Office of Industry Relations (OIR)",
    contactEmail: "biph.careers@brother.com.ph",
    website: "https://global.brother",
    acceptedRoles: [
      "Production Digitalization & IoT Intern",
      "Internal Systems Software Developer Intern",
      "Process & Continuous Improvement Intern"
    ],
    requirements: [
      "Endorsement Letter & MOA Copy",
      "Basic proficiency in Python, SQL, or C# for IT/CpE tracks",
      "Full-time OJT commitment"
    ]
  },
  {
    id: "moa-006",
    name: "Stratpoint Technologies",
    category: "Cloud-Native Software & AI R&D",
    type: "Software/AI",
    hub: "Metro Manila",
    address: "The Podium West Tower, Ortigas Center, Mandaluyong",
    lat: 14.5866,
    lng: 121.0607,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-041",
    programs: ["CpE", "CS", "IT"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "Remote Friendly",
    hasAllowance: true,
    allowanceDesc: "Stipend + Remote-First Mentorship Bootcamp",
    slots: 10,
    description: "Premier digital transformation firm building enterprise-grade React/Next.js apps, Kubernetes cloud infrastructure, and enterprise LLM integrations.",
    moaCoordinator: "Department of Computer Engineering / CICS",
    contactEmail: "careers@stratpoint.com",
    website: "https://stratpoint.com",
    acceptedRoles: [
      "Software Engineer Intern (React / Node.js / Go)",
      "DevOps & AWS Cloud Intern",
      "Mobile App Developer Intern (Flutter / iOS / Android)"
    ],
    requirements: [
      "Technical Coding Exam & Pair Programming Interview",
      "Strong Git workflow and web/mobile fundamentals",
      "Minimum 300 hours internship availability"
    ]
  },
  {
    id: "moa-007",
    name: "Amkor Technology Philippines",
    category: "Semiconductor Packaging & Test Lab",
    type: "Semiconductor",
    hub: "Laguna",
    address: "Laguna Technopark, Biñan, Laguna",
    lat: 14.2818,
    lng: 121.0772,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-019",
    programs: ["ECE", "CpE", "EE", "ME", "IE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Daily Stipend + Shuttle + Subsidized Meals",
    slots: 20,
    description: "Leading outsourced semiconductor assembly and test (OSAT) partner packaging advanced flip-chip, wafer-level, and SiP modules for 5G and AI processors.",
    moaCoordinator: "College of Engineering OJT Committee",
    contactEmail: "ph.recruitment@amkor.com",
    website: "https://amkor.com",
    acceptedRoles: [
      "IC Test Development Intern",
      "Failure Analysis & Reliability Lab Intern",
      "Equipment & Mechatronics Maintenance Intern"
    ],
    requirements: [
      "Knowledge of Solid-State Devices, Circuits, or C Programming",
      "BatStateU Endorsement & Medical Certificate"
    ]
  },
  {
    id: "moa-008",
    name: "Pilipinas Shell Energy Terminal (Tabangao)",
    category: "Downstream Energy & Terminal Automation",
    type: "Energy",
    hub: "Batangas City",
    address: "Tabangao, Batangas City, Batangas",
    lat: 13.7383,
    lng: 121.0664,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-007",
    programs: ["ME", "EE", "IE", "ECE", "ChE"],
    accepts: ["OJT / Internship", "Plant Visit / Immersion"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Monthly Internship Stipend + Full Safety PPE Gear",
    slots: 6,
    description: "World-class import terminal and energy logistics hub featuring automated tank gauging, marine telemetry, and strict HSSE engineering standards.",
    moaCoordinator: "BatStateU OIR - Alangilan",
    contactEmail: "shell-campus@shell.com",
    website: "https://www.shell.com.ph",
    acceptedRoles: [
      "Asset Integrity & Reliability Intern",
      "Terminal Automation & Electrical Intern",
      "HSSE & Process Safety Engineering Intern"
    ],
    requirements: [
      "GWA in top 25% of batch recommended",
      "Strict HSSE safety compliance & drug/medical screening"
    ]
  },
  {
    id: "moa-009",
    name: "Murata Electronics Philippines, Inc.",
    category: "MLCC Semiconductor & Ceramic Components",
    type: "Semiconductor",
    hub: "Sto. Tomas",
    address: "First Philippine Industrial Park (FPIP), Tanauan / Sto. Tomas, Batangas",
    lat: 14.0975,
    lng: 121.1542,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2025-008",
    programs: ["ECE", "EE", "ME", "IE", "CpE", "ChE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring", "Plant Visit / Immersion"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Competitive Allowance + Free Shuttle across Batangas",
    slots: 18,
    description: "Global pioneer in monolithic ceramic capacitors (MLCC) and electronic modules found in almost every smartphone, EV, and medical device worldwide.",
    moaCoordinator: "College of Engineering OIR",
    contactEmail: "mep.recruitment@murata.com",
    website: "https://corporate.murata.com",
    acceptedRoles: [
      "Process & Equipment Engineering Intern",
      "Factory DX (Digital Transformation) Software Intern",
      "Facility & Electrical Power Systems Intern"
    ],
    requirements: [
      "Endorsement from BatStateU OJT Coordinator",
      "Strong analytical and problem-solving skills"
    ]
  },
  {
    id: "moa-010",
    name: "Globe Telecom Network & AI Labs",
    category: "5G Telecommunications & Network Cloud",
    type: "Telecom",
    hub: "Metro Manila",
    address: "The Globe Tower, 32nd Street, BGC, Taguig City",
    lat: 14.5535,
    lng: 121.0498,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-033",
    programs: ["ECE", "CpE", "CS", "IT"],
    accepts: ["OJT / Internship", "Capstone / Industry Project"],
    workSetup: "Hybrid",
    hasAllowance: true,
    allowanceDesc: "Monthly Stipend + Connectivity Load Allowance",
    slots: 12,
    description: "Leading digital platform and telecommunications provider operating nationwide 5G core networks, FinTech ecosystems, and cloud data centers.",
    moaCoordinator: "ECE & CpE Department OJT Coordinator",
    contactEmail: "gtlep@globe.com.ph",
    website: "https://www.globe.com.ph/careers.html",
    acceptedRoles: [
      "Network Core & IP Routing Intern",
      "Cybersecurity & Threat Intelligence Intern",
      "Data Science & AI Product Intern"
    ],
    requirements: [
      "CCNA / Networking fundamentals or Python Data Science portfolio",
      "Video screening & technical panel interview"
    ]
  },
  {
    id: "moa-011",
    name: "Philippine Manufacturing Co. of Murata (LIMA Hub)",
    category: "Automated Electronics & Robotics",
    type: "Manufacturing",
    hub: "Lipa / Malvar",
    address: "Lima Technology Center, Malvar, Batangas",
    lat: 14.0342,
    lng: 121.1618,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-022",
    programs: ["CpE", "ME", "IE", "ECE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Daily Stipend + Shuttle from Lipa & Batangas City",
    slots: 10,
    description: "Advanced surface-mount and automated inspection facility in LIMA Technology Center focusing on computer vision quality control and robotic handling.",
    moaCoordinator: "BatStateU Malvar & Alangilan Placement",
    contactEmail: "hr-lima@murata.com.ph",
    website: "https://corporate.murata.com",
    acceptedRoles: [
      "Machine Vision & AI Inspection Intern",
      "Mechatronics & PLC Maintenance Intern",
      "Supply Chain & IE Analytics Intern"
    ],
    requirements: [
      "University MOA Endorsement",
      "Familiarity with Python/OpenCV or PLC Ladder Logic"
    ]
  },
  {
    id: "moa-012",
    name: "Microchip Technology Philippines",
    category: "Microcontrollers (PIC/AVR) & FPGA R&D",
    type: "Semiconductor",
    hub: "Laguna",
    address: "Carmelray Industrial Park 1, Canlubang, Calamba, Laguna",
    lat: 14.2194,
    lng: 121.0968,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2025-015",
    programs: ["CpE", "ECE", "EE"],
    accepts: ["OJT / Internship", "Capstone / Industry Project", "Fresh Grad Hiring"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Paid Internship + Free Dev Boards for Capstone Teams",
    slots: 9,
    description: "Creator of PIC and AVR microcontrollers, PolarFire FPGAs, and embedded security chips powering aerospace, industrial, and consumer electronics.",
    moaCoordinator: "CURSOR Academic Linkages Committee",
    contactEmail: "philippines.university@microchip.com",
    website: "https://www.microchip.com",
    acceptedRoles: [
      "MCU Applications & Firmware Intern",
      "Silicon Validation & Test Engineering Intern",
      "FPGA / Digital Design Verification Intern"
    ],
    requirements: [
      "Hands-on experience with Embedded C, PIC/AVR/ARM, or Verilog",
      "Technical exam on digital logic and circuit analysis"
    ]
  },
  {
    id: "moa-013",
    name: "GCash (Mynt - Globe Fintech Innovations)",
    category: "FinTech, High-Scale Cloud & Cybersecurity",
    type: "Software/AI",
    hub: "Metro Manila",
    address: "W Global Center, 9th Ave cor. 30th St, BGC, Taguig",
    lat: 14.5502,
    lng: 121.0509,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-050",
    programs: ["CpE", "CS", "IT"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "Hybrid",
    hasAllowance: true,
    allowanceDesc: "Top-Tier Monthly Stipend + MacBook Loaner",
    slots: 0,
    description: "The Philippines' #1 Finance Super App serving millions of daily active users with distributed microservices, real-time fraud AI, and zero-trust security.",
    moaCoordinator: "CICS & CpE Placement Office",
    contactEmail: "earlycareers@mynt.xyz",
    website: "https://www.gcash.com",
    acceptedRoles: [
      "Backend Microservices Intern (Java / Spring / Go)",
      "AppSec & Cloud Security Engineering Intern",
      "Data Platform & ML Engineering Intern"
    ],
    requirements: [
      "Current cohort slots are 100% filled; applications reopen next semester",
      "Strong DSA, System Design, and Security fundamentals"
    ]
  },
  {
    id: "moa-014",
    name: "JG Summit Petrochemical Corp (JGSPC)",
    category: "Petrochemical Plant & DCS Instrumentation",
    type: "Energy",
    hub: "Batangas City",
    address: "Brgy. Simlong, Batangas City, Batangas",
    lat: 13.6712,
    lng: 121.0628,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-014",
    programs: ["ChE", "ME", "EE", "ECE", "IE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring", "Plant Visit / Immersion"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Meal & Transport Allowance + Simlong Shuttle",
    slots: 11,
    description: "Largest integrated petrochemical complex in the Philippines operating naphtha cracker, polymer plants, and automated distributed control systems.",
    moaCoordinator: "BatStateU Alangilan OIR",
    contactEmail: "careers@jgsummitpetrochem.com",
    website: "https://www.jgsummitpetrochem.com",
    acceptedRoles: [
      "Plant Instrumentation & Analyzer Intern",
      "Rotating Equipment & Mechanical Intern",
      "Electrical High-Voltage Substation Intern"
    ],
    requirements: [
      "BatStateU Endorsement & Medical Fitness Clearance",
      "Willingness to be assigned at Simlong, Batangas City"
    ]
  },
  {
    id: "moa-015",
    name: "Azeus Systems Philippines Limited",
    category: "Enterprise SaaS & Mission-Critical Software",
    type: "Software/AI",
    hub: "Metro Manila",
    address: "28/F The Enterprise Center, Ayala Ave, Makati / Ortigas",
    lat: 14.5567,
    lng: 121.0221,
    moaStatus: "Active MOA • Valid thru 2028",
    moaRef: "BSU-MOA-2025-006",
    programs: ["CS", "CpE", "IT"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "Remote Friendly",
    hasAllowance: true,
    allowanceDesc: "Competitive Stipend + Fast-Track Direct Hire Offer",
    slots: 8,
    description: "CMMI Level 5 global software engineering firm behind Convene board portal and government digital systems across the UK, Hong Kong, and North America.",
    moaCoordinator: "CpE & CS Department Placement",
    contactEmail: "recruitment-ph@azeus.com",
    website: "https://www.azeus.com",
    acceptedRoles: [
      "Associate Software Engineer Intern",
      "Web & Mobile Security QA Intern",
      "UI/UX & Frontend Systems Intern"
    ],
    requirements: [
      "Algorithmic problem-solving exam",
      "Strong OOP and Data Structures foundation"
    ]
  },
  {
    id: "moa-016",
    name: "Atlantic, Gulf & Pacific (AG&P Industrial)",
    category: "Modular LNG Engineering & Heavy Fabrication",
    type: "Energy",
    hub: "Batangas City",
    address: "Brgy. San Roque, Bauan, Batangas (Near Batangas Bay)",
    lat: 13.7819,
    lng: 121.0045,
    moaStatus: "Active MOA • Valid thru 2027",
    moaRef: "BSU-MOA-2024-016",
    programs: ["ME", "EE", "CE", "IE", "ECE"],
    accepts: ["OJT / Internship", "Fresh Grad Hiring"],
    workSetup: "On-Site",
    hasAllowance: true,
    allowanceDesc: "Transport & Meal Subsidy",
    slots: 16,
    description: "Global downstream LNG infrastructure and modular engineering yard in Bauan, Batangas delivering industrial automation and structural modules.",
    moaCoordinator: "College of Engineering OJT Office",
    contactEmail: "careers@agpglobal.com",
    website: "https://agpglobal.com",
    acceptedRoles: [
      "Electrical & Instrumentation (E&I) Intern",
      "Structural & Piping CAD Engineering Intern",
      "Project Controls & Planning Intern"
    ],
    requirements: [
      "AutoCAD / SolidWorks or Electrical Design proficiency",
      "Safety orientation at Bauan Yard"
    ]
  }
];

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

  return rows.slice(1).map((vals, idx) => {
    const raw = {};
    headers.forEach((h, i) => {
      raw[h] = vals[i] !== undefined ? vals[i] : "";
    });
    return {
      id: raw.id || `sheet-${idx + 1}`,
      name: raw.name || "Unnamed Partner",
      category: raw.category || "Industry Partner",
      type: raw.type || "Manufacturing",
      hub: raw.hub || "Batangas City",
      address: raw.address || "Calabarzon, Philippines",
      lat: parseFloat(raw.lat) || 13.7844,
      lng: parseFloat(raw.lng) || 121.0744,
      moaStatus: raw.moaStatus || "Active MOA",
      moaRef: raw.moaRef || "BSU-MOA-VERIFIED",
      programs: raw.programs ? raw.programs.split(/[;,]/).map(s => s.trim()).filter(Boolean) : ["CpE"],
      accepts: raw.accepts ? raw.accepts.split(/[;,]/).map(s => s.trim()).filter(Boolean) : ["OJT / Internship"],
      workSetup: raw.workSetup || "On-Site",
      hasAllowance: String(raw.hasAllowance).toLowerCase() === "true",
      allowanceDesc: raw.allowanceDesc || "Standard Internship Package",
      slots: isNaN(parseInt(raw.slots, 10)) ? 5 : parseInt(raw.slots, 10),
      description: raw.description || "Verified BatStateU MOA partner company.",
      moaCoordinator: raw.moaCoordinator || "Office of Industry Relations (OIR)",
      contactEmail: raw.contactEmail || "",
      website: raw.website || "",
      acceptedRoles: raw.acceptedRoles ? raw.acceptedRoles.split(/[;,]/).map(s => s.trim()).filter(Boolean) : ["Engineering Intern"]
    };
  });
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
      // Expected when opened directly via file:/// protocol; gracefully use embedded dataset
    }

    // 3. Embedded fallback dataset
    return {
      source: "embedded-local",
      companies: [...customSaved, ...DEFAULT_MOA_COMPANIES],
      error: null
    };
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
window.DEFAULT_MOA_COMPANIES = DEFAULT_MOA_COMPANIES;

export { CAMPUSES, DatabaseService, DEFAULT_MOA_COMPANIES, STORAGE_KEYS };
