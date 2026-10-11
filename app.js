/* Screen logic: two separate flows (buyer cost sheet, seller net sheet), each with its own
   form and its own printed page. All money math lives in engine.js; all fees and rates
   live in rates.js. */
(function () {
  "use strict";
  var R = window.CostSheetRates, E = window.CostSheetEngine, L = window.CostSheetLocal;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Icons (24px line icons, round caps) ----------
  var ICONS = {
    house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    sign: '<path d="M5 21V4"/><path d="M5 5h13v8H5"/><path d="M9 9h5"/>',
    check: '<path d="M5 12.5 10 17 19 7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    err: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    warn: '<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  function icon(name, size, stroke) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var a = { width: size || 16, height: size || 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": stroke || 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    for (var k in a) s.setAttribute(k, a[k]);
    s.innerHTML = ICONS[name];
    return s;
  }

  // ---------- Fields ----------
  // req: true = required on both sheets, "buyer" / "seller" = required on that sheet only.
  var opt = function (v, label) { return { v: String(v), label: label }; };
  var notCash = function (s) { return s.loanType !== "CASH"; };
  var hasSecond = function (s) { return s.hasSecond === "yes"; };
  var SECOND = ["secondLoan", "secondRate", "secondTermYears"];

  // ---------- Local lookups (local-data.js): suggestions only, the agent can always override ----------
  var MUNIS = {};
  L.municipalities.forEach(function (m) {
    MUNIS[m[0]] = { name: m[0], school: m[1], muni: m[2], sd: m[3], total: L.stateTransferTax + m[2] + m[3] };
  });
  function muniOf(s) { return MUNIS[s.municipality] || null; }
  // The dropdown lists only the places above the usual total; everywhere else is one "all others" choice.
  var USUAL_TAX = L.stateTransferTax + 1;
  var higherTaxOptions = L.municipalities.filter(function (m) { return MUNIS[m[0]].total > USUAL_TAX; }).map(function (m) {
    return { v: m[0], label: m[0] + ": " + MUNIS[m[0]].total + "%" };
  }).concat([{ v: "all-others", label: "All other municipalities: " + USUAL_TAX + "%" }, { v: "other", label: "A different rate (enter it)" }]);
  var PLANS = {};
  L.warranty.plans.forEach(function (p) { PLANS[p.id] = p; });
  function warrantyAmount(planId, manual, addListing) {
    if (planId === "other") return manual;
    var p = PLANS[planId];
    return p ? p.price + (addListing && p.existing ? L.warranty.sellerListingCoverage : 0) : null;
  }
  var warrantyOptions = L.warranty.plans.map(function (p) {
    return { v: p.id, label: L.warranty.company + " " + p.label + ": $" + p.price.toLocaleString("en-US") };
  }).concat([{ v: "other", label: "Another company (enter the fee)" }]);
  var warrantyHint = L.warranty.sheet + ". Homes under 5,000 sq. ft. Plus applicable tax.";
  // The weekly average is only offered while it is fresh.
  var marketDate = new Date(L.market.asOf + "T12:00:00");
  var marketRate = (Date.now() - marketDate.getTime()) / 864e5 <= 14 ? L.market.rate30 : null;
  var marketWeek = marketDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  // Placeholder insurance tiers: a state average scaled by price. The agent can always type the real quote.
  var INS = L.insurance;
  var dollars0 = function (x) { return "$" + Math.round(x).toLocaleString("en-US"); };
  function insurancePremium(band) { return Math.round(band / INS.anchorCoverage * INS.anchorPremium / 25) * 25; }
  function insuranceBand(price) {
    return INS.bands.reduce(function (best, b) { return Math.abs(b - price) < Math.abs(best - price) ? b : best; }, INS.bands[0]);
  }
  // The tier closest to the sales price goes first; the rest follow in order; the real quote is last.
  function insuranceOptions(price) {
    var first = price > 0 ? insuranceBand(price) : null;
    var tier = function (b) { return { v: String(b), label: dollars0(b) + " home: about " + dollars0(insurancePremium(b)) + " a year" }; };
    var list = INS.bands.filter(function (b) { return b !== first; }).map(tier);
    if (first) { var top = tier(first); top.label = "Closest to this price · " + top.label; list.unshift(top); }
    return list.concat([{ v: "quote", label: "Enter the buyer's actual quote" }]);
  }
  var FIELDS = {
    agentName: { label: "Agent name", kind: "text", req: true },
    office: { label: "Office", kind: "select", req: true, options: R.offices.map(function (o) { return opt(o.no, o.name); }) },
    address: { label: "Property address", kind: "text", req: true, full: true },
    cityStateZip: { label: "City, state and zip", kind: "text", req: true },
    county: { label: "County", kind: "select", req: "buyer", options: R.counties.map(function (c) { return opt(c.name, c.name); }) },
    buyerName: { label: "Buyer name(s)", kind: "text", req: "buyer" },
    sellerName: { label: "Seller name(s)", kind: "text", req: "seller" },
    settlementDate: { label: "Estimated settlement date", kind: "date", req: true },
    price: { label: "Sales price", kind: "money", req: true, full: true },
    loanType: { label: "How is the buyer paying?", kind: "choice", req: "buyer", full: true,
      options: [opt("C", "Conventional"), opt("F", "FHA"), opt("V", "VA"), opt("CASH", "Cash")] },
    loanAmount: { label: "Loan amount", kind: "money", req: "buyer", full: true, chips: [3, 5, 10, 15, 20], when: function (s) { return s.loanType === "C"; } },
    govNote: { kind: "note", when: function (s) { return s.loanType === "F" || s.loanType === "V"; } },
    rate: { label: "Interest rate", kind: "pct", req: "buyer", ph: "6.375", when: notCash, def: marketRate ? String(marketRate) : "",
      hint: marketRate ? "Starts at the " + L.market.source + " 30-year average for the week of " + marketWeek + ". Change it to the lender's quote." : "" },
    termYears: { label: "Loan term (years)", kind: "num", req: "buyer", def: "30", when: notCash },
    points: { label: "Points", kind: "num", def: "0", hint: "Enter 1 for one point.", when: notCash },
    annualTaxes: { label: "Annual real estate taxes", kind: "money", req: "buyer", hint: "All taxes combined: county, municipal and school." },
    taxMonths: { label: "Months of tax escrow + proration", kind: "num", req: "buyer", def: "12", hint: "Usually 10 to 12." },
    insurancePlan: { label: "Annual homeowners insurance", kind: "select", req: "buyer", full: true, when: notCash, options: insuranceOptions(0),
      hint: "Placeholder figures, not a quote: the Pennsylvania average (" + dollars0(INS.anchorPremium) + " a year for " + dollars0(INS.anchorCoverage) +
        " of coverage; " + INS.source + ") scaled by sales price." },
    annualInsurance: { label: "Annual homeowners insurance (buyer's quote)", kind: "money", req: "buyer", full: true,
      when: function (s) { return notCash(s) && s.insurancePlan === "quote"; } },
    condoFee: { label: "Monthly condo / HOA fee", kind: "money", ph: "0" },
    municipality: { label: "Transfer tax: which municipality?", kind: "select", req: true, full: true, options: higherTaxOptions,
      hint: "Only " + L.transferTaxCounty + " County places above " + USUAL_TAX + "% are listed. Everywhere else, pick All other municipalities." },
    muniNote: { kind: "note", when: function (s) { return !!muniOf(s) || s.municipality === "all-others"; } },
    transferTax: { label: "Total transfer tax (buyer and seller combined)", kind: "choice", req: true, full: true,
      options: R.transferTax.choices.map(function (c) { return opt(c.pct, c.label); }).concat([opt("other", "Other")]),
      hint: "Buyer and seller each pay half." },
    transferTaxOther: { label: "Total transfer tax rate", kind: "pct", req: true, when: function (s) { return s.municipality === "other"; } },
    calcNote: { kind: "calc" },
    handMoney: { label: "Hand money", kind: "money", ph: "0" },
    assist: { label: "Seller closing cost assistance", kind: "money", ph: "0" },
    relocation: { label: "Company relocation contribution", kind: "money", ph: "0" },
    commissionType: { label: "Listing commission is a", kind: "choice", req: "seller", full: true, def: "pct",
      options: [opt("pct", "Percent of price"), opt("flat", "Flat dollar amount")] },
    commissionValue: { label: "Total commission (percent)", kind: "pct", req: "seller" },
    cbFeeSeller: { label: "Coldwell Banker additional commission", kind: "money", ph: "0", hint: "Per listing contract." },
    addlSellerCommission: { label: "Additional seller commission (if any)", kind: "money", ph: "0", hint: "Per sales agreement." },
    buyerCommissionType: { label: "Buyer paid agent commission is a", kind: "choice", full: true, def: "pct",
      options: [opt("pct", "Percent of price"), opt("flat", "Flat dollar amount")] },
    buyerPaidCommission: { label: "Buyer paid agent commission (percent)", kind: "pct", hint: "Per buyer agency contract." },
    cbFeeBuyer: { label: "Coldwell Banker additional commission", kind: "money", ph: "0", hint: "Per buyer agency contract." },
    homeInspection: { label: "Home inspection", kind: "money", ph: "0" },
    radon: { label: "Radon", kind: "money", ph: "0" },
    pest: { label: "Pest inspection", kind: "money", ph: "0" },
    wellSeptic: { label: "Well and/or septic", kind: "money", ph: "0" },
    survey: { label: "Survey", kind: "money", ph: "0" },
    warrantyPlan: { label: "Home warranty", kind: "select", full: true, options: warrantyOptions, hint: warrantyHint },
    warrantyBuyer: { label: "Home warranty fee", kind: "money", ph: "0", when: function (s) { return s.warrantyPlan === "other"; } },
    warrantyPlanSeller: { label: "Home warranty", kind: "select", full: true, options: warrantyOptions, hint: warrantyHint },
    sellerListing: { label: "Add Seller Listing Coverage ($" + L.warranty.sellerListingCoverage + ")?", kind: "choice", full: true, def: "no",
      options: [opt("no", "No"), opt("yes", "Yes")], hint: "Covers the home while it's listed, up to 6 months.",
      when: function (s) { return !!PLANS[s.warrantyPlanSeller] && PLANS[s.warrantyPlanSeller].existing; } },
    warrantySeller: { label: "Home warranty fee", kind: "money", ph: "0", when: function (s) { return s.warrantyPlanSeller === "other"; } },
    mortgagePayoff: { label: "Estimated mortgage / lien payoff", kind: "money", full: true, hint: "Leave blank if unknown. The sheet will say payoff is not included." },
    municipalLetters: { label: "Municipal letters / tax certifications", kind: "money", ph: "0" },
    // Screen-only choice. It never reaches the engine; it only shows or hides the three second-loan fields.
    hasSecond: { label: "Is there a second mortgage?", kind: "choice", full: true, def: "no",
      options: [opt("no", "No"), opt("yes", "Yes")], hint: "Yes shows the second loan amount, rate and term." },
    secondLoan: { label: "Second loan amount", kind: "money", ph: "0", when: hasSecond },
    secondRate: { label: "Second loan interest rate", kind: "pct", when: hasSecond },
    secondTermYears: { label: "Second loan term (years)", kind: "num", when: hasSecond }
  };
  Object.keys(FIELDS).forEach(function (id) { FIELDS[id].id = id; });

  // ---------- The two flows ----------
  // A section field is an id, or { id, label, hint, when, unknown } to adjust how it shows in that flow.
  var MODES = {
    buyer: {
      name: "Buyer Cost Sheet", tag: "Buyer", icon: "house",
      sub: "What the buyer needs at settlement and what they'll pay each month.",
      sections: [
        { title: "You", fields: ["agentName", "office"] },
        { title: "Property and buyer", fields: ["address", "cityStateZip", "county", "buyerName",
          { id: "sellerName", hint: "Optional on this sheet." }, "settlementDate"] },
        { title: "Price and financing", fields: ["price", "loanType", "loanAmount", "govNote", "rate", "termYears", "points"] },
        { title: "Taxes and insurance", sub: "You enter the tax amounts. The sheet does the math and those lines can't be edited.",
          fields: ["annualTaxes", "taxMonths", "insurancePlan", "annualInsurance", "condoFee", "municipality", "muniNote", "transferTaxOther", "calcNote"] },
        { title: "Deal terms", fields: ["handMoney", "assist", "relocation"] },
        { title: "Buyer agency commission", sub: "Enter what the signed buyer agency contract says. Nothing is pre-filled.",
          fields: ["buyerCommissionType", "buyerPaidCommission", "cbFeeBuyer"] },
        { title: "Inspections and warranty", sub: "Leave blank if it doesn't apply. Reach out to your inspector to find out what their costs are.",
          fields: ["homeInspection", "radon", { id: "pest", hint: "Not charged to the buyer on VA loans." }, "wellSeptic", "survey", "warrantyPlan", "warrantyBuyer"] },
        { title: "Second mortgage", fields: ["hasSecond", "secondLoan", "secondRate", "secondTermYears"] }
      ]
    },
    seller: {
      name: "Seller Net Sheet", tag: "Seller", icon: "sign",
      sub: "What the seller pays at settlement and what they walk away with.",
      sections: [
        { title: "You", fields: ["agentName", "office"] },
        { title: "Property and seller", fields: ["address", "cityStateZip", "sellerName", "settlementDate"] },
        { title: "Sale", fields: ["price", "municipality", "muniNote", "transferTaxOther",
          { id: "assist", label: "Closing cost assistance paid to buyer" }] },
        { title: "Commission", sub: "Enter what the signed listing contract says. Nothing is pre-filled.",
          fields: ["commissionType", "commissionValue", "cbFeeSeller", "addlSellerCommission"] },
        { title: "Payoff and other costs", fields: ["mortgagePayoff", "municipalLetters", "warrantyPlanSeller", "sellerListing", "warrantySeller"] },
        { title: "Buyer's loan", sub: "Only matters for VA. Skip it if you don't know yet.", fields: [
          { id: "loanType", label: "Buyer's loan type (if known)", unknown: true },
          { id: "pest", label: "Pest inspection (seller pays on VA loans)", when: function (s) { return s.loanType === "V"; } }] }
      ]
    }
  };

  // ---------- State ----------
  var mode = "home";
  var values = {};
  var touched = {};
  var showAll = false;
  var entries = {};   // field entries for the flow on screen, keyed by id
  var stepCount = 0;
  var statusKey = ""; // what the checklist last showed, so it is only rebuilt when it changes
  var lastReady = false, lastHeadline = "";
  var addressNote = "", lastLookup = "", lookupSeq = 0;

  function remember(key, value) { try { localStorage.setItem("ccs." + key, value); } catch (e) { /* storage unavailable */ } }
  function recall(key) { try { return localStorage.getItem("ccs." + key) || ""; } catch (e) { return ""; } }
  function resetValues() {
    values = {};
    Object.keys(FIELDS).forEach(function (id) { values[id] = FIELDS[id].def || ""; });
    values.agentName = recall("agentName");
    values.office = recall("office");
    touched = {}; showAll = false;
    addressNote = ""; lastLookup = "";
  }

  // ---------- Small helpers ----------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function fill(el, kids) { el.textContent = ""; kids.forEach(function (c) { if (c) el.appendChild(c); }); }
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[^0-9.]/g, "");
    if (s === "" || s === ".") return null;
    var x = parseFloat(s);
    return isFinite(x) ? x : null;
  }
  var usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  function money(x) { return usd.format(Math.round(x * 100) / 100 + 0); }
  function moneyOrDash(x) { return Math.abs(x) < 0.005 ? "–" : money(x); }
  function grouped(x) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x); }
  function parseDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
  }
  function longDate(d) {
    return new Date(d.year, d.month - 1, d.day).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  function commissionIsFlat() { return values.commissionType === "flat"; }
  function buyerCommissionIsFlat() { return values.buyerCommissionType === "flat"; }
  function labelOf(id) {
    if (id === "buyerPaidCommission") return buyerCommissionIsFlat() ? "Buyer paid agent commission (dollars)" : "Buyer paid agent commission (percent)";
    if (id === "commissionValue") return commissionIsFlat() ? "Total commission (dollars)" : "Total commission (percent)";
    return (entries[id] && entries[id].label) || FIELDS[id].label;
  }
  function isNumber(f) { return f.kind === "money" || f.kind === "pct" || f.kind === "num"; }
  function isBlank(id, s) { return isNumber(FIELDS[id]) ? parseNum(s[id]) === null : !s[id]; }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  // ---------- Build the form for one flow ----------
  function message(cls, id, iconName) {
    return h("div", { class: "fmsg " + cls, id: id, hidden: "" }, [icon(iconName, 16, 2.2), h("span")]);
  }
  function buildField(entry) {
    var f = FIELDS[entry.id], id = f.id;
    if (f.kind === "note") return h("div", { class: "locked-note", id: "f-" + id }, [icon("info", 16, 2.2), h("span")]);
    if (f.kind === "calc") {
      return h("div", { class: "calc-note", id: "f-" + id }, [icon("lock", 16), h("span", {}, [
        h("b", { text: "Calculated on the sheet." }),
        document.createTextNode(" Transfer tax, title charges, recording fees and lender fees come from the fee table. Nothing to enter here.")])]);
    }
    var wrap = h("div", { class: "field" + (f.full ? " full" : ""), id: "f-" + id });
    var required = f.req === true || f.req === mode;
    var labelKids = [document.createTextNode(entry.label || f.label)];
    if (required) labelKids.push(h("span", { class: "req", text: "*", "aria-hidden": "true" }));
    var describedBy = "h-" + id + " e-" + id + " w-" + id;
    var control;
    // A short list of choices (five or fewer) is always tiles, never a dropdown.
    if (f.kind === "choice" || (f.kind === "select" && f.options.length <= 5)) {
      wrap.appendChild(h("div", { class: "lab", id: "l-" + id }, labelKids));
      var options = entry.unknown ? f.options.concat([opt("", "Not known yet")]) : f.options;
      control = h("div", { class: "tiles", role: "radiogroup", "aria-labelledby": "l-" + id, "aria-describedby": describedBy }, options.map(function (o) {
        var input = h("input", { type: "radio", name: id, value: o.v });
        if (values[id] === o.v) input.checked = true;
        return h("label", { class: "tile" }, [input, h("span", { class: "tile-face" }, [icon("check", 14, 3), h("span", { text: o.label })])]);
      }));
      if (required) control.setAttribute("aria-required", "true");
    } else {
      wrap.appendChild(h("label", { class: "lab", for: id, id: "l-" + id }, labelKids));
      var input;
      if (f.kind === "select") {
        input = h("select", { id: id }, [h("option", { value: "", text: "Choose…" })].concat(
          f.options.map(function (o) { return h("option", { value: o.v, text: o.label }); })));
      } else {
        input = h("input", { id: id, type: f.kind === "date" ? "date" : "text" });
        if (f.kind !== "text" && f.kind !== "date") input.setAttribute("inputmode", "decimal");
        if (f.ph) input.setAttribute("placeholder", f.ph);
      }
      input.setAttribute("aria-describedby", describedBy);
      if (required) input.setAttribute("aria-required", "true");
      input.value = values[id] || "";
      control = h("div", { class: "control " + f.kind }, [input]);
    }
    wrap.appendChild(control);
    // Chips, hint and messages share one wrapper so side-by-side boxes stay on one line.
    var below = h("div", { class: "below" });
    if (f.chips) {
      below.appendChild(h("div", { class: "chips" }, f.chips.map(function (p) {
        return h("button", { type: "button", class: "chip", "data-down": p, "aria-pressed": "false", text: p + "% down" });
      })));
    }
    below.appendChild(h("div", { class: "hint", id: "h-" + id, text: entry.hint || f.hint || "" }));
    below.appendChild(message("err", "e-" + id, "err"));
    below.appendChild(message("warn", "w-" + id, "warn"));
    wrap.appendChild(below);
    return wrap;
  }
  function buildForm() {
    var form = $("form"), m = MODES[mode];
    form.textContent = "";
    entries = {};
    stepCount = m.sections.length;
    m.sections.forEach(function (s, i) {
      var n = i + 1;
      var list = s.fields.map(function (x) { return typeof x === "string" ? { id: x } : x; });
      list.forEach(function (e) { e.step = n; entries[e.id] = e; });
      form.appendChild(h("section", { class: "step", id: "step-" + n, "aria-labelledby": "st-" + n }, [
        h("div", { class: "sh" }, [
          h("span", { class: "numc", id: "sn-" + n, "aria-hidden": "true", text: String(n) }),
          h("h2", { id: "st-" + n, text: s.title }),
          h("span", { class: "sstat", id: "ss-" + n })
        ]),
        s.sub ? h("p", { class: "ssub", text: s.sub }) : null,
        h("div", { class: "grid" }, list.map(buildField))
      ]));
    });
    fill($("flowTag"), [icon(m.icon, 14, 2), document.createTextNode("You're on the " + m.tag + " sheet")]);
    $("formTitle").textContent = m.name;
    $("formSub").textContent = m.sub;
    statusKey = "";
  }

  // ---------- Values -> engine input ----------
  function visible(f, s) { return !f.when || f.when(s); }
  function shown(id, s) { var e = entries[id]; return !!e && visible(FIELDS[id], s) && (!e.when || e.when(s)); }
  function num(s, id) { return visible(FIELDS[id], s) ? parseNum(s[id]) : null; }
  function toEngineInput(s) {
    var county = R.counties.filter(function (c) { return c.name === s.county; })[0];
    var muni = muniOf(s);
    var tt = muni ? muni.total : s.municipality === "all-others" ? USUAL_TAX : s.municipality === "other" ? num(s, "transferTaxOther") : null;
    // A percent commission becomes dollars here, so the engine still gets a dollar amount.
    var buyerCommission = num(s, "buyerPaidCommission");
    if (buyerCommission !== null && s.buyerCommissionType !== "flat") buyerCommission = Math.round((num(s, "price") || 0) * buyerCommission) / 100;
    return {
      countyGroup: county ? county.group : "",
      price: num(s, "price"), loanType: s.loanType, loanAmount: num(s, "loanAmount"),
      termYears: num(s, "termYears"), rate: num(s, "rate"), points: num(s, "points"),
      annualTaxes: num(s, "annualTaxes"), taxMonths: num(s, "taxMonths"), annualInsurance: !notCash(s) ? null : s.insurancePlan === "quote" ? num(s, "annualInsurance") : Number(s.insurancePlan) ? insurancePremium(Number(s.insurancePlan)) : null,
      transferTaxPct: tt, assist: num(s, "assist"), condoFee: num(s, "condoFee"),
      homeInspection: num(s, "homeInspection"), radon: num(s, "radon"), pest: num(s, "pest"),
      wellSeptic: num(s, "wellSeptic"), survey: num(s, "survey"),
      warrantySeller: warrantyAmount(s.warrantyPlanSeller, num(s, "warrantySeller"), s.sellerListing === "yes"),
      warrantyBuyer: warrantyAmount(s.warrantyPlan, num(s, "warrantyBuyer"), false),
      secondLoan: num(s, "secondLoan"), secondTermYears: num(s, "secondTermYears"), secondRate: num(s, "secondRate"),
      cbFeeBuyer: num(s, "cbFeeBuyer"), buyerPaidCommission: buyerCommission,
      cbFeeSeller: num(s, "cbFeeSeller"), addlSellerCommission: num(s, "addlSellerCommission"),
      commissionType: s.commissionType, commissionValue: num(s, "commissionValue"),
      settlementDate: parseDate(s.settlementDate),
      handMoney: num(s, "handMoney"), relocation: num(s, "relocation"),
      municipalLetters: num(s, "municipalLetters"), mortgagePayoff: num(s, "mortgagePayoff")
    };
  }

  // ---------- Validation for the flow on screen ----------
  // Returns { errors: [{id, msg}], warnings: [{id, msg}], required: n }. A warning's id names the
  // field it is about ("" when it isn't about one field).
  function validate(s, inp, r) {
    var errors = [], warnings = [], required = 0;
    var add = function (id, msg) { if (!errors.some(function (e) { return e.id === id; })) errors.push({ id: id, msg: msg }); };
    var warn = function (id, msg) { warnings.push({ id: id, msg: msg }); };
    Object.keys(entries).forEach(function (id) {
      var f = FIELDS[id];
      if (!(f.req === true || f.req === mode) || !shown(id, s)) return;
      required++;
      if (isBlank(id, s)) add(id, labelOf(id));
    });
    var price = inp.price || 0;
    if (inp.price !== null && price <= 0) add("price", "Sales price must be more than $0");
    if (price > 0 && price < 10000) warn("price", "Sales price is " + money(price) + ". If that's a typo, fix it before you print.");
    if (inp.transferTaxPct !== null && inp.transferTaxPct > 6) add("transferTaxOther", "Transfer tax rate should be 6% or less");
    if (inp.assist !== null && price > 0 && inp.assist > price * 0.1) add("assist", "Closing cost assistance can't be more than 10% of the price");

    if (mode === "buyer") {
      if (s.loanType === "C" && inp.loanAmount !== null) {
        if (inp.loanAmount <= 0) add("loanAmount", "Loan amount must be more than $0. Choose Cash if there is no loan.");
        else if (price > 0 && inp.loanAmount > price) add("loanAmount", "Loan amount can't be more than the sales price");
      }
      if (s.loanType && s.loanType !== "CASH") {
        if (inp.rate !== null && (inp.rate <= 0 || inp.rate > 20)) add("rate", "Interest rate should be between 0 and 20. Enter 6.5 for 6.5%.");
        if (inp.termYears !== null && (inp.termYears < 1 || inp.termYears > 40)) add("termYears", "Loan term should be 1 to 40 years");
        if (inp.points !== null && inp.points > 5) add("points", "Points should be 5 or less. Enter 1 for one point.");
      }
      if (inp.taxMonths !== null && inp.taxMonths > 14) add("taxMonths", "Tax months should be 14 or less");
      if (!buyerCommissionIsFlat() && parseNum(s.buyerPaidCommission) > 15) add("buyerPaidCommission", "Commission percent should be 15 or less. Switch to a flat dollar amount if you meant dollars.");
      if (buyerCommissionIsFlat() && price > 0 && inp.buyerPaidCommission > price * 0.15) add("buyerPaidCommission", "Commission can't be more than 15% of the price");
      if ((inp.secondLoan || 0) > 0) {
        if (inp.secondRate === null) add("secondRate", "Second loan interest rate");
        else if (inp.secondRate > 20) add("secondRate", "Second loan rate should be 20 or less");
        if (!inp.secondTermYears) add("secondTermYears", "Second loan term");
        if (price > 0 && (inp.loanAmount || 0) + inp.secondLoan > price) add("secondLoan", "First and second loans together can't be more than the price");
      }
      var lim = R.limits, b = r.buyer;
      if (inp.assist > 0 && r.maxSellerAssist !== null && inp.assist > r.maxSellerAssist + 0.005)
        warn("assist", "Seller assistance of " + money(inp.assist) + " is above the usual limit of " + money(r.maxSellerAssist) + " for this loan. Confirm with the lender.");
      if (inp.assist > 0 && price > 0 && inp.assist > b.closingTotal + b.prepaid.total)
        warn("assist", "Seller assistance is more than the buyer's total closing costs and prepaids. The extra usually can't go to the buyer.");
      if (b.rawCashNeeded < -0.005)
        warn("", "Credits and loans are " + money(-b.rawCashNeeded) + " more than the total cost. Cash needed shows $0. Check the loan amount and credits.");
      if (s.loanType === "C" && inp.loanAmount > lim.conformingLoan)
        warn("loanAmount", "Loan is above the " + usd0.format(lim.conformingLoan) + " conforming limit. Jumbo rates and fees differ. Confirm with the lender.");
      if (marketRate && s.loanType && s.loanType !== "CASH" && inp.rate === marketRate)
        warn("rate", "Interest rate is the " + L.market.source + " weekly average (" + marketRate + "%), not a lender quote. Confirm it before you print.");
      if (s.loanType !== "CASH" && Number(s.insurancePlan))
        warn("insurancePlan", "Homeowners insurance (" + money(inp.annualInsurance) + " a year) is a Pennsylvania average scaled to the price, not a quote. Confirm it before you print." +
          (price > 0 && Number(s.insurancePlan) !== insuranceBand(price) ? " It's the tier for a " + dollars0(Number(s.insurancePlan)) + " home, and the price is " + dollars0(price) + "." : ""));
      if (s.loanType === "F" && price * R.fha.loanToValue > lim.fhaLoan)
        warn("price", "This is above the " + usd0.format(lim.fhaLoan) + " FHA loan limit. The buyer would need a larger down payment than this sheet assumes.");
    } else {
      if (!commissionIsFlat() && inp.commissionValue !== null && inp.commissionValue > 15) add("commissionValue", "Commission percent should be 15 or less. Switch to a flat dollar amount if you meant dollars.");
      if (commissionIsFlat() && inp.commissionValue !== null && price > 0 && inp.commissionValue > price * 0.15) add("commissionValue", "Commission can't be more than 15% of the price");
      if (inp.mortgagePayoff !== null && price > 0 && inp.mortgagePayoff > price * 2) add("mortgagePayoff", "Mortgage payoff looks too large. Check the number.");
      if (inp.mortgagePayoff === null) warn("mortgagePayoff", "No mortgage payoff entered. The sheet will say the return is before any payoff.");
      if (s.loanType === "") warn("loanType", "Buyer's loan type isn't set. If the buyer uses a VA loan, the pest inspection moves to the seller.");
      if (r.seller.net < 0) warn("", "The seller would owe money at settlement on these numbers.");
    }
    if (inp.settlementDate) {
      var d = inp.settlementDate, today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(d.year, d.month - 1, d.day) < today) warn("settlementDate", "The settlement date is in the past.");
    }
    return { errors: errors, warnings: warnings, required: required };
  }

  // ---------- Sheets ----------
  function row(k, v, cls, note) {
    var key = h("span", { class: "k", text: k });
    if (note) { key.appendChild(document.createTextNode(" ")); key.appendChild(h("span", { class: "muted", text: note })); }
    return h("div", { class: "row " + (cls || "") }, [key, h("span", { class: "v", text: v })]);
  }
  function block(title, rows) { return h("div", { class: "block" }, [h("h3", { text: title })].concat(rows)); }
  function officeName(s) {
    var o = R.offices.filter(function (x) { return String(x.no) === s.office; })[0];
    return o ? "Coldwell Banker - " + o.name : "";
  }
  function sheetShell(title, s, metaRows, body, fine, signLabel) {
    var today = new Date();
    var kids = [];
    if (!R.approved) kids.push(h("div", { class: "draft-bar", text: "DRAFT – FEE TABLE NOT YET APPROVED – NOT FOR CLIENT USE" }));
    kids.push(h("div", { class: "sheet-head" }, [
      h("img", { class: "sheet-logo", src: "logos/cb-logo-blue-framed-cropped.png", alt: "Coldwell Banker" }),
      h("div", {}, [h("div", { class: "co", text: "Coldwell Banker Realty" }), h("h1", { text: title })]),
      h("div", { class: "est", text: "ESTIMATE ONLY" })
    ]));
    kids.push(h("div", { class: "sheet-body" }, [
      h("dl", { class: "meta" }, metaRows.map(function (m) { return h("div", {}, [h("dt", { text: m[0] }), h("dd", { text: m[1] || "—" })]); })),
      body,
      h("div", { class: "fine" }, fine.map(function (t) { return h("p", { text: t }); })),
      h("div", { class: "sign" }, [
        h("div", { class: "line" }, [h("span", { text: signLabel }), h("span", { text: "Date" })]),
        h("div", { class: "line" }, [h("span", { text: signLabel }), h("span", { text: "Date" })]),
        h("div", { class: "line" }, [h("span", { text: "Agent: " + (s.agentName || "") })]),
        h("div", { class: "line" }, [h("span", { text: "Office: " + officeName(s) })])
      ]),
      h("div", { class: "sheet-foot" }, [
        h("span", { text: "Prepared " + today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) }),
        h("span", { text: "Fee table " + R.version })
      ])
    ]));
    return kids;
  }

  function drawBuyer(s, inp, r) {
    var b = r.buyer, p = b.prepaid, m = b.monthly, c = b.credits;
    var typeName = { C: "Conventional", F: "FHA", V: "VA", CASH: "Cash" }[s.loanType] || "—";
    var left = [
      block("Estimated closing costs", b.closing.map(function (x) {
        var pct = x[0] === "Buyer Paid Agent Commission" && !buyerCommissionIsFlat() ? parseNum(s.buyerPaidCommission) : null;
        return row(x[0], moneyOrDash(x[1]), "", pct ? "(" + pct + "%)" : "");
      })
        .concat([row("Total Closing Costs", money(b.closingTotal), "total")])),
      block("Estimated prepaid items", [
        row("Taxes", moneyOrDash(p.taxes), "", "(" + grouped(p.taxMonths) + " months)"),
        row("Insurance", moneyOrDash(p.insurance), "", "(" + p.insuranceMonths + " months)"),
        row("FHA / VA First Use Premium", moneyOrDash(p.govPremium)),
        row("PMI Escrow", moneyOrDash(p.pmiEscrow), "", "(" + p.pmiEscrowMonths + " months)"),
        row("Interest", moneyOrDash(p.interest), "", "(" + p.interestDays + " days at " + money(p.perDiem) + " per day)"),
        row("Total Prepaid Items", money(p.total), "total")
      ])
    ];
    var right = [
      block("Estimated cash needed at settlement", [
        row("Sales Price", money(b.price)),
        row("Total Closing Costs", money(b.closingTotal), "indent"),
        row("Total Prepaid Items", money(p.total), "indent"),
        row("Sub Total", money(b.subTotal), "total"),
        row("Less", "", "head"),
        row("Hand Money Deposit", moneyOrDash(c.handMoney), "indent"),
        row("Company / Relocation Contribution", moneyOrDash(c.relocation), "indent"),
        row("Secondary Financing", moneyOrDash(c.secondLoan), "indent"),
        row("Costs Paid By Seller", moneyOrDash(c.sellerAssist), "indent"),
        row("Mortgage Loan (" + (s.loanType === "F" || s.loanType === "V" ? typeName : "Conventional") + ")", moneyOrDash(c.loanConventional + c.loanGov), "indent"),
        row("Sub Total", money(c.total), "total"),
        row("Est. Cash Needed At Settlement", money(b.cashNeeded), "grand")
      ]),
      block("Estimated monthly payment", [
        row("Loan Amount", moneyOrDash(r.loan)),
        row("Type of Loan", typeName),
        row("Term and Rate", s.loanType && s.loanType !== "CASH" && inp.termYears && inp.rate ? grouped(inp.termYears) + " years at " + inp.rate + "%" : "–"),
        row("Principal & Interest", moneyOrDash(m.principalInterest), "indent"),
        row("2nd Mortgage Principal & Interest", moneyOrDash(m.secondPrincipalInterest), "indent"),
        row("Estimated Taxes", moneyOrDash(m.taxes), "indent"),
        row("Estimated Insurance", moneyOrDash(m.insurance), "indent"),
        row("Conventional Mortgage Insurance*", moneyOrDash(m.pmi), "indent"),
        row("FHA Mortgage Insurance", moneyOrDash(m.fhaMip), "indent"),
        row("Condo Fee", moneyOrDash(m.condoFee), "indent"),
        row("Est. Monthly Payment", money(m.total), "grand")
      ])
    ];
    var fine = [
      "*PMI is based off of a minimum credit score of 700.",
      "Cash Required at Settlement must be in the form of a Cashiers or Certified Check made payable to the Buyer's order.",
      "I/We understand that the above costs are ESTIMATED and are based on the best information available at this date and that they are subject to changes, particularly in the case of escrow and prepaid such as taxes, water, sewage, rent and insurance. Further, these costs are based upon a projected settlement date noted above, which may change and may affect these estimates.",
      "Lender and title company charges shown are typical amounts and will vary by provider and loan program. This estimate is not a Loan Estimate or Closing Disclosure from a lender.",
      "I/We hereby agree that I/We have read and received a copy of this ESTIMATED COST TO BUYER AT SETTLEMENT prior to signing an agreement of sale to purchase the property noted above."
    ];
    var meta = [
      ["Buyers:", s.buyerName], ["Sellers:", s.sellerName],
      ["Property Address:", [s.address, s.cityStateZip].filter(Boolean).join(", ")],
      ["Est. Settlement Date:", inp.settlementDate ? longDate(inp.settlementDate) : ""]
    ];
    return sheetShell("Estimated Costs to Buyer at Settlement", s, meta,
      h("div", { class: "cols" }, [h("div", {}, left), h("div", {}, right)]), fine, "Buyer");
  }

  function drawSeller(s, inp, r) {
    var x = r.seller;
    var commissionNote = !commissionIsFlat() && inp.commissionValue !== null ? "(" + inp.commissionValue + "%)" : "";
    var rows = x.expenses.map(function (e, i) {
      return row(e[0], e[1] === null ? "TBD at closing" : moneyOrDash(e[1]), "indent", i === 4 ? commissionNote : "");
    });
    var body = h("div", {}, [
      block("Sale", [row("Sales Price", money(x.price))]),
      block("Estimated closing costs", rows.concat([row("Total Expenses", money(x.expenseTotal), "total")])),
      block("Estimated return", [
        row("Balance After Expenses", money(x.balance)),
        row("Estimated Mortgage / Lien Payoff", x.hasPayoff ? money(x.payoff) : "Not included", "indent"),
        row("Insurance Refund", "TBD at closing", "indent"),
        row("Tax Refund", "TBD at closing", "indent"),
        row("Other Credits", "TBD at closing", "indent"),
        row(sellerNetLabel(x), money(x.net), "grand")
      ])
    ]);
    var fine = [
      "I/We understand that the above figures are ESTIMATED and are based on the best information available at this date. They are subject to change, particularly the proration of taxes, water, sewage and rent, and the payoff of any existing mortgages, liens or judgments, which are determined at closing. These figures are based upon a projected settlement date noted above, which may change and may affect these estimates.",
      x.hasPayoff
        ? "The mortgage payoff shown is an estimate supplied for this sheet. The actual payoff is set by the lender's written payoff statement."
        : "This estimate does NOT subtract the payoff of any existing mortgage, lien or judgment against the property.",
      "I/We hereby agree that I/We have read and received a copy of this ESTIMATED RETURN TO SELLER AT SETTLEMENT prior to signing an agreement of sale for the property noted above."
    ];
    var meta = [
      ["Seller:", s.sellerName],
      ["Est. Settlement Date:", inp.settlementDate ? longDate(inp.settlementDate) : ""],
      ["Property Address:", [s.address, s.cityStateZip].filter(Boolean).join(", ")]
    ];
    return sheetShell("Estimated Return to Seller at Settlement", s, meta, body, fine, "Seller");
  }
  function sellerNetLabel(x) {
    return x.hasPayoff ? "Estimated Return to Seller at Settlement" : "Estimated Return to Seller Before Mortgage Payoff";
  }

  // The preview is the real page at letter size, scaled down to fit its column.
  var PAGE_W = 816, PAGE_H = 1056;
  function fitSheet() {
    var box = $("paperFit");
    if (!box.clientWidth) return;
    // Phone preview defaults to an easy-read layout (one column, full-size type) instead of a shrunken page.
    var easyRead = document.body.classList.contains("previewing") && !document.body.classList.contains("page-view") && window.matchMedia("(max-width: 900px)").matches;
    if (easyRead) { $("pageNote").textContent = "Easy-read view"; $("pageNote").classList.remove("bad"); return; }
    box.style.setProperty("--fit", String(Math.min(1, box.clientWidth / PAGE_W)));
    var over = $("sheet").scrollHeight > PAGE_H + 1;
    $("pageNote").textContent = over ? "Runs past 1 page" : "Letter · 1 page";
    $("pageNote").classList.toggle("bad", over);
  }

  // ---------- Render ----------
  function setMessage(id, text) {
    var el = $(id);
    el.hidden = !text;
    el.lastChild.textContent = text || "";
  }
  function renderSteps(errs, s) {
    for (var n = 1; n <= stepCount; n++) {
      var bad = 0, miss = 0, req = 0;
      errs.forEach(function (e) { if (e.step === n) { if (e.missing) miss++; else bad++; } });
      Object.keys(entries).forEach(function (id) {
        var f = FIELDS[id];
        if (entries[id].step === n && (f.req === true || f.req === mode) && shown(id, s)) req++;
      });
      var state = bad ? "bad" : miss ? "todo" : req ? "done" : "optional";
      var stat = $("ss-" + n), numc = $("sn-" + n);
      stat.textContent = bad ? bad + " to fix" : miss ? miss + " to go" : req ? "Done" : "Optional";
      stat.className = "sstat" + (state === "bad" ? " bad" : state === "done" ? " ok" : "");
      if (numc.getAttribute("data-state") !== state) {
        numc.setAttribute("data-state", state);
        numc.className = "numc" + (state === "bad" ? " bad" : state === "done" ? " done" : "");
        if (state === "done") fill(numc, [icon("check", 14, 3)]); else numc.textContent = String(n);
      }
    }
  }
  function renderStatus(errs, warnings, ready) {
    var key = JSON.stringify([mode, errs, ready ? warnings : 0]);
    if (key === statusKey) return;
    statusKey = key;
    var st = $("status");
    st.textContent = "";
    if (!ready) {
      var fix = errs.filter(function (e) { return !e.missing; }), need = errs.filter(function (e) { return e.missing; });
      var todo = function (e) {
        return h("button", { type: "button", class: "todo" + (e.missing ? "" : " err"), "data-goto": e.id }, [
          e.missing ? null : icon("err", 16, 2.2),
          h("span", { text: e.msg }),
          h("span", { class: "st", text: "Step " + e.step }),
          e.missing ? icon("arrow", 16, 2.2) : null
        ]);
      };
      var kids = [h("div", { class: "ptitle" }, [
        h("span", { text: (fix.length && !need.length ? "Fix before you print" : "Still to do") + " · " + errs.length }),
        h("small", { text: "Tap an item to go to it" })
      ])];
      if (fix.length) kids.push(h("div", { class: "grp e", text: "Fix these" }), h("div", { class: "todos" }, fix.map(todo)));
      if (need.length) kids.push(h("div", { class: "grp", text: "Still needed" }), h("div", { class: "todos" }, need.map(todo)));
      st.appendChild(h("div", { class: "panel need" }, kids));
    } else if (warnings.length) {
      st.appendChild(h("div", { class: "panel warn" }, [
        h("div", { class: "ptitle" }, [icon("warn", 16, 2.2), h("span", { text: "Check before you print" }), h("span", { class: "pill", text: "Won't block printing" })]),
        h("ul", {}, warnings.map(function (w) { return h("li", { text: w.msg }); }))
      ]));
    } else {
      st.appendChild(h("div", { class: "panel ready" }, [
        h("div", { class: "ptitle" }, [icon("check", 14, 3), h("span", { text: "Ready to print. Every required item is done and nothing needs checking." })])
      ]));
    }
  }
  function ring(done, total) {
    var r = 15, c = 2 * Math.PI * r, p = total ? done / total : 1;
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", "40"); s.setAttribute("height", "40"); s.setAttribute("viewBox", "0 0 40 40"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<circle class="ring-track" cx="20" cy="20" r="' + r + '" fill="none" stroke-width="5"/>' +
      '<circle class="ring-fill" cx="20" cy="20" r="' + r + '" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="' +
      (c * p).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 20 20)"/>';
    return s;
  }

  function render() {
    document.body.setAttribute("data-mode", mode);
    $("home").hidden = mode !== "home";
    $("workspace").hidden = mode === "home";
    $("keybar").hidden = mode === "home";
    $("pbottom").hidden = mode === "home";
    document.querySelectorAll("#modeSwitch button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-mode") === mode ? "true" : "false");
    });
    if (mode === "home") { document.body.classList.remove("can-print", "previewing"); return; }

    var s = values;
    var inp = toEngineInput(s);
    var r = E.calculate(inp, R);
    var v = validate(s, inp, r);
    var ready = v.errors.length === 0;
    // Same errors list, sorted: a blank field is "still needed", anything else is "fix this".
    var errs = v.errors.map(function (e) {
      return { id: e.id, msg: e.msg, step: entries[e.id] ? entries[e.id].step : 0, missing: e.msg === labelOf(e.id) || isBlank(e.id, s) };
    });

    // Conditional fields and live hints
    Object.keys(entries).forEach(function (id) { $("f-" + id).hidden = !shown(id, s); });
    [["commissionValue", commissionIsFlat], ["buyerPaidCommission", buyerCommissionIsFlat]].forEach(function (c) {
      if (!entries[c[0]]) return;
      var cv = $("f-" + c[0]);
      cv.querySelector(".control").className = "control " + (c[1]() ? "money" : "pct");
      cv.querySelector("label").firstChild.nodeValue = labelOf(c[0]);
    });
    var muni = muniOf(s);
    if (entries.muniNote && (muni || s.municipality === "all-others")) {
      $("f-muniNote").lastChild.textContent = (muni
        ? "Transfer tax here is " + muni.total + "% total: state " + L.stateTransferTax + "%, " + muni.name + " " + muni.muni + "%, " + muni.school + " schools " + muni.sd + "%."
        : "Transfer tax is " + USUAL_TAX + "% total: state " + L.stateTransferTax + "%, local " + (USUAL_TAX - L.stateTransferTax) + "%.") + " Buyer and seller each pay half.";
    }
    if (entries.address) $("h-address").textContent = addressNote;
    if (entries.insurancePlan) {
      var insSelect = $("insurancePlan"), insFirst = String(inp.price > 0 ? insuranceBand(inp.price) : "");
      if (insSelect.getAttribute("data-first") !== insFirst) {
        insSelect.setAttribute("data-first", insFirst);
        fill(insSelect, [h("option", { value: "", text: "Choose…" })].concat(insuranceOptions(inp.price || 0).map(function (o) { return h("option", { value: o.v, text: o.label }); })));
        insSelect.value = s.insurancePlan || "";
      }
    }
    if (entries.govNote && (s.loanType === "F" || s.loanType === "V")) {
      $("f-govNote").lastChild.textContent = (s.loanType === "F"
        ? "FHA: the sheet assumes 3.5% down and finances the 1.75% upfront premium."
        : "VA: the sheet assumes no down payment and finances the 2.15% first-use funding fee.")
        + " The loan amount is set for you" + (r.loan ? ": " + money(r.loan) + "." : ".");
    }
    if (entries.loanAmount) {
      var down = inp.price - inp.loanAmount;
      var hasDown = s.loanType === "C" && inp.price > 0 && inp.loanAmount > 0 && down >= 0;
      $("h-loanAmount").textContent = hasDown ? "Down payment " + money(down) + " (" + grouped(down / inp.price * 100) + "%)" : "";
      document.querySelectorAll("#f-loanAmount .chip").forEach(function (c) {
        var on = hasDown && Math.abs(down / inp.price * 100 - Number(c.getAttribute("data-down"))) < 0.005;
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    if (entries.assist && mode === "buyer") {
      $("h-assist").textContent = r.maxSellerAssist !== null && inp.price > 0 ? "Usual limit for this loan: " + money(r.maxSellerAssist) : "";
    }
    Object.keys(entries).forEach(function (id) {
      var f = FIELDS[id];
      if (f.kind === "note" || f.kind === "calc") return;
      var wrap = $("f-" + id);
      var err = errs.filter(function (e) { return e.id === id; })[0];
      var bad = !!err && !!(touched[id] || showAll);
      var fix = bad && !err.missing;
      var warn = ready ? v.warnings.filter(function (w) { return w.id === id; }).map(function (w) { return w.msg; }).join(" ") : "";
      wrap.classList.toggle("invalid", bad);
      wrap.classList.toggle("warn", !!warn);
      setMessage("e-" + id, fix ? err.msg : "");
      setMessage("w-" + id, warn);
      var hint = $("h-" + id);
      hint.hidden = fix || !!warn || !hint.textContent;
      var box = wrap.querySelector(".control input, .control select, .tiles");
      if (bad) box.setAttribute("aria-invalid", "true"); else box.removeAttribute("aria-invalid");
    });
    renderSteps(errs, s);

    // Headline numbers
    var big, small;
    if (mode === "buyer") {
      big = ["Estimated cash needed at settlement", r.buyer.cashNeeded];
      small = ["Estimated monthly payment", r.buyer.monthly.total];
    } else {
      big = [r.seller.hasPayoff ? "Estimated return to seller" : "Estimated return before mortgage payoff", r.seller.net];
      small = ["Total selling expenses", r.seller.expenseTotal];
    }
    var left = v.errors.length;
    var done = Math.max(0, v.required - Math.min(v.required, left));
    $("heroLabel").textContent = big[0];
    $("heroValue").textContent = ready ? usd0.format(big[1]) : "—";
    $("heroValue").classList.toggle("dash", !ready);
    $("heroWhy").hidden = ready;
    $("heroSideLabel").textContent = small[0];
    $("heroSideValue").textContent = ready ? usd0.format(small[1]) : "—";
    var bar = $("heroBar");
    bar.setAttribute("aria-valuemax", String(v.required));
    bar.setAttribute("aria-valuenow", String(done));
    bar.firstChild.style.width = (v.required ? Math.round(done / v.required * 100) : 100) + "%";
    $("heroProgress").textContent = ready ? "Ready to print · all " + v.required + " required items done" : done + " of " + v.required + " required items done";
    var printBtn = $("printBtn");
    printBtn.disabled = !ready;
    fill(printBtn, ready ? [icon("print", 18), document.createTextNode("Print / Save PDF")]
      : [icon("lock", 16), document.createTextNode("Finish " + plural(left, "item"))]);

    // Checklist and warnings
    renderStatus(errs, v.warnings, ready);
    document.body.classList.toggle("can-print", ready);

    // The sheet
    var paper = $("sheet");
    paper.textContent = "";
    (mode === "buyer" ? drawBuyer : drawSeller)(s, inp, r).forEach(function (k) { paper.appendChild(k); });
    paper.className = "paper " + mode + (ready ? "" : " incomplete");
    $("paperFlag").hidden = ready;
    fitSheet();

    // Phone: key number under the header, preview and print pinned at the bottom
    $("kLabel").textContent = mode === "buyer" ? "Cash needed" : r.seller.hasPayoff ? "Seller net" : "Seller net · before payoff";
    $("kValue").textContent = ready ? usd0.format(big[1]) : "—";
    $("kValue").classList.toggle("dash", !ready);
    fill($("kRing"), [ring(done, v.required)]);
    var kLeft = $("kLeft"), hasFix = errs.some(function (e) { return !e.missing; });
    kLeft.className = "leftbtn" + (ready ? (v.warnings.length ? " warn" : " ok") : hasFix ? " bad" : "");
    fill(kLeft, ready
      ? (v.warnings.length ? [icon("warn", 16, 2.2), document.createTextNode("Check")] : [icon("check", 14, 3), document.createTextNode("Ready")])
      : [document.createTextNode(left + " left"), icon("chev", 14)]);
    kLeft.setAttribute("aria-label", ready ? (v.warnings.length ? "Things to check before you print" : "Ready to print") : plural(left, "item") + " left. Go to the list.");
    var pPrint = $("pPrint");
    pPrint.disabled = !ready;
    fill(pPrint, ready ? [icon("print", 18), document.createTextNode("Print / Save PDF")]
      : [icon("lock", 16), document.createTextNode("Print · " + left + " left")]);

    lastReady = ready;
    lastHeadline = ready ? big[0] + ": " + usd0.format(big[1]) + ". " + small[0] + ": " + usd0.format(small[1]) + "." : "";
  }
  // Screen readers hear the headline when a field is left, not on every keystroke.
  function announce() { if ($("liveNum").textContent !== lastHeadline) $("liveNum").textContent = lastHeadline; }

  function setMode(next) {
    mode = next;
    touched = {}; showAll = false;
    document.body.classList.remove("previewing");
    if (mode !== "home") buildForm();
    render();
    window.scrollTo(0, 0);
    document.querySelectorAll(".inputs-col, .preview").forEach(function (c) { c.scrollTop = 0; });
    $("liveNum").textContent = "";
  }

  // ---------- Events ----------
  function buildHero() {
    fill($("hero"), [
      h("div", {}, [
        h("div", { class: "hk", id: "heroLabel" }),
        h("div", { class: "hv", id: "heroValue" }),
        h("div", { class: "hwhy", id: "heroWhy", text: "Shows when the required fields are done." })
      ]),
      h("div", { class: "hside" }, [h("div", { class: "hk", id: "heroSideLabel" }), h("b", { id: "heroSideValue" })]),
      h("div", { class: "hfoot" }, [
        h("div", { class: "prog" }, [
          h("div", { class: "bar", id: "heroBar", role: "progressbar", "aria-label": "Required items done", "aria-valuemin": "0" }, [h("i")]),
          h("small", { id: "heroProgress" })
        ]),
        h("button", { type: "button", class: "pbtn", id: "printBtn" })
      ])
    ]);
  }
  function goTo(id) {
    showAll = true;
    var wrap = $("f-" + id);
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: "instant", block: "center" });
    var target = wrap.querySelector("input:checked, input, select");
    if (target) target.focus({ preventScroll: true });
    render();
  }
  // ---------- Address lookup ----------
  // The street address (nothing else) goes to the U.S. Census Bureau's public geocoder, which answers
  // with the county and municipality. If it can't answer, the agent picks them by hand.
  function muniBase(n) {
    return n.toLowerCase().replace(/\(.*\)/, "").replace(/\bmount\b/g, "mt").replace(/\b(township|twp|borough|boro|city|municipality)\b\.?\s*$/, "").replace(/[^a-z]/g, "");
  }
  function muniKind(n) { return /(township|twp)\s*$/i.test(n) ? "twp" : /(borough|boro)\s*$/i.test(n) ? "boro" : ""; }
  function matchMuni(censusName) {
    var same = L.municipalities.filter(function (m) { return muniBase(m[0]) === muniBase(censusName); });
    if (same.length > 1 && muniBase(censusName) !== "pittsburgh") same = same.filter(function (m) { return muniKind(m[0]) === muniKind(censusName); });
    return same.length ? MUNIS[same[0][0]] : null;
  }
  function setField(id, value) { values[id] = value; if (entries[id] && $(id)) $(id).value = value; }
  function lookupAddress() {
    var q = [values.address, values.cityStateZip].filter(Boolean).join(", ");
    if (!values.address || !values.cityStateZip || q === lastLookup) return;
    lastLookup = q;
    var seq = ++lookupSeq, cb = "ccsGeo" + seq, script = document.createElement("script");
    var failed = "Couldn't look that address up. Pick the municipality yourself.";
    var timer = setTimeout(function () { finish(failed); }, 10000);
    function finish(note) {
      clearTimeout(timer);
      window[cb] = function () {};
      script.remove();
      if (seq !== lookupSeq || mode === "home") return;
      addressNote = note;
      render();
    }
    window[cb] = function (data) {
      var hit = data && data.result && data.result.addressMatches && data.result.addressMatches[0];
      var geo = hit && hit.geographies, county = geo && geo.Counties && geo.Counties[0], sub = geo && geo["County Subdivisions"] && geo["County Subdivisions"][0];
      if (!county || !sub) return finish("Couldn't find that address. Check it, or pick the municipality yourself.");
      var known = R.counties.some(function (c) { return c.name === county.BASENAME; });
      setField("county", known ? county.BASENAME : "Other county");
      var muni = county.BASENAME === L.transferTaxCounty ? matchMuni(sub.NAME) : null;
      setField("municipality", muni ? (muni.total > USUAL_TAX ? muni.name : "all-others") : "");
      finish("Found it: " + (muni ? muni.name : sub.NAME) + ", " + county.NAME + ". " +
        (muni ? "Transfer tax set to " + muni.total + "%." : "Rates outside " + L.transferTaxCounty + " County aren't loaded. Pick the transfer tax yourself."));
    };
    script.onerror = function () { finish(failed); };
    script.src = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?benchmark=Public_AR_Current&vintage=Current_Current" +
      "&layers=County+Subdivisions,Counties&format=jsonp&callback=" + cb + "&address=" + encodeURIComponent(q);
    document.head.appendChild(script);
  }
  function openPreview() {
    document.body.classList.add("previewing");
    $("paperbox").scrollTop = 0;
    fitSheet();
    $("pBack").focus();
  }
  function closePreview() {
    if (!document.body.classList.contains("previewing")) return;
    document.body.classList.remove("previewing");
    $("pPreview").focus();
  }
  function wire() {
    var form = $("form");
    var take = function (t) {
      var id = t.type === "radio" ? t.name : t.id;
      if (!FIELDS[id]) return null;
      values[id] = t.value.trim();
      return id;
    };
    form.addEventListener("input", function (e) { if (take(e.target)) render(); });
    form.addEventListener("change", function (e) {
      var id = take(e.target);
      if (id === "agentName" || id === "office") remember(id, values[id]);
      if (id === "hasSecond" && values.hasSecond !== "yes") {
        // "No" clears the second-loan fields so a forgotten value can't ride along.
        SECOND.forEach(function (k) { values[k] = ""; touched[k] = false; if ($(k)) $(k).value = ""; });
      }
      if (id) render();
    });
    form.addEventListener("focusout", function (e) {
      var id = e.target.type === "radio" ? e.target.name : e.target.id;
      var f = FIELDS[id];
      if (!f) return;
      touched[id] = true;
      if (f.kind === "money" || (id === "commissionValue" && commissionIsFlat()) || (id === "buyerPaidCommission" && buyerCommissionIsFlat())) {
        var x = parseNum(e.target.value);
        e.target.value = x === null ? "" : grouped(x);
        values[id] = e.target.value;
      }
      render();
      announce();
      if (id === "address" || id === "cityStateZip") lookupAddress();
    });
    form.addEventListener("click", function (e) {
      var down = e.target.getAttribute && e.target.getAttribute("data-down");
      if (!down) return;
      var price = parseNum(values.price);
      if (!price) { touched.price = true; $("price").focus(); render(); return; }
      values.loanAmount = grouped(Math.round(price * (100 - Number(down))) / 100);
      $("loanAmount").value = values.loanAmount;
      touched.loanAmount = true;
      render();
      announce();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });

    document.querySelectorAll("[data-mode]").forEach(function (b) {
      if (b.tagName === "BUTTON") b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
    });
    $("homeBtn").addEventListener("click", function () { setMode("home"); });
    $("status").addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest("[data-goto]") : null;
      if (item) goTo(item.getAttribute("data-goto"));
    });
    var print = function () { if (lastReady) window.print(); };
    $("printBtn").addEventListener("click", print);
    $("pPrint").addEventListener("click", print);
    $("pPreview").addEventListener("click", openPreview);
    $("pBack").addEventListener("click", closePreview);
    $("pView").addEventListener("click", function () {
      var page = document.body.classList.toggle("page-view");
      this.setAttribute("aria-pressed", page ? "true" : "false");
      this.textContent = page ? "Show easy-read" : "Show full page";
      $("paperbox").scrollTop = 0;
      fitSheet();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePreview(); });
    $("kLeft").addEventListener("click", function () {
      var st = $("status");
      st.scrollIntoView({ behavior: "instant", block: "start" });
      (st.querySelector("button") || st).focus({ preventScroll: true });
    });
    if (window.ResizeObserver) new ResizeObserver(fitSheet).observe($("paperFit"));
    else window.addEventListener("resize", fitSheet);

    // "New deal" asks in the app. The dialog keeps focus inside and hands it back when it closes.
    var dialog = $("newDealDialog");
    $("newDeal").addEventListener("click", function () { dialog.showModal(); });
    $("ndCancel").addEventListener("click", function () { dialog.close(); });
    $("ndOk").addEventListener("click", function () {
      dialog.close();
      resetValues();
      setMode(mode);
    });
  }

  resetValues();
  buildHero();
  wire();
  render();
})();
