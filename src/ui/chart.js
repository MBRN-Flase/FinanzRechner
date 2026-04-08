import { formatCurrency, formatCurrencyShort, formatNum } from '../core/formatters.js';

function drawChart(canvas, data) {
  if (!canvas || !canvas.getContext || !Array.isArray(data) || data.length === 0) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement?.clientWidth || 300;
  const height = 200;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const padLeft = 18;
  const padRight = 22;
  const padTop = 18;
  const padBottom = 26;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const maxValue = Math.max(...data.map((point) => point.invest), 1);

  const xFor = (index) => padLeft + (index / Math.max(data.length - 1, 1)) * chartWidth;
  const yFor = (value) => padTop + chartHeight - (value / maxValue) * chartHeight;

  ctx.strokeStyle = 'rgba(100,70,200,.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartWidth, y);
    ctx.stroke();
  }

  [100000, 500000, 1000000, 5000000].forEach((milestone) => {
    if (milestone > maxValue * 1.1) return;
    const y = yFor(milestone);
    ctx.strokeStyle = 'rgba(179,136,255,.12)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(179,136,255,.4)';
    ctx.font = '8px Space Mono,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrencyShort(milestone), padLeft + chartWidth, y - 2);
  });

  ctx.beginPath();
  data.forEach((point, index) => {
    if (index === 0) ctx.moveTo(xFor(index), yFor(point.fiat));
    else ctx.lineTo(xFor(index), yFor(point.fiat));
  });
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,107,107,.52)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartHeight);
  gradient.addColorStop(0, 'rgba(179,136,255,.26)');
  gradient.addColorStop(1, 'rgba(179,136,255,.02)');
  ctx.beginPath();
  data.forEach((point, index) => {
    if (index === 0) ctx.moveTo(xFor(index), yFor(point.invest));
    else ctx.lineTo(xFor(index), yFor(point.invest));
  });
  ctx.lineTo(xFor(data.length - 1), padTop + chartHeight);
  ctx.lineTo(xFor(0), padTop + chartHeight);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  data.forEach((point, index) => {
    if (index === 0) ctx.moveTo(xFor(index), yFor(point.invest));
    else ctx.lineTo(xFor(index), yFor(point.invest));
  });
  ctx.strokeStyle = 'rgba(179,136,255,.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const last = data[data.length - 1];
  if (last) {
    ctx.fillStyle = 'rgba(179,136,255,.85)';
    ctx.font = '700 9px Space Mono,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrencyShort(last.invest), padLeft + chartWidth, yFor(last.invest) - 4);
  }
}

function fillYearTable(result, tbody) {
  if (!tbody || !result?.chartData) return;

  const milestones = [100000, 250000, 500000, 1000000, 5000000];
  const passedMilestones = {};
  tbody.innerHTML = result.chartData.map((point) => {
    const gain = point.invest - point.total;
    let isMilestone = false;
    milestones.forEach((milestone) => {
      if (point.invest >= milestone && !passedMilestones[milestone]) {
        passedMilestones[milestone] = true;
        isMilestone = true;
      }
    });

    return `<tr class="${isMilestone ? 'milestone-row' : ''}">
      <td>${point.year}</td>
      <td>${result.ageStart + point.year}</td>
      <td>${formatCurrencyShort(point.total)}</td>
      <td class="col-invest">${formatCurrencyShort(point.invest)}</td>
      <td>${formatCurrencyShort(point.fiat)}</td>
      <td class="col-gain">${gain > 0 ? '+' : ''}${formatCurrencyShort(gain)}</td>
    </tr>`;
  }).join('');
}

function renderContextBox(value, contextGrid) {
  if (!contextGrid) return;
  const items = [
    { emoji: '💰', label: 'Jahresgehälter (DE)', val: Math.round((value / 45000) * 10) / 10, price: 45000 },
    { emoji: '🏠', label: 'Jahre Miete (ø DE)', val: Math.round((value / 12000) * 10) / 10, price: 12000 },
    { emoji: '🚗', label: 'Durchschnittliche Neuwagen', val: Math.round(value / 35000), price: 35000 },
    { emoji: '✈️', label: 'Weltreisen (ca. 5.000€)', val: Math.round(value / 5000), price: 5000 },
  ];

  contextGrid.innerHTML = items.map((item) => `
    <div class="context-item">
      <span class="context-emoji">${item.emoji}</span>
      <div class="context-text">
        <strong>${formatNum(item.val)}</strong>
        ${item.label}
        <small style="opacity:0.6;display:block">${formatCurrency(item.price)}</small>
      </div>
    </div>
  `).join('');
}

export function createFinanceChartController({ dom }) {
  let lastResult = null;
  let resizeObserver = null;

  function render(result = lastResult) {
    if (!result) return;
    lastResult = result;
    drawChart(dom.chartCanvas, result.chartData);
    fillYearTable(result, dom.yearTableBody);
    renderContextBox(result.realValue, dom.contextGrid);
  }

  function init() {
    if (!dom.chartWrap || !window.ResizeObserver) return;
    resizeObserver = new ResizeObserver(() => {
      if (lastResult) render(lastResult);
    });
    resizeObserver.observe(dom.chartWrap);
  }

  return { init, render, destroy: () => resizeObserver?.disconnect?.() };
}
