// Base class for all investment types the backend can project.
// Mirrors Frontend/JS/Investment.js: subclasses supply monthlyReturns(),
// this base handles the compounding — that's the polymorphism.

export class Investment {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  // Array of monthly returns (e.g. 0.01 = +1%). Subclasses MUST implement.
  monthlyReturns() {
    throw new Error(`${this.name} must implement monthlyReturns()`);
  }

  // One month of compound growth. Kept small so it stays easy to test.
  applyReturn(balance, rate) {
    return balance * (1 + rate);
  }

  // Compounds `principal` month by month using monthlyReturns().
  // Returns balances[0..N]: index 0 = starting principal, index N = after
  // N months (N = monthlyReturns().length).
  project(principal) {
    const returns = this.monthlyReturns();
    const balances = [principal];
    let balance = principal;
    for (let month = 0; month < returns.length; month++) {
      balance = this.applyReturn(balance, returns[month]);
      balances.push(balance);
    }
    return balances;
  }
}
