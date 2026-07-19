// An Investment backed by real month-end close prices. Subclasses (funds.js)
// just set name/description — this class does the actual math.

import { Investment } from "./Investment.js";

export class MarketInvestment extends Investment {
  constructor(name, description, monthEndCloses) {
    super(name, description);
    this.monthEndCloses = monthEndCloses; // oldest -> newest, length = months + 1
  }

  // Percent change between consecutive month-end closes.
  // length = monthEndCloses.length - 1 (one return per month transition).
  monthlyReturns() {
    const closes = this.monthEndCloses;
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(closes[i] / closes[i - 1] - 1);
    }
    return returns;
  }
}
