// Base class for all investment types.
// Subclasses override rateForYear() — that is the polymorphism:
// the calculator only ever talks to "an Investment", never a specific type.

export class Investment {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  // Annual return for a given year (0-based). Subclasses MUST override this.
  rateForYear(year) {
    throw new Error(`${this.name} must implement rateForYear()`);
  }

  // Compound the principal year by year using rateForYear().
  // Returns an array of balances: index 0 = start, index N = after N years.
  project(principal, years) {
    const balances = [principal];
    let balance = principal;
    for (let year = 0; year < years; year++) {
      balance = this.applyInterest(balance, this.rateForYear(year));
      balances.push(balance);
    }
    return balances;
  }

  // One year of compound growth. Kept small so it is easy to test later.
  applyInterest(balance, rate) {
    return balance * (1 + rate);
  }

  // Human-readable label for the UI, e.g. "10% p.a."
  rateLabel() {
    return `${(this.rateForYear(0) * 100).toFixed(1)}% p.a.`;
  }
}

// US index funds (VTI / S&P 500 / Nasdaq) — static 10% average return.
export class IndexFund extends Investment {
  constructor() {
    super("VTI / S&P 500 / Nasdaq", "US index funds, historical average");
    this.staticRate = 0.10; // TODO: replace with live data from the DAG
  }

  rateForYear(year) {
    return this.staticRate;
  }
}

// Superannuation — varies year to year between 2% and 14%.
// Hard-coded cycle for now; the DAG will supply real yearly returns later.
export class Super extends Investment {
  constructor() {
    super("Super", "Superannuation, varies yearly");
    this.yearlyRates = [0.08, 0.14, 0.02, 0.11, 0.05, 0.13, 0.03, 0.09]; // TODO: from DAG
  }

  rateForYear(year) {
    return this.yearlyRates[year % this.yearlyRates.length];
  }

  rateLabel() {
    return "2–14% p.a. (varies)";
  }
}

// Savings account — fixed 4.5% per annum.
export class SavingsAccount extends Investment {
  constructor() {
    super("Savings Account", "Bank savings, fixed rate");
    this.staticRate = 0.045; // TODO: replace with live rate from the DAG
  }

  rateForYear(year) {
    return this.staticRate;
  }
}
