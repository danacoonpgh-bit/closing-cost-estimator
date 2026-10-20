/*
 * LOCAL DATA - lookups that help an agent fill in the form faster. Nothing here does math.
 * The agent can always override what these suggest. Like rates.js, every table needs
 * sign-off before the sheets lose their DRAFT banner.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CostSheetLocal = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var H = 0.5;
  return {
    // 30-year fixed average, Freddie Mac Primary Mortgage Market Survey (published Thursdays).
    // Checked 2026-10-11 against freddiemac.com/pmms and FRED series MORTGAGE30US.
    // This number goes stale every week. The form stops pre-filling it once it is over 14 days old.
    market: { rate30: 7.40, asOf: "2026-10-08", source: "Freddie Mac" },

    // Offices shown in the "Office" dropdown and printed on the sheet.
    offices: [
      { no: 2640, name: "North Hills" },
      { no: 2643, name: "Airport" },
      { no: 2648, name: "Fox Chapel" },
      { no: 2665, name: "Cranberry" },
      { no: 2669, name: "North Huntingdon" },
      { no: 2673, name: "East Regional" },
      { no: 2677, name: "City Center" },
      { no: 2671, name: "South Regional" }
    ],

    // PLACEHOLDER homeowners insurance tiers, until the office's insurance agency supplies a real table.
    // Anchor: NerdWallet, "The Best Home Insurance in Pennsylvania" (updated 2026-03-13, rates from
    // Quadrant Information Services): Pennsylvania average of $2,045 a year for a sample policy with
    // $500,000 of dwelling coverage, $1,000 deductible, good credit, no recent claims.
    // The form scales that in a straight line by sales price and rounds to the nearest $25.
    // Two known weaknesses: sales price is not the same as dwelling coverage, and real premiums
    // don't scale in a perfectly straight line.
    insurance: {
      anchorPremium: 2045,
      anchorCoverage: 500000,
      source: "NerdWallet, Quadrant data, March 2026",
      bands: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1250000, 1500000]
    },

    // Local realty transfer tax, Allegheny County only. Source: Allegheny County "Local Tax Rates"
    // page (alleghenycounty.us, Realty Transfer Taxes), read 2026-10-11. The page shows no
    // effective date. Each row: [municipality, school district, municipal %, school district %].
    // The Commonwealth's 1% is added on top (stateTransferTax).
    // Five names are spelled the standard way where the county page has a typo or short form:
    // Green Tree, McKees Rocks, Jefferson Hills, Pennsbury Village, Sewickley Heights.
    stateTransferTax: 1,
    transferTaxCounty: "Allegheny",
    municipalities: [
      ["Aleppo Twp", "Quaker Valley", H, H], ["Aspinwall Boro", "Fox Chapel Area", H, H], ["Avalon Boro", "Northgate", H, H],
      ["Baldwin Boro", "Baldwin-Whitehall", H, H], ["Baldwin Twp", "Baldwin-Whitehall", H, H], ["Bell Acres Boro", "Quaker Valley", H, H],
      ["Bellevue Boro", "Northgate", 1, H], ["Ben Avon Boro", "Avonworth", H, H], ["Ben Avon Heights Boro", "Avonworth", H, H],
      ["Bethel Park Municipality", "Bethel Park", 1, H], ["Blawnox Boro", "Fox Chapel Area", H, H], ["Brackenridge Boro", "Highland", H, H],
      ["Braddock Boro", "Woodland Hills", H, H], ["Braddock Hills Boro", "Woodland Hills", H, H], ["Bradford Woods Boro", "North Allegheny", H, H],
      ["Brentwood Boro", "Brentwood", H, H], ["Bridgeville Boro", "Chartiers Valley", H, H], ["Carnegie Boro", "Carlynton", H, H],
      ["Castle Shannon Boro", "Keystone Oaks", H, H], ["Chalfant Boro", "Woodland Hills", H, H], ["Cheswick Boro", "Allegheny Valley", H, H],
      ["Churchill Boro", "Woodland Hills", H, H], ["Clairton City", "Clairton", H, H], ["Collier Twp", "Chartiers Valley", H, H],
      ["Coraopolis Boro", "Cornell", H, H], ["Crafton Boro", "Carlynton", H, H], ["Crescent Twp", "Moon Area", H, H],
      ["Dormont Boro", "Keystone Oaks", H, H], ["Dravosburg Boro", "McKeesport Area", H, H], ["Duquesne City", "Duquesne", H, H],
      ["East Deer Twp", "Deer Lakes", H, H], ["East McKeesport Boro", "East Allegheny", H, H], ["East Pittsburgh Boro", "Woodland Hills", H, H],
      ["Edgewood Boro", "Woodland Hills", H, H], ["Edgeworth Boro", "Quaker Valley", H, H], ["Elizabeth Boro", "Elizabeth-Forward", H, H],
      ["Elizabeth Twp", "Elizabeth-Forward", H, H], ["Emsworth Boro", "Avonworth", H, H], ["Etna Boro", "Shaler Area", H, H],
      ["Fawn Twp", "Highland", H, H], ["Findlay Twp", "West Allegheny", H, H], ["Forest Hills Boro", "Woodland Hills", H, H],
      ["Forward Twp", "Elizabeth-Forward", H, H], ["Fox Chapel Boro", "Fox Chapel Area", H, H], ["Franklin Park Boro", "North Allegheny", H, H],
      ["Frazer Twp", "Deer Lakes", H, H], ["Glassport Boro", "South Allegheny", H, H], ["Glen Osborne Boro", "Quaker Valley", H, H],
      ["Glenfield Boro", "Quaker Valley", H, H], ["Green Tree Boro", "Keystone Oaks", 1, H], ["Hampton Twp", "Hampton Twp", 1, H],
      ["Harmar Twp", "Allegheny Valley", H, H], ["Harrison Twp", "Highland", H, H], ["Haysville Boro", "Quaker Valley", H, H],
      ["Heidelberg Boro", "Chartiers Valley", H, H], ["Homestead Boro", "Steel Valley", H, H], ["Indiana Twp", "Fox Chapel Area", H, H],
      ["Ingram Boro", "Montour", H, H], ["Jefferson Hills Boro", "West Jefferson Hills", H, H], ["Kennedy Twp", "Montour", H, H],
      ["Kilbuck Twp", "Avonworth", H, H], ["Leet Twp", "Quaker Valley", H, H], ["Leetsdale Boro", "Quaker Valley", H, H],
      ["Liberty Boro", "South Allegheny", H, H], ["Lincoln Boro", "South Allegheny", H, H], ["Marshall Twp", "North Allegheny", H, H],
      ["McCandless Twp", "North Allegheny", 1, H], ["McDonald Boro", "Fort Cherry", H, H], ["McKees Rocks Boro", "Sto-Rox", H, H],
      ["McKeesport City", "McKeesport Area", 1.5, H], ["Millvale Boro", "Shaler Area", H, H], ["Monroeville Municipality", "Gateway", 1, H],
      ["Moon Twp", "Moon Area", H, H], ["Mt. Lebanon Municipality", "Mt. Lebanon", 1, H], ["Mt. Oliver Boro", "Pittsburgh", 1, 1],
      ["Munhall Boro", "Steel Valley", H, H], ["Neville Twp", "Cornell", H, H], ["North Braddock Boro", "Woodland Hills", H, H],
      ["North Fayette Twp", "West Allegheny", H, H], ["North Versailles Twp", "East Allegheny", H, H], ["Oakdale Boro", "West Allegheny", H, H],
      ["Oakmont Boro", "Riverview", H, H], ["O'Hara Twp", "Fox Chapel Area", 1, H], ["Ohio Twp", "Avonworth", H, H],
      ["Penn Hills Municipality", "Penn Hills", 1.5, H], ["Pennsbury Village Boro", "Montour", H, H], ["Pine Twp", "Pine-Richland", 1, H],
      ["Pitcairn Boro", "Gateway", H, H], ["Pittsburgh (City)", "Pittsburgh", 3, 1], ["Pittsburgh (Baldwin-Whitehall school district part)", "Baldwin-Whitehall", 3, H],
      ["Pleasant Hills Boro", "West Jefferson Hills", H, H], ["Plum Boro", "Plum", H, H], ["Port Vue Boro", "South Allegheny", H, H],
      ["Rankin Boro", "Woodland Hills", H, H], ["Reserve Twp", "Shaler Area", H, H], ["Richland Twp", "Pine-Richland", H, H],
      ["Robinson Twp", "Montour", H, H], ["Ross Twp", "North Hills", H, H], ["Rosslyn Farms Boro", "Carlynton", H, H],
      ["Scott Twp", "Chartiers Valley", H, H], ["Sewickley Boro", "Quaker Valley", H, H], ["Sewickley Heights Boro", "Quaker Valley", H, H],
      ["Sewickley Hills Boro", "Quaker Valley", H, H], ["Shaler Twp", "Shaler Area", H, H], ["Sharpsburg Boro", "Fox Chapel Area", H, H],
      ["South Fayette Twp", "South Fayette", H, H], ["South Park Twp", "South Park", H, H], ["South Versailles Twp", "McKeesport Area", H, H],
      ["Springdale Boro", "Allegheny Valley", H, H], ["Springdale Twp", "Allegheny Valley", H, H], ["Stowe Twp", "Sto-Rox", H, H],
      ["Swissvale Boro", "Woodland Hills", H, H], ["Tarentum Boro", "Highland", H, H], ["Thornburg Boro", "Montour", H, H],
      ["Trafford Boro", "no school tax", 1, 0], ["Turtle Creek Boro", "Woodland Hills", H, H], ["Upper St. Clair Twp", "Upper St. Clair", 1, H],
      ["Verona Boro", "Riverview", H, H], ["Versailles Boro", "McKeesport Area", H, H], ["Wall Boro", "East Allegheny", H, H],
      ["West Deer Twp", "Deer Lakes", 1, H], ["West Elizabeth Boro", "West Jefferson Hills", H, H], ["West Homestead Boro", "Steel Valley", H, H],
      ["West Mifflin Boro", "West Mifflin", H, H], ["West View Boro", "North Hills", H, H], ["Whitaker Boro", "West Mifflin", H, H],
      ["White Oak Boro", "McKeesport Area", H, H], ["Whitehall Boro", "Baldwin-Whitehall", 1, H], ["Wilkins Twp", "Woodland Hills", H, H],
      ["Wilkinsburg Boro", "Wilkinsburg", H, H], ["Wilmerding Boro", "East Allegheny", H, H]
    ],

    // Assurant Home Warranty, Pennsylvania pricing sheet CL75236-PA-0426 (sent by Kit Speanburg,
    // 2026-09-01). Homes under 5,000 sq. ft. Prices are before applicable tax.
    warranty: {
      company: "Assurant",
      sheet: "Assurant PA pricing sheet, April 2026",
      sellerListingCoverage: 60, // optional add-on while the home is listed; existing homes only
      plans: [
        { id: "sfh-essential", label: "Essential, single-family home", price: 540, existing: true },
        { id: "sfh-enhanced", label: "Enhanced, single-family home", price: 700, existing: true },
        { id: "sfh-premium", label: "Premium, single-family home", price: 900, existing: true },
        { id: "condo-essential", label: "Essential, condo / townhome / mobile home", price: 440, existing: true },
        { id: "condo-enhanced", label: "Enhanced, condo / townhome / mobile home", price: 560, existing: true },
        { id: "condo-premium", label: "Premium, condo / townhome / mobile home", price: 720, existing: true },
        { id: "new-sfh-essential", label: "Essential, new construction single-family (5 years)", price: 820, existing: false },
        { id: "new-sfh-enhanced", label: "Enhanced, new construction single-family (5 years)", price: 1060, existing: false },
        { id: "new-sfh-premium", label: "Premium, new construction single-family (5 years)", price: 1360, existing: false },
        { id: "new-condo-essential", label: "Essential, new construction condo / townhome (5 years)", price: 640, existing: false },
        { id: "new-condo-enhanced", label: "Enhanced, new construction condo / townhome (5 years)", price: 840, existing: false },
        { id: "new-condo-premium", label: "Premium, new construction condo / townhome (5 years)", price: 1080, existing: false }
      ]
    }
  };
});
