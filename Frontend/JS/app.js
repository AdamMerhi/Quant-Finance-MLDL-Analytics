// Entry point: wires the DOM to the Investment classes and the chart.
// Notice the calculator never checks WHICH investment is selected —
// it just calls .project() and lets polymorphism do the work.

import { IndexFund, Super, SavingsAccount } from "./Investment.js";
import { GrowthChart } from "./Chart.js";

class CalculatorApp {
  constructor() {
    this.investments = [new IndexFund(), new Super(), new SavingsAccount()];
    this.selected = this.investments[0];
    this.liquidityInput = document.getElementById("liquidity-input");
    this.yearsInput = document.getElementById("years-input");
    this.yearsOutput = document.getElementById("years-output");
    this.optionsGrid = document.getElementById("investment-options");
    this.summary = document.getElementById("result-summary");
    this.chart = new GrowthChart(document.getElementById("growth-chart"));
  }

  start() {
    this.renderOptions();
    this.liquidityInput.addEventListener("input", () => this.update());
    this.yearsInput.addEventListener("input", () => this.update());
    this.update();
  }

  // Build one clickable card per investment type.
  renderOptions() {
    this.investments.forEach((investment) => {
      const card = document.createElement("button");
      card.className = "option-card";
      card.innerHTML = `<strong>${investment.name}</strong>
        <span class="option-rate">${investment.rateLabel()}</span>
        <span class="option-desc">${investment.description}</span>`;
      card.addEventListener("click", () => this.select(investment, card));
      this.optionsGrid.appendChild(card);
    });
    this.optionsGrid.firstChild.classList.add("selected");
  }

  select(investment, card) {
    this.selected = investment;
    this.optionsGrid.querySelectorAll(".option-card")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    this.update();
  }

  // Recalculate and redraw everything from current inputs.
  update() {
    const principal = Number(this.liquidityInput.value) || 0;
    const years = Number(this.yearsInput.value);
    this.yearsOutput.textContent = `${years} year${years > 1 ? "s" : ""}`;
    const balances = this.selected.project(principal, years);
    this.renderSummary(principal, balances);
    this.chart.draw(balances);
  }

  renderSummary(principal, balances) {
    const final = balances[balances.length - 1];
    const gain = final - principal;
    this.summary.innerHTML = `
      <p class="final-amount">${this.money(final)}</p>
      <p class="gain">+${this.money(gain)} interest earned</p>
      <p class="detail">${this.selected.name} · starting with ${this.money(principal)}</p>`;
  }

  money(value) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

new CalculatorApp().start();
