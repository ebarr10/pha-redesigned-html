// -----------------------------
// Schema headers (match JSON keys exactly)
// -----------------------------
const HEADERS = {
    PROGRAM_NAME: "Program Name",
    ORG: "Organization / Lead Entity",
    PROGRAM_TYPE: "Program Type (can be multiple)",
    SETTING: "Setting / Sector",
    POP_TARGETED: "Population Targeted (can be multiple)",
    GEOGRAPHY: "Geography",
    FUNDING: "Funding Source",
    START_END: "Start Year / End Year",
    INTERVENTION: "Intervention Description",
    MEASURED_OUTCOMES: "Measured Outcomes",
    EVAL_RESULTS_PUB: "Evaluation Results (if published)",
    KEY_CONTACTS: "Key Contacts / Website",
    PARTNERS: "Partners",
    TAGS: "Tags / Keywords",
    PUBLIC_LINKS: "Public Links (Sources)",
};

const FILTER_FIELDS = [
    { key: HEADERS.PROGRAM_TYPE, label: "Program Type", type: "multi" },
    { key: HEADERS.SETTING, label: "Setting / Sector", type: "single" },
    { key: HEADERS.POP_TARGETED, label: "Population Targeted", type: "multi" },
    { key: HEADERS.GEOGRAPHY, label: "Geography", type: "single" },
    { key: HEADERS.FUNDING, label: "Funding Source", type: "single" },
    { key: HEADERS.TAGS, label: "Tags / Keywords", type: "multi" },
];

const SEARCHABLE_KEYS = [
    HEADERS.PROGRAM_NAME,
    HEADERS.ORG,
    HEADERS.PROGRAM_TYPE,
    HEADERS.SETTING,
    HEADERS.POP_TARGETED,
    HEADERS.GEOGRAPHY,
    HEADERS.FUNDING,
    HEADERS.TAGS,
    HEADERS.INTERVENTION,
    HEADERS.MEASURED_OUTCOMES,
    HEADERS.EVAL_RESULTS_PUB,
    HEADERS.KEY_CONTACTS,
    HEADERS.PARTNERS,
];

const VISIBLE_COLUMNS = [
    HEADERS.PROGRAM_NAME,
    HEADERS.ORG,
    HEADERS.PROGRAM_TYPE,
    HEADERS.SETTING,
    HEADERS.POP_TARGETED,
    HEADERS.GEOGRAPHY,
    HEADERS.FUNDING,
    HEADERS.START_END,
    HEADERS.PUBLIC_LINKS,
];

// -----------------------------
// State
// -----------------------------
let ALL = [];
let filtered = [];
let searchQuery = "";
let filters = {}; // { [key]: string | string[] }
let sortKey = HEADERS.PROGRAM_NAME;
let sortDir = "asc"; // asc | desc

const NA = "Not Available";

const isNA = (v) =>
    v == null ||
    String(v).trim() === "" ||
    String(v).toLowerCase() === "not available";

const norm = (v) => (isNA(v) ? "" : String(v).trim());

function getValues(record, key) {
    const v = record[key];
    if (Array.isArray(v)) return v.map((x) => String(x));
    const s = norm(v);
    return s ? [s] : [];
}

function recordMatchesSearch(record) {
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.trim().toLowerCase();

    return SEARCHABLE_KEYS.some((k) => {
        const v = record[k];
        if (Array.isArray(v))
            return v.some((x) => String(x).toLowerCase().includes(needle));
        return String(v ?? "")
            .toLowerCase()
            .includes(needle);
    });
}

function recordMatchesFilters(record) {
    for (const field of FILTER_FIELDS) {
        const selected = filters[field.key];
        if (!selected || (Array.isArray(selected) && selected.length === 0))
            continue;

        if (field.type === "single") {
            if (String(record[field.key]) !== selected) return false;
        } else {
            const values = new Set(getValues(record, field.key));
            const wanted = selected;
            if (!wanted.some((w) => values.has(w))) return false;
        }
    }
    return true;
}

function applySort() {
    const dir = sortDir === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];

        const as = Array.isArray(av) ? av.join("; ") : norm(av);
        const bs = Array.isArray(bv) ? bv.join("; ") : norm(bv);

        if (isNA(as) && isNA(bs)) return 0;
        if (isNA(as)) return 1;
        if (isNA(bs)) return -1;

        return as.localeCompare(bs) * dir;
    });
}

function applyAll() {
    filtered = ALL.filter(
        (r) => recordMatchesSearch(r) && recordMatchesFilters(r)
    );
    applySort();
    renderCounts();
    renderTable();
}

function renderCounts() {
    document.getElementById("resultCount").textContent =
        filtered.length.toLocaleString();
    document.getElementById("resultCountMobile").textContent =
        filtered.length.toLocaleString();
}

// -----------------------------
// Facet options from data
// -----------------------------
function uniqueFacetOptions(key) {
    const set = new Set();
    for (const r of ALL) {
        const v = r[key];
        if (Array.isArray(v)) {
            v.forEach((x) => {
                const s = String(x).trim();
                if (!isNA(s)) set.add(s);
            });
        } else {
            const s = norm(v);
            if (s) set.add(s);
        }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// -----------------------------
// Render filters (desktop + mobile)
// -----------------------------
function renderFilters(rootEl) {
    rootEl.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "filters";

    // Search + clear row
    const searchRow = document.createElement("div");
    searchRow.className = "row";
    searchRow.style.alignItems = "stretch";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder =
        "Search programs (name, org, intervention, outcomes...)";
    searchInput.value = searchQuery;
    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        applyAll();
    });

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn";
    clearBtn.textContent = "Clear";
    clearBtn.type = "button";
    clearBtn.addEventListener("click", () => {
        searchQuery = "";
        filters = {};
        sortKey = HEADERS.PROGRAM_NAME;
        sortDir = "asc";
        mountFilters();
        renderTableHeader();
        applyAll();
    });

    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearBtn);
    wrap.appendChild(searchRow);

    // Facets
    FILTER_FIELDS.forEach((field) => {
        const card = document.createElement("div");
        card.className = "filter-card";

        const title = document.createElement("div");
        title.className = "filter-title";
        title.textContent = field.label;
        card.appendChild(title);

        const options = uniqueFacetOptions(field.key);

        if (field.type === "single") {
            const sel = document.createElement("select");

            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "All";
            sel.appendChild(optAll);

            options.forEach((o) => {
                const opt = document.createElement("option");
                opt.value = o;
                opt.textContent = o;
                sel.appendChild(opt);
            });

            sel.value =
                typeof filters[field.key] === "string"
                    ? filters[field.key]
                    : "";
            sel.addEventListener("change", (e) => {
                const v = e.target.value;
                if (!v) delete filters[field.key];
                else filters[field.key] = v;
                applyAll();
            });

            card.appendChild(sel);
        } else {
            const pills = document.createElement("div");
            pills.className = "pills";

            const selected = Array.isArray(filters[field.key])
                ? filters[field.key]
                : [];

            options.forEach((o) => {
                const btn = document.createElement("button");
                btn.className = "pill" + (selected.includes(o) ? " on" : "");
                btn.type = "button";
                btn.textContent = o;

                btn.addEventListener("click", () => {
                    const cur = Array.isArray(filters[field.key])
                        ? filters[field.key]
                        : [];
                    const next = cur.includes(o)
                        ? cur.filter((x) => x !== o)
                        : [...cur, o];

                    if (next.length === 0) delete filters[field.key];
                    else filters[field.key] = next;

                    mountFilters(); // keep desktop + mobile pills in sync
                    applyAll();
                });

                pills.appendChild(btn);
            });

            card.appendChild(pills);
        }

        wrap.appendChild(card);
    });

    rootEl.appendChild(wrap);
}

function mountFilters() {
    renderFilters(document.getElementById("filtersRoot"));
    renderFilters(document.getElementById("filtersRootMobile"));
}

// -----------------------------
// Render table header (sortable)
// -----------------------------
function renderTableHeader() {
    const headerRow = document.getElementById("tableHeaderRow");
    headerRow.innerHTML = "";

    VISIBLE_COLUMNS.forEach((col) => {
        const th = document.createElement("th");
        th.title = "Click to sort";

        const label =
            sortKey === col ? `${col} ${sortDir === "asc" ? "▲" : "▼"}` : col;

        th.textContent = label;

        th.addEventListener("click", () => {
            if (sortKey === col) sortDir = sortDir === "asc" ? "desc" : "asc";
            else {
                sortKey = col;
                sortDir = "asc";
            }
            renderTableHeader();
            applySort();
            renderTable();
        });

        headerRow.appendChild(th);
    });
}

// -----------------------------
// Render table rows
// -----------------------------
function renderTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (filtered.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = VISIBLE_COLUMNS.length;
        td.style.padding = "16px";
        td.textContent = "No programs match the current filters.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    for (const r of filtered) {
        const tr = document.createElement("tr");

        for (const col of VISIBLE_COLUMNS) {
            const td = document.createElement("td");

            if (col === HEADERS.PUBLIC_LINKS) {
                const links = Array.isArray(r[col]) ? r[col] : [];
                if (!links.length) {
                    td.textContent = NA;
                } else {
                    const wrap = document.createElement("div");
                    wrap.style.display = "grid";
                    wrap.style.gap = "6px";

                    links.forEach((href, i) => {
                        const a = document.createElement("a");
                        a.href = href;
                        a.target = "_blank";
                        a.rel = "noreferrer";
                        a.textContent = `Source ${i + 1}`;
                        wrap.appendChild(a);
                    });

                    td.appendChild(wrap);
                }
            } else {
                const v = r[col];
                if (Array.isArray(v))
                    td.textContent = v.length ? v.join("; ") : NA;
                else td.textContent = !isNA(v) ? String(v) : NA;
            }

            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }
}

// -----------------------------
// Mobile collapsible
// -----------------------------
function initMobileCollapse() {
    const btn = document.getElementById("mobileToggle");
    const panel = document.getElementById("mobilePanel");

    btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
        if (!expanded)
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 900) {
            btn.setAttribute("aria-expanded", "false");
            panel.hidden = true;
        }
    });
}

// -----------------------------
// Boot
// -----------------------------
async function boot() {
    initMobileCollapse();

    // IMPORTANT: fetch from root to match Next.js /public behavior
    const res = await fetch("./programs.json", { cache: "no-store" });
    if (!res.ok) {
        alert(
            "Failed to load ./programs.json.\n\nMake sure programs.json is in the same folder as index.html and you are running a local server (not file://)."
        );
        return;
    }

    ALL = await res.json();

    mountFilters();
    renderTableHeader();
    applyAll();
}

boot();
