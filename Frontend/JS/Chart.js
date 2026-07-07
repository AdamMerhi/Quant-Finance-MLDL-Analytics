// Minimal canvas line chart. One job: draw balances over years.
// No library needed — keeps the frontend dependency-free.

export class GrowthChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.padding = 48;
  }

  // Public entry point: draw a line of yearly balances.
  draw(balances) {
    this.clear();
    const max = Math.max(...balances);
    this.drawAxes(balances.length - 1, max);
    this.drawLine(balances, max);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Map a (year, balance) data point to canvas x/y pixels.
  toPoint(index, value, count, max) {
    const w = this.canvas.width - this.padding * 2;
    const h = this.canvas.height - this.padding * 2;
    const x = this.padding + (index / count) * w;
    const y = this.canvas.height - this.padding - (value / max) * h;
    return { x, y };
  }

  drawAxes(years, max) {
    const { ctx, padding, canvas } = this;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px sans-serif";
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    ctx.fillText(`$${Math.round(max).toLocaleString()}`, 4, padding + 4);
    ctx.fillText("$0", 4, canvas.height - padding);
    ctx.fillText("0", padding, canvas.height - padding + 16);
    ctx.fillText(`${years} yrs`, canvas.width - padding - 24, canvas.height - padding + 16);
  }

  drawLine(balances, max) {
    const { ctx } = this;
    const count = balances.length - 1;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    balances.forEach((value, i) => {
      const { x, y } = this.toPoint(i, value, count, max);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}
