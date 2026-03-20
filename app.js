// ============================================================
//  MBRN FINANZ-RECHNER v1.0  –  app.js
//  Logik aus Python-Template portiert + erweitert
//  Features: CoinGecko Live-Preise, Szenarien, Chart, Share-Card
// ============================================================

// ---- SZENARIEN ----
const SCENARIOS = {
  'sp500':     { name: 'S&P 500',   rate: 0.102, label: 'S&P 500 · Investiert' },
  'world-etf': { name: 'World ETF', rate: 0.08,  label: 'World ETF · Investiert' },
  'btc':       { name: 'Bitcoin',   rate: 0.60,  label: 'Bitcoin · Investiert' },
  'savings':   { name: 'Sparkonto', rate: 0.005, label: 'Sparkonto · Investiert' },
};
const INFLATION = 0.038;
let activeScenario = 'sp500';
let lastResult = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  fetchPrices();
  bindEvents();
  updateYearsHint();
});

// ============================================================
//  LIVE PREISE — CoinGecko (kostenlos, kein API-Key)
// ============================================================

async function fetchPrices() {
  try {
    const res  = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    const btc = data?.bitcoin?.eur;
    const eth = data?.ethereum?.eur;

    if (btc) document.getElementById('btc-price').textContent = formatCurrency(btc);
    if (eth) document.getElementById('eth-price').textContent = formatCurrency(eth);

    // BTC-Szenario-Beschreibung aktualisieren
    if (btc) {
      const btcBtn = document.querySelector('[data-scenario="btc"] .scenario-rate');
      if (btcBtn) btcBtn.textContent = `BTC @ ${formatCurrencyShort(btc)}`;
    }
  } catch {
    document.getElementById('btc-price').textContent = '~55.000 €';
    document.getElementById('eth-price').textContent = '~2.800 €';
  }
}

// ============================================================
//  KERNBERECHNUNG  (aus Python-Template portiert)
// ============================================================

function calculate() {
  const ageNow   = parseInt(document.getElementById('age-now').value)   || 28;
  const ageStart = parseInt(document.getElementById('age-start').value) || 18;
  const monthly  = parseFloat(document.getElementById('monthly').value) || 200;
  const lump     = parseFloat(document.getElementById('lump').value)    || 0;

  const years = Math.max(0, ageNow - ageStart);
  if (years === 0) {
    alert('Das Startalter muss vor deinem aktuellen Alter liegen.');
    return;
  }

  const rendite   = SCENARIOS[activeScenario].rate;
  const yearlyIn  = monthly * 12;

  // Fiat-Erosion (Inflation frisst Kaufkraft)
  let fiatVal   = lump;
  let investVal = lump;

  for (let i = 0; i < years; i++) {
    fiatVal   = (fiatVal   + yearlyIn) * (1 - INFLATION);
    investVal = (investVal + yearlyIn) * (1 + rendite);
  }

  const totalInvested = lump + yearlyIn * years;
  const gain          = investVal - totalInvested;
  const factor        = totalInvested > 0 ? investVal / totalInvested : 0;

  // Jahres-Datenpunkte für Chart
  const chartData = [];
  let fv = lump, iv = lump;
  for (let y = 0; y <= years; y++) {
    chartData.push({ year: y, fiat: Math.round(fv), invest: Math.round(iv) });
    fv = (fv + yearlyIn) * (1 - INFLATION);
    iv = (iv + yearlyIn) * (1 + rendite);
  }

  lastResult = { fiatVal, investVal, totalInvested, gain, factor, years, monthly, lump, chartData };
  showResult(lastResult);
}

// ============================================================
//  ERGEBNIS ANZEIGEN
// ============================================================

function showResult(r) {
  const section = document.getElementById('result-section');
  section.style.display = 'flex';

  // Hook
  document.getElementById('hook-number').textContent = formatCurrency(r.investVal);
  document.getElementById('hook-sub').textContent =
    r.investVal > r.totalInvested
      ? `statt ${formatCurrency(r.fiatVal)} auf dem Konto.`
      : 'Mehr Zeit = mehr Wachstum.';

  // Vergleich
  document.getElementById('val-fiat').textContent    = formatCurrency(r.fiatVal);
  document.getElementById('val-invest').textContent  = formatCurrency(r.investVal);
  document.getElementById('invest-label').textContent = SCENARIOS[activeScenario].label;

  // Details
  document.getElementById('detail-years').textContent    = r.years;
  document.getElementById('detail-invested').textContent = formatCurrencyShort(r.totalInvested);
  document.getElementById('detail-gain').textContent     = formatCurrencyShort(Math.max(0, r.gain));
  document.getElementById('detail-factor').textContent   = r.factor.toFixed(1) + 'x';

  // Insight Text
  document.getElementById('insight-text').textContent = buildInsight(r);

  // Chart
  drawChart(r.chartData);

  // Share Preview befüllen
  document.getElementById('sp-number').textContent   = formatCurrency(r.investVal);
  document.getElementById('sp-fiat').textContent     = formatCurrencyShort(r.fiatVal);
  document.getElementById('sp-invest').textContent   = formatCurrencyShort(r.investVal);
  document.getElementById('sp-inv-label').textContent = SCENARIOS[activeScenario].name;
  document.getElementById('sp-sub').textContent      =
    `wenn du vor ${r.years} Jahren angefangen hättest`;

  // Smooth scroll
  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ============================================================
//  EMOTIONALER INSIGHT TEXT
// ============================================================

function buildInsight(r) {
  const diff    = r.investVal - r.fiatVal;
  const diffFmt = formatCurrency(diff);
  const s       = SCENARIOS[activeScenario].name;

  if (r.factor >= 5) {
    return `Mit ${s} hättest du dein eingesetztes Kapital um den Faktor ${r.factor.toFixed(1)} vermehrt — ${diffFmt} mehr als auf dem Konto. Jedes Jahr das du wartest, kostet dich nicht nur Zeit, sondern konkretes Geld.`;
  } else if (r.factor >= 2) {
    return `${diffFmt} liegt zwischen dem, was du investiert hättest, und dem was Inflation aus deinem Geld gemacht hätte. Das ist der Unterschied zwischen Wachstum und Stillstand.`;
  } else {
    return `Selbst ein ${s} mit ${(SCENARIOS[activeScenario].rate * 100).toFixed(1)}% jährlicher Rendite schlägt Inflation langfristig deutlich. Früh starten ist die einfachste Entscheidung.`;
  }
}

// ============================================================
//  CHART (Canvas, kein externes JS nötig)
// ============================================================

function drawChart(data) {
  const canvas = document.getElementById('growth-chart');
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const w      = canvas.parentElement.clientWidth;
  const h      = 180;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const padL = 16, padR = 16, padT = 16, padB = 28;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = Math.max(...data.map(d => d.invest));
  const minVal = 0;

  function xPos(i)   { return padL + (i / (data.length - 1)) * chartW; }
  function yPos(val) { return padT + chartH - ((val - minVal) / (maxVal - minVal)) * chartH; }

  // Hintergrundgitter
  ctx.strokeStyle = 'rgba(100,80,200,0.08)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
  }

  // Fiat-Linie (rot)
  ctx.beginPath();
  data.forEach((d, i) => {
    i === 0 ? ctx.moveTo(xPos(i), yPos(d.fiat)) : ctx.lineTo(xPos(i), yPos(d.fiat));
  });
  ctx.strokeStyle = 'rgba(255,107,107,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Invest-Fläche (lila gradient)
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0,   'rgba(179,136,255,0.25)');
  grad.addColorStop(1,   'rgba(179,136,255,0.02)');
  ctx.beginPath();
  data.forEach((d, i) => {
    i === 0 ? ctx.moveTo(xPos(i), yPos(d.invest)) : ctx.lineTo(xPos(i), yPos(d.invest));
  });
  ctx.lineTo(xPos(data.length - 1), padT + chartH);
  ctx.lineTo(xPos(0), padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Invest-Linie
  ctx.beginPath();
  data.forEach((d, i) => {
    i === 0 ? ctx.moveTo(xPos(i), yPos(d.invest)) : ctx.lineTo(xPos(i), yPos(d.invest));
  });
  ctx.strokeStyle = 'rgba(179,136,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // X-Achse Labels (Anfang, Mitte, Ende)
  ctx.fillStyle    = 'rgba(232,232,240,0.3)';
  ctx.font         = `${9 * dpr / dpr}px Space Mono, monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  const labelIdxs  = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  labelIdxs.forEach(i => {
    ctx.fillText(`Jahr ${data[i].year}`, xPos(i), h - 4);
  });
}

// ============================================================
//  SHARE CARD (Canvas 1080×1080)
// ============================================================

function generateShareImage() {
  if (!lastResult) return;
  const r       = lastResult;
  const size    = 1080;
  const canvas  = document.createElement('canvas');
  canvas.width  = canvas.height = size;
  const ctx     = canvas.getContext('2d');

  // Hintergrund
  ctx.fillStyle = '#030014';
  ctx.fillRect(0, 0, size, size);

  // Glow oben rechts
  const g1 = ctx.createRadialGradient(size, 0, 0, size, 0, 500);
  g1.addColorStop(0,   'rgba(157,80,187,0.35)');
  g1.addColorStop(1,   'transparent');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, size, size);

  // Glow unten links
  const g2 = ctx.createRadialGradient(0, size, 0, 0, size, 400);
  g2.addColorStop(0,   'rgba(56,189,248,0.15)');
  g2.addColorStop(1,   'transparent');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, size, size);

  // Accent-Rand
  ctx.fillStyle = '#b388ff';
  ctx.fillRect(0, 0, size, 6);
  ctx.fillRect(0, size - 6, size, 6);

  // Label oben
  ctx.fillStyle    = 'rgba(179,136,255,0.6)';
  ctx.font         = '500 26px monospace';
  ctx.textAlign    = 'center';
  ctx.fillText('WAS WÄRST DU HEUTE WERT?', size / 2, 72);

  // Hauptzahl
  let fontSize = 200;
  const numText = formatCurrency(r.investVal);
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(numText).width > size * 0.85 && fontSize > 60) {
    fontSize -= 8;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(179,136,255,0.3)';
  ctx.shadowBlur   = 40;

  // Gradient-Text
  const textGrad = ctx.createLinearGradient(size * 0.2, 0, size * 0.8, 0);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(1, '#b388ff');
  ctx.fillStyle = textGrad;
  ctx.fillText(numText, size / 2, 340);
  ctx.shadowBlur = 0;

  // Subtext
  ctx.fillStyle    = 'rgba(232,232,240,0.45)';
  ctx.font         = '400 28px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`bei ${r.years} Jahren ${SCENARIOS[activeScenario].name}`, size / 2, 430);

  // Vergleichs-Boxen
  const boxY = 480, boxH = 130, boxW = 420, gap = 40;
  const box1X = size / 2 - boxW - gap / 2;
  const box2X = size / 2 + gap / 2;

  // Fiat Box
  ctx.fillStyle   = 'rgba(255,107,107,0.1)';
  ctx.strokeStyle = 'rgba(255,107,107,0.35)';
  ctx.lineWidth   = 1;
  roundRect(ctx, box1X, boxY, boxW, boxH, 12, true, true);
  ctx.fillStyle    = 'rgba(232,232,240,0.4)';
  ctx.font         = '400 18px monospace';
  ctx.textAlign    = 'center';
  ctx.fillText('FIAT · INFLATION', box1X + boxW / 2, boxY + 32);
  ctx.fillStyle    = '#ff6b6b';
  ctx.font         = 'bold 36px sans-serif';
  ctx.fillText(formatCurrencyShort(r.fiatVal), box1X + boxW / 2, boxY + 85);

  // Invest Box
  ctx.fillStyle   = 'rgba(79,255,176,0.1)';
  ctx.strokeStyle = 'rgba(79,255,176,0.35)';
  roundRect(ctx, box2X, boxY, boxW, boxH, 12, true, true);
  ctx.fillStyle    = 'rgba(232,232,240,0.4)';
  ctx.font         = '400 18px monospace';
  ctx.textAlign    = 'center';
  ctx.fillText(SCENARIOS[activeScenario].name.toUpperCase(), box2X + boxW / 2, boxY + 32);
  ctx.fillStyle    = '#4fffb0';
  ctx.font         = 'bold 36px sans-serif';
  ctx.fillText(formatCurrencyShort(r.investVal), box2X + boxW / 2, boxY + 85);

  // Stats Row
  const statsY = 650;
  const stats  = [
    { label: 'JAHRE', val: r.years },
    { label: 'EINGEZAHLT', val: formatCurrencyShort(r.totalInvested) },
    { label: 'GEWINN', val: formatCurrencyShort(Math.max(0, r.gain)) },
    { label: 'FAKTOR', val: r.factor.toFixed(1) + 'x' },
  ];
  const sw = (size - 120) / 4;
  stats.forEach((s, i) => {
    const sx = 60 + i * sw;
    ctx.fillStyle    = 'rgba(232,232,240,0.25)';
    ctx.font         = '400 16px monospace';
    ctx.textAlign    = 'center';
    ctx.fillText(s.label, sx + sw / 2, statsY + 22);
    ctx.fillStyle    = '#b388ff';
    ctx.font         = 'bold 28px sans-serif';
    ctx.fillText(s.val, sx + sw / 2, statsY + 64);
  });

  // Insight
  const insightY = 760;
  ctx.fillStyle  = 'rgba(179,136,255,0.15)';
  ctx.strokeStyle= 'rgba(179,136,255,0.2)';
  ctx.lineWidth  = 1;
  roundRect(ctx, 60, insightY, size - 120, 110, 12, true, true);
  ctx.fillStyle    = 'rgba(232,232,240,0.5)';
  ctx.font         = '400 20px monospace';
  ctx.textAlign    = 'center';
  const insight    = buildInsight(r);
  wrapText(ctx, insight, size / 2, insightY + 42, size - 160, 32);

  // Footer
  ctx.fillStyle    = 'rgba(179,136,255,0.4)';
  ctx.font         = '400 20px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io  ✦', size / 2, size - 22);

  // Download
  const link    = document.createElement('a');
  link.download = 'mbrn-finanz-rechner.png';
  link.href     = canvas.toDataURL('image/png');
  link.click();
}

// ============================================================
//  SHARE TEXT + MODAL
// ============================================================

function buildShareText() {
  if (!lastResult) return '';
  const r   = lastResult;
  const url = window.location.href.split('?')[0];
  return [
    `💸 Was wärst du heute wert, wenn du früher investiert hättest?`,
    `Ich hab das mal durchgerechnet: Mit ${SCENARIOS[activeScenario].name} über ${r.years} Jahre → ${formatCurrency(r.investVal)}`,
    `Statt ${formatCurrencyShort(r.fiatVal)} auf dem Konto. Der Unterschied: ${formatCurrency(r.investVal - r.fiatVal)}`,
    `👉 ${url}`,
    `#Investieren #FinanzielleFreiheit #MBRN`,
  ].join('\n');
}

function openShareModal() {
  document.getElementById('share-overlay').style.display = 'flex';
  if (!lastResult) return;
  document.getElementById('sp-number').textContent  = formatCurrency(lastResult.investVal);
  document.getElementById('sp-fiat').textContent    = formatCurrencyShort(lastResult.fiatVal);
  document.getElementById('sp-invest').textContent  = formatCurrencyShort(lastResult.investVal);
  document.getElementById('sp-inv-label').textContent = SCENARIOS[activeScenario].name;
  document.getElementById('sp-sub').textContent     = `wenn du vor ${lastResult.years} Jahren angefangen hättest`;
}

// ============================================================
//  EVENT BINDINGS
// ============================================================

function bindEvents() {

  // Szenarien
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScenario = btn.dataset.scenario;
      updateScenarioNote();
      if (lastResult) calculate(); // neu berechnen
    });
  });

  // Alter-Inputs → Jahre-Hint aktualisieren
  document.getElementById('age-now').addEventListener('input', updateYearsHint);
  document.getElementById('age-start').addEventListener('input', updateYearsHint);

  // Enter = berechnen
  ['age-now','age-start','monthly','lump'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') calculate();
    });
  });

  // Berechnen-Button
  document.getElementById('btn-calculate').addEventListener('click', calculate);

  // Share Result Button
  document.getElementById('btn-share-result').addEventListener('click', openShareModal);

  // Save Image Button
  document.getElementById('btn-save-image').addEventListener('click', generateShareImage);

  // Share Modal Buttons
  document.getElementById('btn-wa').addEventListener('click', () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildShareText()), '_blank');
  });
  document.getElementById('btn-tw').addEventListener('click', () => {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildShareText()), '_blank');
  });
  document.getElementById('btn-copy').addEventListener('click', () => {
    const url = window.location.href.split('?')[0];
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✓ Kopiert!';
    setTimeout(() => { btn.innerHTML = '🔗 Link kopieren'; }, 2000);
  });
  document.getElementById('btn-dl').addEventListener('click', generateShareImage);

  // Modal schließen
  document.getElementById('share-close').addEventListener('click', () => {
    document.getElementById('share-overlay').style.display = 'none';
  });
  document.getElementById('share-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('share-overlay'))
      document.getElementById('share-overlay').style.display = 'none';
  });

  // Datenschutz
  document.getElementById('btn-privacy').addEventListener('click', () => {
    document.getElementById('privacy-overlay').style.display = 'flex';
  });
  document.getElementById('privacy-close').addEventListener('click', () => {
    document.getElementById('privacy-overlay').style.display = 'none';
  });
  document.getElementById('privacy-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('privacy-overlay'))
      document.getElementById('privacy-overlay').style.display = 'none';
  });

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['share-overlay','privacy-overlay'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
  });
}

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

function updateYearsHint() {
  const ageNow   = parseInt(document.getElementById('age-now').value)   || 0;
  const ageStart = parseInt(document.getElementById('age-start').value) || 0;
  const years    = Math.max(0, ageNow - ageStart);
  const el       = document.getElementById('years-hint');
  if (el) el.textContent = years === 0 ? '— Bitte Alter anpassen' : `= ${years} Jahre Wachstum verpasst`;
}

function updateScenarioNote() {
  const notes = {
    'sp500':     '* S&P 500 historische Durchschnittsrendite 1957–2024.',
    'world-etf': '* MSCI World historische Durchschnittsrendite ~1970–2024.',
    'btc':       '* Bitcoin-Rendite basiert auf historischem Durchschnitt 2013–2024. Vergangene Performance ist keine Garantie.',
    'savings':   '* Sparkonto-Zinssatz geschätzt für Deutschland 2000–2024.',
  };
  const el = document.getElementById('scenario-disclaimer');
  if (el) el.textContent = notes[activeScenario] || '';
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigi
