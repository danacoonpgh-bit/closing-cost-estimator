/*
 * CALCULATION ENGINE - pure functions, no page access.
 * calculate(input, rates) returns every number on the Buyer Cost Sheet and Seller Net Sheet.
 *
 * opts.legacy = true reproduces the original spreadsheet exactly, including its known
 * errors. It exists only so tests can prove the engine matches the spreadsheet; the app
 * never turns it on. Each legacy branch below marks one deliberate correction.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CostSheetEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function payment(annualRatePct, years, principal, rateIsFraction) {
    var r = (rateIsFraction ? annualRatePct : annualRatePct / 100) / 12;
    var n = years * 12;
    if (!principal || !n) return 0;
    if (!r) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  function titlePremium(price, t, legacy) {
    // Correction: the manual prices each $1,000 "or fraction thereof"; the spreadsheet prorated to the dollar.
    var amount = legacy ? price : Math.ceil(price / 1000) * 1000;
    var premium = t.saleRateBase;
    var floor = t.saleRateBaseLimit;
    for (var i = 0; i < t.saleRateBrackets.length && amount > floor; i++) {
      var b = t.saleRateBrackets[i];
      var top = Math.min(amount, b.upTo);
      premium += ((top - floor) / 1000) * b.perThousand;
      floor = b.upTo;
    }
    // Correction: above $30M the spreadsheet restarted the last bracket at $7M and overcharged.
    if (legacy && price > 30000000) premium = (price - 7000000) * 0.00142 + 59735;
    return premium * t.enhancedMultiplier;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function pmiAnnualRate(ltv, tiers) {
    if (ltv > 1) return 0;
    for (var i = 0; i < tiers.length; i++) if (ltv > tiers[i].ltvAbove) return tiers[i].annualRate;
    return 0;
  }

  function maxSellerAssist(type, price, ltv, lim) {
    if (type === "C") return price * (ltv > lim.conventionalLtvBreak ? lim.conventionalHighLtv : lim.conventionalLowLtv);
    if (type === "F") return price * lim.F;
    if (type === "V") return price * lim.V;
    return null;
  }

  function calculate(input, rates, opts) {
    var legacy = !!(opts && opts.legacy);
    var type = input.loanType || "";
    var price = num(input.price);
    var isCash = type === "CASH";
    var lf = rates.lenderFees, t = rates.title, s = rates.seller;
    var fee = function (table) { return type in table ? table[type] : 0; };

    // ----- Loan -----
    var loanConv = type === "C" ? num(input.loanAmount) : 0;
    var loanGov = type === "F" ? price * rates.fha.loanToValue * (1 + rates.fha.upfrontPremium)
                : type === "V" ? price * (1 + rates.va.fundingFee) : 0;
    var loan = loanConv + loanGov;
    var ltv = price > 0 ? loanConv / price : 0;
    var secondLoan = num(input.secondLoan);
    var assist = num(input.assist);

    // ----- Buyer closing costs -----
    var transferTotal = price * num(input.transferTaxPct) / 100;
    var transferBuyer = transferTotal * rates.transferTax.buyerShare;
    var closing = [
      ["Points", num(input.points) / 100 * loan],
      ["Appraisal Fee", fee(lf.appraisal)],
      ["Credit Report", fee(lf.creditReport)],
      ["Lender Fees", fee(lf.lenderFees)],
      ["Application Fee", fee(lf.application)],
      ["Settlement Fee (by Title Company)", fee(t.settlementFee)],
      ["Electronic Doc / Doc Prep (by Title Co.)", t.docPrep],
      ["Enhanced Title Policy (by Title Co.)", price > 0 ? titlePremium(price, t, legacy) : 0],
      ["Title Endorsements (by Title Co.)", t.endorsements],
      ["Recording Fees (by Title Company)", rates.recordingFees[input.countyGroup] || 0],
      ["Home Inspection (optional)", num(input.homeInspection)],
      ["Radon (optional)", num(input.radon)],
      ["Pest Inspection (optional)", type === "V" ? 0 : num(input.pest)],
      ["Transfer Tax", transferBuyer],
      ["Well and Septic", num(input.wellSeptic)],
      ["Survey (optional)", num(input.survey)],
      ["Courier / Wire (by Title Company)", t.courierWire],
      ["Flood Certification", fee(lf.floodCert)],
      ["Home Warranty (optional)", num(input.warrantyBuyer)],
      ["Notary Fee (if using CB Settlement)", t.notary],
      ["Coldwell Banker Additional Commission - Buyer", num(input.cbFeeBuyer)],
      ["Buyer Paid Agent Commission", num(input.buyerPaidCommission)],
      ["Closing Protection (by Title Company)", t.closingProtection]
    ];
    var closingTotal = closing.reduce(function (a, r) { return a + r[1]; }, 0);

    // ----- Monthly payment -----
    // Correction: the spreadsheet picked the PMI tier from the loan-amount box even on FHA and VA
    // loans, so a leftover number there added conventional PMI on top of the government premium.
    var pmiLtv = legacy && price > 0 ? num(input.loanAmount) / price : type === "C" ? ltv : 0;
    var pmiMonthly = pmiAnnualRate(pmiLtv, rates.pmi) * loan / 12;
    var monthly = {
      principalInterest: isCash ? 0 : payment(num(input.rate), num(input.termYears), loan),
      // Correction: the spreadsheet did not convert the 2nd mortgage rate from a percent.
      secondPrincipalInterest: payment(num(input.secondRate), num(input.secondTermYears), secondLoan, legacy),
      taxes: isCash ? 0 : num(input.annualTaxes) / 12,
      insurance: isCash ? 0 : num(input.annualInsurance) / 12,
      pmi: pmiMonthly,
      fhaMip: type === "F" ? loan * rates.fha.annualPremium / 12 : 0,
      condoFee: num(input.condoFee)
    };
    monthly.total = monthly.principalInterest + monthly.secondPrincipalInterest + monthly.taxes +
      monthly.insurance + monthly.pmi + monthly.fhaMip + monthly.condoFee;

    // ----- Prepaid items -----
    var d = input.settlementDate || null; // { year, month (1-12), day }
    var perDiem = num(input.rate) / 100 * loan / 12 / 30;
    // Correction: the spreadsheet used 31 minus the day for every month.
    var interestDays = !d ? 0 : legacy ? 31 - d.day : daysInMonth(d.year, d.month) - d.day + 1;
    var fhaBase = Math.floor(price * rates.fha.loanToValue / rates.fha.baseRoundTo) * rates.fha.baseRoundTo;
    var prepaid = {
      taxMonths: num(input.taxMonths),
      taxes: num(input.annualTaxes) / 12 * num(input.taxMonths),
      insuranceMonths: rates.insurancePrepaidMonths,
      insurance: isCash ? 0 : num(input.annualInsurance) / 12 * rates.insurancePrepaidMonths,
      govPremium: type === "F" ? fhaBase * rates.fha.upfrontPremium : type === "V" ? price * rates.va.fundingFee : 0,
      pmiEscrowMonths: rates.pmiEscrowMonths,
      pmiEscrow: pmiMonthly * rates.pmiEscrowMonths,
      interestDays: interestDays,
      perDiem: perDiem,
      interest: perDiem * interestDays
    };
    prepaid.total = prepaid.taxes + prepaid.insurance + prepaid.govPremium + prepaid.pmiEscrow + prepaid.interest;

    // ----- Cash needed -----
    var subTotal = price + closingTotal + prepaid.total;
    var credits = {
      handMoney: num(input.handMoney),
      relocation: num(input.relocation),
      secondLoan: secondLoan,
      sellerAssist: assist,
      loanConventional: loanConv,
      loanGov: loanGov
    };
    credits.total = credits.handMoney + credits.relocation + credits.secondLoan + credits.sellerAssist + loanConv + loanGov;
    var rawCash = subTotal - credits.total;
    // Correction: the spreadsheet could print a negative cash-needed figure.
    var cashNeeded = legacy ? rawCash : Math.max(0, rawCash);

    // ----- Seller -----
    var commission = input.commissionType === "flat" ? num(input.commissionValue) : num(input.commissionValue) / 100 * price;
    var hasPayoff = !legacy && input.mortgagePayoff !== null && input.mortgagePayoff !== undefined && input.mortgagePayoff !== "";
    // The app has one additional-commission spot (Coldwell Banker). The spreadsheet's second line is kept only in legacy mode.
    var expenses = [
      ["Seller's Share of Transfer Tax", transferTotal - transferBuyer],
      ["Settlement Fee", s.settlementFee],
      ["Processing Fee", s.processingFee],
      ["New Deed & Notary Fee", s.deedAndNotary],
      ["Realtor Commission (per listing agreement)", commission],
      ["Closing Cost Assistance", assist],
      ["Proration of Current Year Property Taxes", null],
      ["Proration of Current Water / Sewer Bills", null],
      ["Dye Test and Certification (if needed)", s.dyeTest],
      ["Resale Certificate (if needed)", s.resaleCertificate],
      ["Municipal Letters / Tax Certifications", legacy ? 0 : num(input.municipalLetters)],
      ["Home Warranty", num(input.warrantySeller)],
      ["Coldwell Banker Additional Commission - Seller", num(input.cbFeeSeller)],
      ["Overnight per Payoff", s.overnightPayoff]
    ].concat(legacy ? [["Additional Seller Commission (if any)", num(input.addlSellerCommission)]] : []);
    var expenseTotal = expenses.reduce(function (a, r) { return a + (r[1] || 0); }, 0);
    var balance = price - expenseTotal;
    var payoff = hasPayoff ? num(input.mortgagePayoff) : 0;

    return {
      loanType: type,
      loan: loan,
      ltv: ltv,
      buyer: {
        price: price,
        closing: closing,
        closingTotal: closingTotal,
        prepaid: prepaid,
        subTotal: subTotal,
        credits: credits,
        rawCashNeeded: rawCash,
        cashNeeded: cashNeeded,
        monthly: monthly
      },
      seller: {
        price: price,
        expenses: expenses,
        expenseTotal: expenseTotal,
        balance: balance,
        hasPayoff: hasPayoff,
        payoff: payoff,
        net: balance - payoff
      },
      maxSellerAssist: maxSellerAssist(type, price, ltv, rates.limits.sellerAssist)
    };
  }

  return { calculate: calculate, payment: payment, titlePremium: titlePremium };
});
