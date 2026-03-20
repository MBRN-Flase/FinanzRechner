// ============================================================
//  MBRN FINANZ-RECHNER v1.1  –  app.js
//  Fixes: AbortSignal.timeout entfernt, defensive DOM-Zugriffe,
//         vollständiges DOMContentLoaded-Wrapping
//  Neu: Wow-Faktor im Ergebnis, bessere Insights
// ============================================================

'use strict';

const SCENARIOS = {
  'sp500':     { name: 'S&P 500',   rate: 0.102 },
  'world-etf': { name: 'World ETF', rate: 0.08  },
  'btc':       { name: 'Bitcoin',   rate: 0.60  },
  'savings':   { name: 'Sparkonto', rate: 0.005 },
};
const INFLATION = 0.038;

let activeScenario = 'sp500';
let lastResult     = null;

// ============================================================
//  INIT — alles innerhalb DOMContentLoaded
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  fetchPrices();
  updateYearsHint();
  bindEvents();

});

// ============================================================
//  LIVE PREISE  —  CoinGecko (Fix: kein AbortSignal.timeout)
// ============================================================

function fetchPrices() {
  // Manuelles Timeout via setTimeout statt AbortSignal.timeout
  // (AbortSignal.timeout nicht auf allen mobilen Browsern verfügbar)
  const controller = new AbortController();
  const timer      = setTimeout(function () { controller.abort(); }, 6000);

  fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
    { signal: controller.signal }
  )
    .then(function (res) {
      clearTimeout(timer);
      return res.json();
    })
    .then(function (data) {
      var btc = data && data.bitcoin  && data.bitcoin.eur;
      var eth = data && data.ethereum && data.ethereum.eur;

      var btcEl = document.getElementById('btc-price');
      var ethEl = document.getElementById('eth-price');
      if (btcEl && btc) btcEl.textContent = formatCurrency(btc);
      if (ethEl && eth) ethEl.textContent = formatCurrency(eth);

      var btcRate = document.querySelector('[data-scenario="btc"] .scenario-rate');
      if (btcRate && btc) btcRate.textContent = 'BTC @ ' + formatCurrencyShort(btc);
    })
    .catch(function () {
      clearTimeout(timer);
      var btcEl = document.getElementById('btc-price');
      var ethEl = document.getElementById('eth-price');
      if (btcEl) btcEl.textContent = '~84.000 €';
      if (ethEl) ethEl.textContent = '~2.000 €';
    });
}

// ============================================================
//  KERNBERECHNUNG
// ============================================================

function calculate() {
  try {
    var ageNowEl   = document.getElementById('age-now');
    var ageStartEl = document.getElementById('age-start');
    var monthlyEl  = document.getElementById('monthly');
    var lumpEl     = document.getElementById('lump');

    if (!ageNowEl || !ageStartEl || !monthlyEl) return;

    var ageNow   = parseInt(ageNowEl.value,   10) || 28;
    var ageStart = parseInt(ageStartEl.value, 10) || 18;
    var monthly  = parseFloat(monthlyEl.value)    || 200;
    var lump     = parseFloat(lumpEl ? lumpEl.value : 0) || 0;

    var years = ageNow - ageStart;
    if (years <= 0) {
      alert('Das Startalter muss kleiner als dein aktuelles Alter sein.');
      return;
    }

    var rendite  = SCENARIOS[activeScenario].rate;
    var yearlyIn = monthly * 12;

    var fiatVal   = lump;
    var investVal = lump;

    for (var i = 0; i < years; i++) {
      fiatVal   = (fiatVal   + yearlyIn) * (1 - INFLATION);
      investVal = (investVal + yearlyIn) * (1 + rendite);
    }

    var totalInvested = lump + yearlyIn * years;
    var gain          = investVal - totalInvested;
    var factor        = totalInvested > 0 ? investVal / totalInvested : 0;

    // Chart-Datenpunkte
    var chartData = [];
    var fv = lump, iv = lump;
    for (var y = 0; y <= years; y++) {
      chartData.push({ year: y, fiat: Math.round(fv), invest: Math.round(iv) });
      fv = (fv + yearlyIn) * (1 - INFLATION);
      iv = (iv + yearlyIn) * (1 + rendite);
    }

    lastResult = {
      fiatVal:       fiatVal,
      investVal:     investVal,
      totalInvested: totalInvested,
      gain:          gain,
      factor:        factor,
      years:         years,
      monthly:       monthly,
      lump:          lump,
      chartData:     chartData,
    };

    showResult(lastResult);

  } catch (err) {
    console.error('[FinanzRechner] Berechnungsfehler:', err);
  }
}

// ============================================================
//  ERGEBNIS ANZEIGEN
// ============================================================

function showResult(r) {
  var section = document.getElementById('result-section');
  if (!section) return;
  section.style.display = 'flex';

  // Hook-Nummer
  setText('hook-number', formatCurrency(r.investVal));
  setText('hook-sub',
    r.investVal > r.fiatVal
      ? 'statt ' + formatCurrency(r.fiatVal) + ' auf dem Konto.'
      : 'Mehr Zeit = mehr Wachstum.');

  // Vergleichskarten
  setText('val-fiat',    formatCurrency(r.fiatVal));
  setText('val-invest',  formatCurrency(r.investVal));
  setText('invest-label', SCENARIOS[activeScenario].name + ' · Investiert');

  // Details
  setText('detail-years',    r.years);
  setText('detail-invested', formatCurrencyShort(r.totalInvested));
  setText('detail-gain',     formatCurrencyShort(Math.max(0, r.gain)));
  setText('detail-factor',   r.factor.toFixed(1) + 'x');

  // Wow-Meter (visuell wie weit zwischen Fiat und Investment)
  updateWowMeter(r);

  // Insight
  setText('insight-text', buildInsight(r));

  // Share Preview
  setText('sp-number',   formatCurrency(r.investVal));
  setText('sp-fiat',     formatCurrencyShort(r.fiatVal));
  setText('sp-invest',   formatCurrencyShort(r.investVal));
  setText('sp-inv-label', SCENARIOS[activeScenario].name);
  setText('sp-sub',      'wenn du vor ' + r.years + ' Jahren angefangen hättest');

  // Chart
  drawChart(r.chartData);

  // Scroll
  setTimeout(function () {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
//  WOW-METER — zeigt wie weit man "besser" ist als Inflation
// ============================================================

function updateWowMeter(r) {
  var meterFill = document.getElementById('wow-fill');
  var meterLabel = document.getElementById('wow-label');
  if (!meterFill || !meterLabel) return;

  // Wie viel besser als Sparkonto? (max bei 20x → 100%)
  var pct = Math.min(100, Math.round(((r.factor - 1) / 19) * 100));
  meterFill.style.width = pct + '%';

  var labels = ['Besser als nichts', 'Solide', 'Gut', 'Sehr gut', 'Exzellent', 'Außergewöhnlich'];
  var idx    = Math.min(labels.length - 1, Math.floor(pct / 17));
  meterLabel.textContent = labels[idx] + ' (' + pct + '%)';
}

// ============================================================
//  INSIGHT TEXT
// ============================================================

function buildInsight(r) {
  var s    = SCENARIOS[activeScenario].name;
  var diff = formatCurrency(r.investVal - r.fiatVal);

  if (r.factor >= 10) {
    return 'Mit ' + s + ' hättest du dein Geld ver' + r.factor.toFixed(0) + 'facht. ' + diff + ' mehr als auf dem Konto — das ist kein Glück, das ist Zinseszins. Die beste Zeit anzufangen war damals. Die zweitbeste ist heute.';
  } else if (r.factor >= 3) {
    return diff + ' trennen die Entscheidung zu investieren von der Entscheidung es nicht zu tun. ' + s + ' über ' + r.years + ' Jahre macht aus monatlich ' + formatCurrencyShort(r.monthly) + ' ein echtes Vermögen.';
  } else {
    return 'Selbst ' + s + ' schlägt Inflation langfristig. ' + diff + ' Unterschied in ' + r.years + ' Jahren — bei nur ' + formatCurrencyShort(r.monthly) + ' monatlich.';
  }
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
  var h    = 180;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var padL = 16, padR = 16, padT = 20, padB = 28;
  var cW   = w - padL - padR;
  var cH   = h - padT - padB;

  var maxVal = Math.max.apply(null, data.map(function (d) { return d.invest; }));
  if (maxVal === 0) maxVal = 1;

  function xP(i)   { return padL + (i / (data.length - 1)) * cW; }
  function yP(val) { return padT + cH - (val / maxVal) * cH; }

  // Grid
  ctx.strokeStyle = 'rgba(100,80,200,0.08)';
  ctx.lineWidth   = 1;
  for (var g = 0; g <= 4; g++) {
    var gy = padT + (cH / 4) * g;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cW, gy); ctx.stroke();
  }

  // Fiat (gestrichelt, rot)
  ctx.beginPath();
  for (var fi = 0; fi < data.length; fi++) {
    if (fi === 0) ctx.moveTo(xP(fi), yP(data[fi].fiat));
    else          ctx.lineTo(xP(fi), yP(data[fi].fiat));
  }
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,107,107,0.55)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Invest-Fläche
  var grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
  grad.addColorStop(0, 'rgba(179,136,255,0.28)');
  grad.addColorStop(1, 'rgba(179,136,255,0.02)');
  ctx.beginPath();
  for (var ai = 0; ai < data.length; ai++) {
    if (ai === 0) ctx.moveTo(xP(ai), yP(data[ai].invest));
    else          ctx.lineTo(xP(ai), yP(data[ai].invest));
  }
  ctx.lineTo(xP(data.length - 1), padT + cH);
  ctx.lineTo(xP(0), padT + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Invest-Linie
  ctx.beginPath();
  for (var li = 0; li < data.length; li++) {
    if (li === 0) ctx.moveTo(xP(li), yP(data[li].invest));
    else          ctx.lineTo(xP(li), yP(data[li].invest));
  }
  ctx.strokeStyle = 'rgba(179,136,255,0.9)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Endwert Label
  if (data.length > 1) {
    var lastD = data[data.length - 1];
    ctx.fillStyle    = 'rgba(179,136,255,0.8)';
    ctx.font         = '700 10px Space Mono, monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatCurrencyShort(lastD.invest), padL + cW, yP(lastD.invest) - 4);
  }

  // X-Labels
  ctx.fillStyle    = 'rgba(232,232,240,0.3)';
  ctx.font         = '9px Space Mono, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  var labelIdxs = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  labelIdxs.forEach(function (i) {
    ctx.fillText('Jahr ' + data[i].year, xP(i), h - 4);
  });
}

// ============================================================
//  SHARE-CARD (Canvas 1080×1080)
// ============================================================

function generateShareImage() {
  if (!lastResult) { alert('Bitte zuerst berechnen.'); return; }
  var r    = lastResult;
  var size = 1080;
  var c    = document.createElement('canvas');
  c.width  = c.height = size;
  var ctx  = c.getContext('2d');

  // BG
  ctx.fillStyle = '#030014';
  ctx.fillRect(0, 0, size, size);

  var g1 = ctx.createRadialGradient(size, 0, 0, size, 0, 500);
  g1.addColorStop(0, 'rgba(157,80,187,0.35)'); g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#b388ff';
  ctx.fillRect(0, 0, size, 6);
  ctx.fillRect(0, size - 6, size, 6);

  ctx.fillStyle = 'rgba(179,136,255,0.55)';
  ctx.font      = '500 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WAS WÄRST DU HEUTE WERT? ✦ MBRN', size / 2, 68);

  // Hauptzahl
  var numText  = formatCurrency(r.investVal);
  var fontSize = 180;
  ctx.font = 'bold ' + fontSize + 'px sans-serif';
  while (ctx.measureText(numText).width > size * 0.82 && fontSize > 60) {
    fontSize -= 8;
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
  }
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(179,136,255,0.3)';
  ctx.shadowBlur   = 40;
  var tg = ctx.createLinearGradient(200, 0, size - 200, 0);
  tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#b388ff');
  ctx.fillStyle = tg;
  ctx.fillText(numText, size / 2, 330);
  ctx.shadowBlur = 0;

  ctx.fillStyle    = 'rgba(232,232,240,0.4)';
  ctx.font         = '400 26px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('wenn du vor ' + r.years + ' Jahren angefangen hättest', size / 2, 430);

  // Vergleichs-Boxen
  var bY = 480, bH = 130, bW = 420, gap = 36;
  var b1X = size / 2 - bW - gap / 2;
  var b2X = size / 2 + gap / 2;

  ctx.fillStyle = 'rgba(255,107,107,0.1)'; ctx.strokeStyle = 'rgba(255,107,107,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, b1X, bY, bW, bH, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.35)'; ctx.font = '400 16px monospace';
  ctx.fillText('FIAT · INFLATION', b1X + bW / 2, bY + 30);
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 34px sans-serif';
  ctx.fillText(formatCurrencyShort(r.fiatVal), b1X + bW / 2, bY + 82);

  ctx.fillStyle = 'rgba(79,255,176,0.1)'; ctx.strokeStyle = 'rgba(79,255,176,0.35)';
  roundRect(ctx, b2X, bY, bW, bH, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.35)'; ctx.font = '400 16px monospace';
  ctx.fillText(SCENARIOS[activeScenario].name.toUpperCase(), b2X + bW / 2, bY + 30);
  ctx.fillStyle = '#4fffb0'; ctx.font = 'bold 34px sans-serif';
  ctx.fillText(formatCurrencyShort(r.investVal), b2X + bW / 2, bY + 82);

  // Stats
  var sY  = 655;
  var stats = [
    { l: 'JAHRE',       v: r.years },
    { l: 'EINGEZAHLT',  v: formatCurrencyShort(r.totalInvested) },
    { l: 'GEWINN',      v: formatCurrencyShort(Math.max(0, r.gain)) },
    { l: 'FAKTOR',      v: r.factor.toFixed(1) + 'x' },
  ];
  var sw = (size - 120) / 4;
  stats.forEach(function (s, i) {
    var sx = 60 + i * sw;
    ctx.fillStyle = 'rgba(232,232,240,0.25)'; ctx.font = '400 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(s.l, sx + sw / 2, sY + 22);
    ctx.fillStyle = '#b388ff'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(s.v, sx + sw / 2, sY + 62);
  });

  // Insight
  var iY = 760;
  ctx.fillStyle = 'rgba(179,136,255,0.1)'; ctx.strokeStyle = 'rgba(179,136,255,0.2)';
  roundRect(ctx, 60, iY, size - 120, 116, 12, true, true);
  ctx.fillStyle = 'rgba(232,232,240,0.5)'; ctx.font = '400 19px monospace'; ctx.textAlign = 'center';
  wrapText(ctx, buildInsight(r), size / 2, iY + 40, size - 160, 32);

  ctx.fillStyle = 'rgba(179,136,255,0.4)'; ctx.font = '400 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io/FinanzRechner  ✦', size / 2, size - 22);

  var link = document.createElement('a');
  link.download = 'mbrn-finanz-rechner.png';
  link.href     = c.toDataURL('image/png');
  link.click();
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
//  EVENT BINDINGS
// ============================================================

function bindEvents() {

  // Szenarien
  var scenBtns = document.querySelectorAll('.scenario-btn');
  scenBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      scenBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeScenario = btn.getAttribute('data-scenario');
      updateScenarioNote();
      if (lastResult) calculate();
    });
  });

  // Alter → Jahre-Hint
  var ageNowEl   = document.getElementById('age-now');
  var ageStartEl = document.getElementById('age-start');
  if (ageNowEl)   ageNowEl.addEventListener('input',   updateYearsHint);
  if (ageStartEl) ageStartEl.addEventListener('input', updateYearsHint);

  // Enter = berechnen
  ['age-now', 'age-start', 'monthly', 'lump'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') calculate();
    });
  });

  // Berechnen
  var calcBtn = document.getElementById('btn-calculate');
  if (calcBtn) calcBtn.addEventListener('click', calculate);

  // Share Buttons
  var shareResultBtn = document.getElementById('btn-share-result');
  var saveImageBtn   = document.getElementById('btn-save-image');
  if (shareResultBtn) shareResultBtn.addEventListener('click', function () {
    var overlay = document.getElementById('share-overlay');
    if (overlay) overlay.style.display = 'flex';
  });
  if (saveImageBtn) saveImageBtn.addEventListener('click', generateShareImage);

  // Share Modal Buttons
  var btnWA   = document.getElementById('btn-wa');
  var btnTW   = document.getElementById('btn-tw');
  var btnCopy = document.getElementById('btn-copy');
  var btnDl   = document.getElementById('btn-dl');

  if (btnWA)   btnWA.addEventListener('click',   function () { window.open('https://wa.me/?text=' + encodeURIComponent(buildShareText()), '_blank'); });
  if (btnTW)   btnTW.addEventListener('click',   function () { window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildShareText()), '_blank'); });
  if (btnDl)   btnDl.addEventListener('click',   generateShareImage);
  if (btnCopy) btnCopy.addEventListener('click', function () {
    var url = window.location.href.split('?')[0];
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(function () { fallbackCopy(url); });
    } else {
      fallbackCopy(url);
    }
    btnCopy.textContent = '✓ Kopiert!';
    setTimeout(function () { btnCopy.innerHTML = '🔗 Link kopieren'; }, 2000);
  });

  // Modals schließen
  closeModal('share-close',   'share-overlay');
  closeModal('privacy-close', 'privacy-overlay');
  closeOnBackdrop('share-overlay');
  closeOnBackdrop('privacy-overlay');

  var privacyBtn = document.getElementById('btn-privacy');
  if (privacyBtn) privacyBtn.addEventListener('click', function () {
    var overlay = document.getElementById('privacy-overlay');
    if (overlay) overlay.style.display = 'flex';
  });

  // Escape
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['share-overlay', 'privacy-overlay'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  });
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
  if (el) el.addEventListener('click', function (e) {
    if (e.target === el) el.style.display = 'none';
  });
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

function updateYearsHint() {
  var ageNow   = parseInt((document.getElementById('age-now')   || {}).value, 10) || 0;
  var ageStart = parseInt((document.getElementById('age-start') || {}).value, 10) || 0;
  var years    = ageNow - ageStart;
  var el       = document.getElementById('years-hint');
  if (!el) return;
  if (years <= 0) el.textContent = '— Startalter muss kleiner als aktuelles Alter sein';
  else            el.textContent = '= ' + years + ' Jahre Wachstum verpasst';
}

function updateScenarioNote() {
  var notes = {
    'sp500':     '* S&P 500 historische Durchschnittsrendite 1957–2024.',
    'world-etf': '* MSCI World historische Durchschnittsrendite ~1970–2024.',
    'btc':       '* Bitcoin-Rendite basiert auf historischem Durchschnitt 2013–2024. Vergangene Performance ist keine Garantie.',
    'savings':   '* Sparkonto-Zinssatz geschätzt für Deutschland 2000–2024.',
  };
  var el = document.getElementById('scenario-disclaimer');
  if (el) el.textContent = notes[activeScenario] || '';
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(val);
}

function formatCurrencyShort(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
  if (val >= 1000)    return Math.round(val / 1000) + ' T€';
  return formatCurrency(val);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line  = '';
  var lineY = y;
  words.forEach(function (word) {
    var test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line  = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, lineY);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}
