// ============================================================
//  MBRN FINANZ-RECHNER v1.2  –  app.js
//  Fixes: kein alert() → Toast, Slider-UX, Inflation-Input,
//         Steuerhinweis, BTC-Disclaimer, Story-Format (9:16),
//         Button-Loading-State, smooth result animations
// ============================================================

'use strict';

const SCENARIOS = {
  'sp500':     { name: 'S&P 500',   rate: 0.102 },
  'world-etf': { name: 'World ETF', rate: 0.08  },
  'btc':       { name: 'Bitcoin',   rate: 0.60  },
  'savings':   { name: 'Sparkonto', rate: 0.005 },
};

// Abgeltungssteuer DE inkl. Soli
const TAX_RATE    = 0.26375;
const FREIBETRAG  = 1000; // Sparerpauschbetrag 2024

let activeScenario = 'sp500';
let lastResult     = null;
let inflation      = 0.038;

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  fetchPrices();
  updateYearsHint();
  initSliders();
  bindEvents();
});

// ============================================================
//  TOAST (ersetzt alert())
// ============================================================

function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 3500);
}

// ============================================================
//  LIVE PREISE
// ============================================================

function fetchPrices() {
  var controller = new AbortController();
  var timer      = setTimeout(function () { controller.abort(); }, 6000);

  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
    { signal: controller.signal })
    .then(function (res) { clearTimeout(timer); return res.json(); })
    .then(function (data) {
      var btc = data && data.bitcoin  && data.bitcoin.eur;
      var eth = data && data.ethereum && data.ethereum.eur;
      setText('btc-price', btc ? formatCurrency(btc) : '~84.000 €');
      setText('eth-price', eth ? formatCurrency(eth) : '~2.000 €');
      if (btc) setText('btc-scenario-rate', 'BTC @ ' + formatCurrencyShort(btc));
    })
    .catch(function () {
      clearTimeout(timer);
      setText('btc-price', '~84.000 €');
      setText('eth-price', '~2.000 €');
    });
}

// ============================================================
//  SLIDER INIT — koppelt Range-Slider mit Number-Input
// ============================================================

function initSliders() {
  linkSlider('slider-age-now',   'age-now',   'badge-age-now',   function (v) { return v + ' Jahre'; });
  linkSlider('slider-age-start', 'age-start', 'badge-age-start', function (v) { return v + ' Jahre'; });
  linkSlider('slider-monthly',   'monthly',   'badge-monthly',   function (v) { return v + ' €'; });

  // Slider-Farbe dynamisch aktualisieren
  document.querySelectorAll('.slider').forEach(function (sl) {
    updateSliderFill(sl);
    sl.addEventListener('input', function () { updateSliderFill(sl); });
  });
}

function linkSlider(sliderId, inputId, badgeId, formatFn) {
  var slider = document.getElementById(sliderId);
  var input  = document.getElementById(inputId);
  var badge  = document.getElementById(badgeId);
  if (!slider || !input) return;

  slider.addEventListener('input', function () {
    input.value = slider.value;
    if (badge) badge.textContent = formatFn(slider.value);
    updateYearsHint();
  });

  input.addEventListener('input', function () {
    slider.value = input.value;
    if (badge) badge.textContent = formatFn(input.value);
    updateSliderFill(slider);
    updateYearsHint();
  });

  // Initialer Badge-Wert
  if (badge) badge.textContent = formatFn(input.value);
}

function updateSliderFill(sl) {
  var min = parseFloat(sl.min) || 0;
  var max = parseFloat(sl.max) || 100;
  var val = parseFloat(sl.value) || 0;
  var pct = ((val - min) / (max - min)) * 100;
  sl.style.background = 'linear-gradient(90deg, #b388ff ' + pct + '%, rgba(100,80,200,0.2) ' + pct + '%)';
}

// ============================================================
//  KERNBERECHNUNG
// ============================================================

function calculate() {
  var ageNow   = parseInt(getVal('age-now'),   10) || 0;
  var ageStart = parseInt(getVal('age-start'), 10) || 0;
  var monthly  = parseFloat(getVal('monthly'))     || 0;
  var lump     = parseFloat(getVal('lump'))         || 0;

  // Validierung — Toast statt alert
  hideError('err-age');
  if (ageStart >= ageNow) {
    showError('err-age', 'Startalter muss kleiner als aktuelles Alter sein');
    showToast('⚠ Startalter muss kleiner als aktuelles Alter sein');
    return;
  }
  if (monthly <= 0) {
    showToast('⚠ Bitte einen monatlichen Betrag eingeben');
    return;
  }

  var years    = ageNow - ageStart;
  var rendite  = SCENARIOS[activeScenario].rate;
  var yearlyIn = monthly * 12;

  // Button Loading-State
  setCalcLoading(true);

  // Kurze Verzögerung für Animation
  setTimeout(function () {
    var fiatVal   = lump;
    var investVal = lump;

    for (var i = 0; i < years; i++) {
      fiatVal   = (fiatVal   + yearlyIn) * (1 - inflation);
      investVal = (investVal + yearlyIn) * (1 + rendite);
    }

    var totalInvested = lump + yearlyIn * years;
    var rawGain       = investVal - totalInvested;
    var taxableGain   = Math.max(0, rawGain - FREIBETRAG);
    var taxAmount     = taxableGain * TAX_RATE;
    var afterTax      = investVal - taxAmount;

    var factor = totalInvested > 0 ? investVal / totalInvested : 0;

    var chartData = [];
    var fv = lump, iv = lump;
    for (var y = 0; y <= years; y++) {
      chartData.push({ year: y, fiat: Math.round(fv), invest: Math.round(iv) });
      fv = (fv + yearlyIn) * (1 - inflation);
      iv = (iv + yearlyIn) * (1 + rendite);
    }

    lastResult = {
      fiatVal: fiatVal, investVal: investVal, afterTax: afterTax,
      totalInvested: totalInvested, gain: rawGain, factor: factor,
      years: years, monthly: monthly, lump: lump, chartData: chartData,
    };

    setCalcLoading(false);
    showResult(lastResult);
  }, 180);
}

// ============================================================
//  ERGEBNIS ANZEIGEN
// ============================================================

function showResult(r) {
  var section = document.getElementById('result-section');
  if (!section) return;
  section.style.display   = 'flex';
  section.style.animation = 'none';
  void section.offsetWidth;
  section.style.animation = '';

  setText('hook-number', formatCurrency(r.investVal));
  setText('hook-sub',
    r.investVal > r.fiatVal
      ? 'statt ' + formatCurrency(r.fiatVal) + ' auf dem Konto.'
      : 'Mehr Zeit = mehr Wachstum.');

  // Steuerhinweis (nur wenn sinnvoller Gewinn)
  var taxHint = document.getElementById('tax-hint');
  var taxAfter = document.getElementById('tax-after');
  if (taxHint && taxAfter && r.gain > FREIBETRAG) {
    taxHint.style.display = 'flex';
    taxAfter.textContent  = formatCurrency(r.afterTax) + ' (ca.)';
  } else if (taxHint) {
    taxHint.style.display = 'none';
  }

  setText('val-fiat',    formatCurrency(r.fiatVal));
  setText('val-invest',  formatCurrency(r.investVal));
  setText('invest-label', SCENARIOS[activeScenario].name + ' · Investiert');
  setText('detail-years',    r.years);
  setText('detail-invested', formatCurrencyShort(r.totalInvested));
  setText('detail-gain',     formatCurrencyShort(Math.max(0, r.gain)));
  setText('detail-factor',   r.factor.toFixed(1) + 'x');

  updateWowMeter(r);
  setText('insight-text', buildInsight(r));

  // Share Preview
  setText('sp-number',   formatCurrency(r.investVal));
  setText('sp-fiat',     formatCurrencyShort(r.fiatVal));
  setText('sp-invest',   formatCurrencyShort(r.investVal));
  setText('sp-inv-label', SCENARIOS[activeScenario].name);
  setText('sp-sub',      'wenn du vor ' + r.years + ' Jahren angefangen hättest');

  drawChart(r.chartData);

  setTimeout(function () {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

// ============================================================
//  WOW-METER
// ============================================================

function updateWowMeter(r) {
  var fill  = document.getElementById('wow-fill');
  var label = document.getElementById('wow-label');
  if (!fill || !label) return;
  var pct    = Math.min(100, Math.round(((r.factor - 1) / 19) * 100));
  fill.style.width   = pct + '%';
  var labels = ['Besser als nichts', 'Solide', 'Gut', 'Sehr gut', 'Exzellent', 'Außergewöhnlich'];
  label.textContent  = labels[Math.min(labels.length - 1, Math.floor(pct / 17))] + ' (' + pct + '%)';
}

// ============================================================
//  INSIGHT
// ============================================================

function buildInsight(r) {
  var s    = SCENARIOS[activeScenario].name;
  var diff = formatCurrency(r.investVal - r.fiatVal);
  var isBtc = activeScenario === 'btc';
  var base;

  if (r.factor >= 10) {
    base = 'Mit ' + s + ' hättest du dein Kapital ver' + r.factor.toFixed(0) + 'facht — ' + diff + ' mehr als auf dem Konto. Das ist kein Glück, das ist Zinseszins.';
  } else if (r.factor >= 3) {
    base = diff + ' trennen die Entscheidung zu investieren von der Entscheidung es nicht zu tun. ' + r.years + ' Jahre, ' + formatCurrencyShort(r.monthly) + ' monatlich.';
  } else {
    base = 'Selbst ' + s + ' schlägt Inflation in ' + r.years + ' Jahren deutlich — ' + diff + ' Unterschied bei nur ' + formatCurrencyShort(r.monthly) + '/Monat.';
  }

  if (isBtc) {
    base += ' ⚠ Bitcoin: historische Rendite von ø 60%/Jahr. Bei wachsender Marktkapitalisierung sind solche Renditen zukünftig unwahrscheinlich — realistisch einordnen.';
  }

  return base;
}

// ============================================================
//  CHART
// ============================================================

function drawChart(data) {
  var canvas = document.getElementById('growth-chart');
  if (!canvas || !canvas.getContext) return;
  var ctx  = canvas.getContext('2d');
  var dpr  = window.devicePixelRatio || 1;
  var w    = canvas.parentElement.clientWidth || 300;
  var h    = 200;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var pL = 16, pR = 20, pT = 20, pB = 28;
  var cW = w - pL - pR;
  var cH = h - pT - pB;
  var maxVal = Math.max.apply(null, data.map(function (d) { return d.invest; })) || 1;

  function xP(i)   { return pL + (i / Math.max(data.length - 1, 1)) * cW; }
  function yP(val) { return pT + cH - (val / maxVal) * cH; }

  // Grid
  ctx.strokeStyle = 'rgba(100,80,200,0.08)'; ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var gy = pT + (cH / 4) * g;
    ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pL + cW, gy); ctx.stroke();
  }

  // Fiat
  ctx.beginPath();
  data.forEach(function (d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.fiat));
    else         ctx.lineTo(xP(i), yP(d.fiat));
  });
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,107,107,0.55)'; ctx.lineWidth = 1.5;
  ctx.stroke(); ctx.setLineDash([]);

  // Invest-Fläche
  var grad = ctx.createLinearGradient(0, pT, 0, pT + cH);
  grad.addColorStop(0, 'rgba(179,136,255,0.28)');
  grad.addColorStop(1, 'rgba(179,136,255,0.02)');
  ctx.beginPath();
  data.forEach(function (d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.invest));
    else         ctx.lineTo(xP(i), yP(d.invest));
  });
  ctx.lineTo(xP(data.length - 1), pT + cH);
  ctx.lineTo(xP(0), pT + cH);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // Invest-Linie
  ctx.beginPath();
  data.forEach(function (d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.invest));
    else         ctx.lineTo(xP(i), yP(d.invest));
  });
  ctx.strokeStyle = 'rgba(179,136,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();

  // Endwert
  if (data.length > 1) {
    var last = data[data.length - 1];
    ctx.fillStyle = 'rgba(179,136,255,0.8)'; ctx.font = '700 10px Space Mono, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(formatCurrencyShort(last.invest), pL + cW, yP(last.invest) - 4);
  }

  // X-Labels
  ctx.fillStyle = 'rgba(232,232,240,0.3)'; ctx.font = '9px Space Mono, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach(function (i) {
    ctx.fillText('Jahr ' + data[i].year, xP(i), h - 4);
  });
}

// ============================================================
//  SHARE IMAGE — POST (1:1) und STORY (9:16)
// ============================================================

function generateShareImage(format) {
  if (!lastResult) { showToast('⚠ Bitte zuerst berechnen'); return; }
  var r    = lastResult;
  var isStory = format === 'story';
  var W    = 1080;
  var H    = isStory ? 1920 : 1080;
  var c    = document.createElement('canvas');
  c.width  = W; c.height = H;
  var ctx  = c.getContext('2d');

  // BG
  ctx.fillStyle = '#030014'; ctx.fillRect(0, 0, W, H);
  var g1 = ctx.createRadialGradient(W, 0, 0, W, 0, 600);
  g1.addColorStop(0, 'rgba(157,80,187,0.35)'); g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  var g2 = ctx.createRadialGradient(0, H, 0, 0, H, 500);
  g2.addColorStop(0, 'rgba(56,189,248,0.15)'); g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Accent-Rand
  ctx.fillStyle = '#b388ff';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);

  if (isStory) {
    drawStoryCard(ctx, r, W, H);
  } else {
    drawPostCard(ctx, r, W, H);
  }

  var link    = document.createElement('a');
  link.download = isStory ? 'mbrn-finanz-story.png' : 'mbrn-finanz-post.png';
  link.href   = c.toDataURL('image/png');
  link.click();
}

function drawPostCard(ctx, r, W, H) {
  ctx.fillStyle = 'rgba(179,136,255,0.55)'; ctx.font = '500 24px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('WAS WÄRST DU HEUTE WERT? ✦ MBRN', W / 2, 68);

  var numText = formatCurrency(r.investVal);
  var fs = 180;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  while (ctx.measureText(numText).width > W * 0.82 && fs > 60) { fs -= 8; ctx.font = 'bold ' + fs + 'px sans-serif'; }
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,0.3)'; ctx.shadowBlur = 40;
  var tg = ctx.createLinearGradient(200, 0, W - 200, 0);
  tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#b388ff');
  ctx.fillStyle = tg; ctx.fillText(numText, W / 2, 330); ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(232,232,240,0.4)'; ctx.font = '400 26px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('wenn du vor ' + r.years + ' Jahren angefangen hättest', W / 2, 430);

  drawCompareBoxes(ctx, r, W, 480, 420, 130, 36);
  drawStatsRow(ctx, r, W, 656);
  drawInsightBox(ctx, r, W, 760, 116);

  ctx.fillStyle = 'rgba(179,136,255,0.4)'; ctx.font = '400 18px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io/FinanzRechner  ✦', W / 2, H - 22);
}

function drawStoryCard(ctx, r, W, H) {
  var cx = W / 2;
  // Top label
  ctx.fillStyle = 'rgba(179,136,255,0.6)'; ctx.font = '500 26px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦ MBRN · FINANZ-RECHNER ✦', cx, 100);

  // Frage
  ctx.fillStyle = 'rgba(232,232,240,0.8)'; ctx.font = 'bold 48px sans-serif';
  ctx.fillText('Was wärst du heute', cx, 200);
  ctx.fillText('wert?', cx, 265);

  // Hauptzahl
  var numText = formatCurrency(r.investVal);
  var fs = 140;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  while (ctx.measureText(numText).width > W * 0.85 && fs > 60) { fs -= 8; ctx.font = 'bold ' + fs + 'px sans-serif'; }
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,0.4)'; ctx.shadowBlur = 50;
  var tg = ctx.createLinearGradient(100, 0, W - 100, 0);
  tg.addColorStop(0, '#fff'); tg.addColorStop(1, '#b388ff');
  ctx.fillStyle = tg; ctx.fillText(numText, cx, 430); ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(232,232,240,0.5)'; ctx.font = '400 28px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('bei ' + r.years + ' Jahren ' + SCENARIOS[activeScenario].name, cx, 530);

  drawCompareBoxes(ctx, r, W, 600, 380, 160, 44);
  drawStatsRow(ctx, r, W, 820);

  // Disclaimer
  ctx.fillStyle = 'rgba(232,232,240,0.25)'; ctx.font = '400 20px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Keine Finanzberatung · Historische Werte', cx, 1040);

  // CTA Box
  ctx.fillStyle = 'rgba(179,136,255,0.12)'; ctx.strokeStyle = 'rgba(179,136,255,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, 80, 1080, W - 160, 160, 18, true, true);
  ctx.fillStyle = '#b388ff'; ctx.font = 'bold 28px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText('Berechne dein Ergebnis:', cx, 1140);
  ctx.fillStyle = 'rgba(232,232,240,0.7)'; ctx.font = '400 22px monospace';
  ctx.fillText('flase-mbrn.github.io/FinanzRechner', cx, 1190);

  // Insight unten
  drawInsightBox(ctx, r, W, 1300, 200);

  // Footer
  ctx.fillStyle = 'rgba(179,136,255,0.4)'; ctx.font = '400 22px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io  ✦', cx, H - 22);
}

function drawCompareBoxes(ctx, r, W, y, bW, bH, fontSize) {
  var gap = 36, b1x = W / 2 - bW - gap / 2, b2x = W / 2 + gap / 2;
  ctx.fillStyle = 'rgba(255,107,107,0.1)'; ctx.strokeStyle = 'rgba(255,107,107,0.35)'; ctx.lineWidth = 1;
  roundRect(ctx, b1x, y, bW, bH, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.35)'; ctx.font = '400 17px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('FIAT · INFLATION', b1x + bW / 2, y + 30);
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold ' + fontSize + 'px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrencyShort(r.fiatVal), b1x + bW / 2, y + bH * 0.65);

  ctx.fillStyle = 'rgba(79,255,176,0.1)'; ctx.strokeStyle = 'rgba(79,255,176,0.35)';
  roundRect(ctx, b2x, y, bW, bH, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.35)'; ctx.font = '400 17px monospace'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(SCENARIOS[activeScenario].name.toUpperCase(), b2x + bW / 2, y + 30);
  ctx.fillStyle = '#4fffb0'; ctx.font = 'bold ' + fontSize + 'px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrencyShort(r.investVal), b2x + bW / 2, y + bH * 0.65);
}

function drawStatsRow(ctx, r, W, y) {
  var stats = [
    { l: 'JAHRE', v: r.years },
    { l: 'EINGEZAHLT', v: formatCurrencyShort(r.totalInvested) },
    { l: 'GEWINN', v: formatCurrencyShort(Math.max(0, r.gain)) },
    { l: 'FAKTOR', v: r.factor.toFixed(1) + 'x' },
  ];
  var sw = (W - 120) / 4;
  stats.forEach(function (s, i) {
    var sx = 60 + i * sw;
    ctx.fillStyle = 'rgba(232,232,240,0.25)'; ctx.font = '400 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.l, sx + sw / 2, y + 22);
    ctx.fillStyle = '#b388ff'; ctx.font = 'bold 28px sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(s.v, sx + sw / 2, y + 60);
  });
}

function drawInsightBox(ctx, r, W, y, boxH) {
  ctx.fillStyle = 'rgba(179,136,255,0.1)'; ctx.strokeStyle = 'rgba(179,136,255,0.2)'; ctx.lineWidth = 1;
  roundRect(ctx, 60, y, W - 120, boxH, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.5)'; ctx.font = '400 19px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  var insight = buildInsight(r);
  // Truncate for canvas
  if (insight.length > 180) insight = insight.substring(0, 177) + '…';
  wrapText(ctx, insight, W / 2, y + boxH / 2 - 18, W - 160, 32);
}

// ============================================================
//  SHARE TEXT
// ============================================================

function buildShareText() {
  if (!lastResult) return '';
  var r   = lastResult;
  var url = window.location.href.split('?')[0];
  return [
    '💸 Was wärst du heute wert, wenn du früher investiert hättest?',
    'Ich hab es durchgerechnet: ' + SCENARIOS[activeScenario].name + ' über ' + r.years + ' Jahre → ' + formatCurrency(r.investVal),
    'Statt ' + formatCurrencyShort(r.fiatVal) + ' auf dem Konto. Unterschied: ' + formatCurrency(r.investVal - r.fiatVal),
    '👉 ' + url,
    '#Investieren #FinanzielleFreiheit #MBRN',
  ].join('\n');
}

// ============================================================
//  EVENTS
// ============================================================

function bindEvents() {

  // Szenarien
  document.querySelectorAll('.scenario-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.scenario-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeScenario = btn.getAttribute('data-scenario');
      updateScenarioNote();
      if (lastResult) calculate();
    });
  });

  // Alter Hints
  document.getElementById('age-now')   && document.getElementById('age-now').addEventListener('input', updateYearsHint);
  document.getElementById('age-start') && document.getElementById('age-start').addEventListener('input', updateYearsHint);

  // Enter = berechnen
  ['age-now','age-start','monthly','lump','inflation-input'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') calculate(); });
  });

  // Inflation Presets
  document.querySelectorAll('.inflation-preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.inflation-preset').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var val = parseFloat(btn.getAttribute('data-val'));
      inflation = val;
      var inflInput = document.getElementById('inflation-input');
      if (inflInput) inflInput.value = (val * 100).toFixed(1);
      setText('inflation-display', '+' + (val * 100).toFixed(1) + '%/Jahr');
      if (lastResult) calculate();
    });
  });

  // Inflation Custom Input
  var inflInput = document.getElementById('inflation-input');
  if (inflInput) {
    inflInput.addEventListener('input', function () {
      var val = parseFloat(inflInput.value);
      if (!isNaN(val) && val >= 0 && val <= 20) {
        inflation = val / 100;
        document.querySelectorAll('.inflation-preset').forEach(function (b) { b.classList.remove('active'); });
        setText('inflation-display', '+' + val.toFixed(1) + '%/Jahr');
      }
    });
  }

  // Berechnen
  var calcBtn = document.getElementById('btn-calculate');
  if (calcBtn) calcBtn.addEventListener('click', calculate);

  // Share
  var shareBtn = document.getElementById('btn-share-result');
  if (shareBtn) shareBtn.addEventListener('click', function () {
    if (!lastResult) { showToast('⚠ Bitte zuerst berechnen'); return; }
    var overlay = document.getElementById('share-overlay');
    if (overlay) overlay.style.display = 'flex';
  });

  document.getElementById('btn-save-image')    && document.getElementById('btn-save-image').addEventListener('click',    function () { generateShareImage('post');  });
  document.getElementById('btn-save-story')    && document.getElementById('btn-save-story').addEventListener('click',    function () { generateShareImage('story'); });
  document.getElementById('btn-dl')            && document.getElementById('btn-dl').addEventListener('click',            function () { generateShareImage('post');  });
  document.getElementById('btn-story-modal')   && document.getElementById('btn-story-modal').addEventListener('click',   function () { generateShareImage('story'); });

  document.getElementById('btn-wa') && document.getElementById('btn-wa').addEventListener('click', function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildShareText()), '_blank');
  });
  document.getElementById('btn-tw') && document.getElementById('btn-tw').addEventListener('click', function () {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildShareText()), '_blank');
  });
  document.getElementById('btn-copy') && document.getElementById('btn-copy').addEventListener('click', function () {
    var url = window.location.href.split('?')[0];
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () { fallbackCopy(url); });
    else fallbackCopy(url);
    var btn = document.getElementById('btn-copy');
    btn.textContent = '✓ Kopiert!';
    setTimeout(function () { btn.innerHTML = '🔗 Link kopieren'; }, 2000);
  });

  // Modals
  closeModal('share-close',   'share-overlay');
  closeModal('privacy-close', 'privacy-overlay');
  closeOnBackdrop('share-overlay');
  closeOnBackdrop('privacy-overlay');

  var privBtn = document.getElementById('btn-privacy');
  if (privBtn) privBtn.addEventListener('click', function () {
    var overlay = document.getElementById('privacy-overlay');
    if (overlay) overlay.style.display = 'flex';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['share-overlay','privacy-overlay'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  });
}

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

function setCalcLoading(on) {
  var btn  = document.getElementById('btn-calculate');
  var icon = document.getElementById('calc-icon');
  var text = document.getElementById('calc-text');
  if (!btn) return;
  if (on) {
    btn.classList.add('loading');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    if (text) text.textContent = 'Berechne…';
  } else {
    btn.classList.remove('loading');
    if (icon) { icon.style.animation = ''; icon.textContent = '✦'; }
    if (text) text.textContent = 'Jetzt berechnen';
  }
}

function showError(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}
function hideError(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function updateYearsHint() {
  var ageNow   = parseInt(getVal('age-now'),   10) || 0;
  var ageStart = parseInt(getVal('age-start'), 10) || 0;
  var years    = ageNow - ageStart;
  var el       = document.getElementById('years-hint');
  if (!el) return;
  if (years <= 0) el.textContent = '— Startalter muss kleiner als aktuelles Alter sein';
  else            el.textContent = '= ' + years + ' Jahre Wachstum verpasst';
}

function updateScenarioNote() {
  var notes = {
    'sp500':     '* S&P 500 historische Durchschnittsrendite 1957–2024. Vergangene Performance ist keine Garantie.',
    'world-etf': '* MSCI World historische Durchschnittsrendite ~1970–2024. Vergangene Performance ist keine Garantie.',
    'btc':       '* Bitcoin ø 60%/Jahr (2013–2024). Bei steigender Marktkapitalisierung werden solche Renditen unwahrscheinlicher. Hochspekulativ — nur was du verlieren kannst.',
    'savings':   '* Sparkonto DE geschätzter Schnitt 2000–2024. Aktuell teils höher.',
  };
  var el = document.getElementById('scenario-disclaimer');
  if (el) el.textContent = notes[activeScenario] || '';
}

function getVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function formatCurrencyShort(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
  if (val >= 1000)    return Math.round(val / 1000) + ' T€';
  return formatCurrency(val);
}

function closeModal(btnId, overlayId) {
  var btn = document.getElementById(btnId);
  if (btn) btn.addEventListener('click', function () {
    var el = document.getElementById(overlayId);
    if (el) el.style.display = 'none';
  });
}
function closeOnBackdrop(overlayId) {
  var el = document.getElementById(overlayId);
  if (el) el.addEventListener('click', function (e) { if (e.target === el) el.style.display = 'none'; });
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' '), line = '', lineY = y;
  words.forEach(function (word) {
    var test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY); line = word; lineY += lineHeight;
    } else { line = test; }
  });
  if (line) ctx.fillText(line, x, lineY);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}
