/*
 * RATE TABLE - the only place fees, rates and limits live.
 * Agents never see or edit this file. Change a number here, bump `version`,
 * and every sheet printed afterwards carries the new version in its footer.
 *
 * Source for every value unless noted: "PGH Cost Sheet Sept 24.xlsx"
 * (tabs marked Revised 03/04/2024 and 08/28/2024).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CostSheetRates = factory();
})(typeof self !== "undefined" ? self : this, function () {
  return {
    version: "2026.10-draft1",
    // Flip to true only after title, lender, RVP and legal have signed off on this table.
    // While false, every sheet prints with a DRAFT banner.
    approved: false,

    offices: [
      { no: 2640, name: "North Hills" },
      { no: 2643, name: "Airport" },
      { no: 2648, name: "Fox Chapel" },
      { no: 2664, name: "Squirrel Hill" },
      { no: 2665, name: "Cranberry" },
      { no: 2668, name: "Pleasant Hills" },
      { no: 2669, name: "North Huntingdon" },
      { no: 2671, name: "South Hills" },
      { no: 2672, name: "Peters" },
      { no: 2673, name: "East Regional" },
      { no: 2677, name: "Shadyside" }
    ],

    // County -> recording fee group used by the spreadsheet (A / B / AB / C).
    counties: [
      { name: "Allegheny", group: "A" },
      { name: "Armstrong", group: "AB" },
      { name: "Beaver", group: "AB" },
      { name: "Butler", group: "B" },
      { name: "Fayette", group: "B" },
      { name: "Greene", group: "B" },
      { name: "Washington", group: "C" },
      { name: "Other county", group: "C" }
    ],
    recordingFees: { A: 363.5, B: 183.5, AB: 221.5, C: 200.5 },

    // Lender-side charges by loan type: C conventional, F FHA, V VA, CASH.
    lenderFees: {
      appraisal:   { C: 600,  F: 625,  V: 625, CASH: 0 },
      creditReport:{ C: 100,  F: 100,  V: 100, CASH: 0 },
      lenderFees:  { C: 1640, F: 1640, V: 0,   CASH: 0 },
      application: { C: 150,  F: 150,  V: 0,   CASH: 0 },
      floodCert:   { C: 20,   F: 20,   V: 0,   CASH: 0 }
    },

    // Title company charges on the buyer side. All fixed; agents cannot change them.
    title: {
      settlementFee: { C: 150, F: 150, V: 150, CASH: 0 },
      docPrep: 100,
      endorsements: 400,
      courierWire: 56,
      notary: 0,
      closingProtection: 125,
      // Owner's policy, Sale Rate. Matches TIRBOP Manual section 5.50 as published at
      // patitleratingbureau.org/section-550 (checked 2026-10-11): flat charge to $30,000,
      // then an added charge per $1,000 "or fraction thereof" in each bracket.
      saleRateBase: 569,
      saleRateBaseLimit: 30000,
      saleRateBrackets: [
        { upTo: 45000,    perThousand: 7.41 },
        { upTo: 100000,   perThousand: 6.27 },
        { upTo: 500000,   perThousand: 5.70 },
        { upTo: 1000000,  perThousand: 4.56 },
        { upTo: 2000000,  perThousand: 3.42 },
        { upTo: 7000000,  perThousand: 2.28 },
        { upTo: 30000000, perThousand: 1.71 },
        { upTo: Infinity, perThousand: 1.42 }
      ],
      // Enhanced policy priced at 110% of the Sale Rate (from the spreadsheet; not re-verified).
      enhancedMultiplier: 1.1
    },

    transferTax: {
      buyerShare: 0.5,
      choices: [
        { pct: 2, label: "2%" },
        { pct: 5, label: "5%  City of Pittsburgh" }
      ]
    },

    // Conventional PMI, annual rate by loan-to-value. Sheet note: based on a minimum credit score of 700.
    pmi: [
      { ltvAbove: 0.95, annualRate: 0.0098 },
      { ltvAbove: 0.90, annualRate: 0.0078 },
      { ltvAbove: 0.85, annualRate: 0.0052 },
      { ltvAbove: 0.80, annualRate: 0.0032 }
    ],
    pmiEscrowMonths: 2,
    insurancePrepaidMonths: 14,

    fha: { loanToValue: 0.965, upfrontPremium: 0.0175, annualPremium: 0.0055, baseRoundTo: 50 },
    va: { fundingFee: 0.0215 },

    // Seller-side fixed charges.
    seller: {
      settlementFee: 150,
      processingFee: 0,
      deedAndNotary: 200,
      dyeTest: 250,
      resaleCertificate: 0,
      overnightPayoff: 25
    },

    // Advisory limits. These only drive warnings, never the math.
    limits: {
      // FHFA 2026 baseline one-unit conforming limit (FHFA release, 2025-11-25).
      conformingLoan: 832750,
      // 2026 FHA one-unit floor, which applies in Allegheny County (confirm on HUD's lookup).
      fhaLoan: 541287,
      // Max seller contribution as a share of price (from the spreadsheet's notes).
      sellerAssist: { conventionalHighLtv: 0.03, conventionalLowLtv: 0.06, conventionalLtvBreak: 0.90, F: 0.06, V: 0.04 }
    }
  };
});
