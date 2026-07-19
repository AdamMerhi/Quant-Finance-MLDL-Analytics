// Thin fund subclasses — each just names itself; MarketInvestment does the work.
// Keep these tiny: adding a fund is a 5-line class + one factory case.

import { MarketInvestment } from "./MarketInvestment.js";

export class Voo extends MarketInvestment {
  constructor(monthEndCloses) {
    super("VOO", "Vanguard S&P 500 ETF", monthEndCloses);
  }
}

export class Sp500 extends MarketInvestment {
  constructor(monthEndCloses) {
    super("S&P 500", "iShares Core S&P 500 ETF (IVV)", monthEndCloses);
  }
}

export class Nasdaq extends MarketInvestment {
  constructor(monthEndCloses) {
    super("Nasdaq", "Nasdaq Composite Index", monthEndCloses);
  }
}

const FUND_CLASSES = {
  voo: Voo,
  sp500: Sp500,
  nasdaq: Nasdaq,
};

// Factory: callers depend only on the base Investment type after this,
// never on which fund class they got back.
export function createFund(fundKey, monthEndCloses) {
  const FundClass = FUND_CLASSES[fundKey];
  if (!FundClass) {
    throw new Error(`Unknown fund "${fundKey}"`);
  }
  return new FundClass(monthEndCloses);
}
