// Validates the projection request, resolves the fund's ticker, pulls its
// month-end closes from the repository, and runs the compounding via the
// polymorphic Investment.project(). No SQL/math here — just wiring.

import { resolveTicker, listFunds } from "../config/datasets.js";
import { createFund } from "../investment-calculations/funds.js";

const DATASET_KEY = "us_exchange_market_prices";
const MIN_YEARS = 1;
const MAX_YEARS = 40;

export class InvestmentController {
  constructor(marketDataRepository) {
    this.repository = marketDataRepository;
  }

  // Throws a ValidationError-shaped object ({ statusCode, message }) on bad input.
  parseQuery(query) {
    const fund = query.fund;
    if (!listFunds(DATASET_KEY).includes(fund)) {
      throw { statusCode: 400, message: `fund must be one of: ${listFunds(DATASET_KEY).join(", ")}` };
    }

    const liquidity = Number(query.liquidity);
    if (!Number.isFinite(liquidity) || liquidity < 0) {
      throw { statusCode: 400, message: "liquidity must be a number >= 0" };
    }

    const years = Number(query.years);
    if (!Number.isInteger(years) || years < MIN_YEARS || years > MAX_YEARS) {
      throw { statusCode: 400, message: `years must be an integer between ${MIN_YEARS} and ${MAX_YEARS}` };
    }

    return { fund, liquidity, years };
  }

  async getProjection(query) {
    const { fund, liquidity, years } = this.parseQuery(query);

    const ticker = resolveTicker(DATASET_KEY, fund);
    const { closes, labels } = await this.repository.getMonthEndCloses(ticker, years * 12);

    const investment = createFund(fund, closes);
    const balances = investment.project(liquidity);

    const finalValue = balances[balances.length - 1];
    const gain = finalValue - liquidity;
    const totalReturnPct = liquidity > 0 ? (gain / liquidity) * 100 : 0;

    return {
      fund,
      ticker,
      liquidity,
      months: balances.length - 1,
      labels,
      balances,
      finalValue,
      gain,
      totalReturnPct,
    };
  }
}
