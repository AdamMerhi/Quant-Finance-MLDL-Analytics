// Base class for all investment types.
// Subclasses override rateForYear() — that is the polymorphism:
// the calculator only ever talks to "an Investment", never a specific type.

// Where the backend API lives. Only MarketFund subclasses call this.
const API_BASE = "http://localhost:8080";

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

  // The time unit of one projectSeries() step, for chart axis labeling.
  // Yearly synthetic projections vs. MarketFund's monthly real data below.
  chartUnit() {
    return "yrs";
  }

  // Async wrapper so the app can treat every investment the same way,
  // whether its projection comes from local math (this default) or a
  // network call (MarketFund overrides this below).
  async projectSeries(principal, years) {
    return this.project(principal, years);
  }
}

// Base for investments whose projection comes from the backend API, which
// reads real historical closes out of Cloudflare R2. Subclasses just set a
// fundKey used by the API's fund->ticker mapping (datasets.config.json).
export class MarketFund extends Investment {
  constructor(name, description, fundKey) {
    super(name, description);
    this.fundKey = fundKey;
  }

  // MarketFund gets its rate from the API, not a static number — until the
  // first projectSeries() call resolves, show a neutral placeholder label.
  rateForYear(year) {
    return 0;
  }

  rateLabel() {
    return "live market data";
  }

  chartUnit() {
    return "mo";
  }

  async projectSeries(principal, years) {
    const url = `${API_BASE}/api/investment/projection?fund=${this.fundKey}&liquidity=${principal}&years=${years}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Projection request failed for ${this.name} (${response.status})`);
    }
    const data = await response.json();
    return data.balances;
  }
}

// Vanguard S&P 500 ETF — real historical returns via the backend API.
export class Voo extends MarketFund {
  constructor() {
    super("VOO", "Vanguard S&P 500 ETF, real historical returns", "voo");
  }
}

// iShares Core S&P 500 ETF — real historical returns via the backend API.
export class Sp500 extends MarketFund {
  constructor() {
    super("S&P 500", "iShares Core S&P 500 ETF, real historical returns", "sp500");
  }
}

// Nasdaq Composite Index — real historical returns via the backend API.
export class Nasdaq extends MarketFund {
  constructor() {
    super("Nasdaq", "Nasdaq Composite Index, real historical returns", "nasdaq");
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
