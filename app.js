// ============================================================
//  MBRN FINANZ-RECHNER v1.3 — Final MVP
//  Neu: Auto-Neuberechnung (debounced), Jahrestabelle,
//       Kontext-Vergleich, Reverse-Rechner (Wann bin ich X?),
//       Animierter Zahlen-Counter, Chart-Milestones
// ============================================================
'use strict';

// Korrigierte Szenarien mit realistischeren Wachstumsraten
const SCENARIOS = {
  'sp500':     { name: 'S&P 500',   rate: 0.102, type: 'etf' },
  'world-etf': { name: 'World ETF', rate: 0.08,  type: 'etf' },
  'btc':       { name: 'Bitcoin',   rate: 0.25,  type: 'crypto' }, // Begrenzt auf 25% p.a. für realistischere Langzeit-Simulation
  'savings':   { name: 'Sparkonto', rate: 0.02,  type: 'cash' }, // Realistischerer Zins
};
const TAX_RATE_BASE = 0.26375; // 25% Abgeltungssteuer + 5.5% Soli
const FREIBETRAG = 1000;

let activeScenario = 'sp500';
let lastResult     = null;
let inflation      = 0.038;
let debounceTimer  = null;
let counterTimer   = null;
let chartResizeObserver = null;

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  fetchPrices();
  updateYearsHint();
  initSliders();
  bindEvents();
  initChartResizeObserver();
});

// ============================================================
//  CHART RESIZE OBSERVER
// ============================================================

function initChartResizeObserver() {
  const chartWrap = document.querySelector('.chart-wrap');
  if (!chartWrap) return;

  chartResizeObserver = new ResizeObserver(entries => {
    // Debounce the resize to prevent too many redraws
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (lastResult && lastResult.chartData) {
        drawChart(lastResult.chartData, lastResult.investVal);
      }
    }, 100);
  });

  chartResizeObserver.observe(chartWrap);
}

// ============================================================
//  TOAST
// ============================================================

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}

// ============================================================
//  LIVE PREISE
// ============================================================

function fetchPrices() {
  var ctrl  = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 6000);

  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
    { signal: ctrl.signal })
    .then(function (r) {
      clearTimeout(timer);
      if (!r.ok) {
        if (r.status === 429) throw new Error('rate_limit');
        throw new Error('api_error');
      }
      return r.json();
    })
    .then(function (d) {
      var btc = d && d.bitcoin  && d.bitcoin.eur;
      var eth = d && d.ethereum && d.ethereum.eur;
      setText('btc-price', btc ? formatCurrency(btc) : '~84.000 €');
      setText('eth-price', eth ? formatCurrency(eth) : '~2.000 €');
      if (btc) setText('btc-scenario-rate', 'BTC @ ' + formatCurrencyShort(btc));
    })
    .catch(function (e) {
      clearTimeout(timer);
      setText('btc-price', '~84.000 €');
      setText('eth-price', '~2.000 €');

      console.warn('CoinGecko API Fehler/Rate Limit. Nutze Fallback-Preise.');
      var tickerInner = document.getElementById('ticker-inner');
      if (tickerInner && !document.getElementById('api-warning')) {
        var warning = document.createElement('span');
        warning.id = 'api-warning';
        warning.className = 'ticker-label';
        warning.style.color = 'var(--gold)';
        warning.textContent = '(Fallback-Preise)';
        tickerInner.appendChild(warning);
      }
    });
}

// ============================================================
//  SLIDER INIT
// ============================================================

function initSliders() {
  linkSlider('slider-age-now',   'age-now',   'badge-age-now',   function(v){ return v+' Jahre'; });
  linkSlider('slider-age-start', 'age-start', 'badge-age-start', function(v){ return v+' Jahre'; });
  linkSlider('slider-monthly',   'monthly',   'badge-monthly',   function(v){ return v+' €'; });
  linkSlider('slider-dynamic',   'dynamic-rate', 'badge-dynamic', function(v){ return v+' %'; });
  document.querySelectorAll('.slider').forEach(function(sl){
    updateSliderFill(sl);
    sl.addEventListener('input', function(){ updateSliderFill(sl); });
  });
}

function linkSlider(slId, inId, badgeId, fmt) {
  var sl    = document.getElementById(slId);
  var input = document.getElementById(inId);
  var badge = document.getElementById(badgeId);
  if (!sl || !input) return;
  sl.addEventListener('input', function(){
    input.value = sl.value;
    if (badge) badge.textContent = fmt(sl.value);
    updateYearsHint();
    scheduleRecalc();
  });
  input.addEventListener('input', function(){
    sl.value = input.value;
    if (badge) badge.textContent = fmt(input.value);
    updateSliderFill(sl);
    updateYearsHint();
    scheduleRecalc();
  });
  if (badge) badge.textContent = fmt(input.value);
}

function updateSliderFill(sl) {
  var min = parseFloat(sl.min)||0, max = parseFloat(sl.max)||100;
  var pct = ((parseFloat(sl.value)||0) - min) / (max - min) * 100;
  sl.style.background = 'linear-gradient(90deg,#b388ff '+pct+'%,rgba(100,70,200,.2) '+pct+'%)';
}

// Debounced Auto-Neuberechnung (300ms nach letzter Änderung)
function scheduleRecalc() {
  if (!lastResult) return; // Nur neuberechnen wenn bereits ein Ergebnis vorhanden
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(calculate, 300);
}

// ============================================================
//  BERECHNUNG (KORRIGIERT)
// ============================================================

function calculate() {
  var ageNow   = parseInt(getVal('age-now'),   10) || 0;
  var ageStart = parseInt(getVal('age-start'), 10) || 0;
  var monthly  = parseFloat(getVal('monthly'))     || 0;
  var dynamicRate = parseFloat(getVal('dynamic-rate')) / 100 || 0;
  var lump     = parseFloat(getVal('lump'))         || 0;

  // Input Sanitization (Verhindere NaN oder Infinite)
  if (ageNow < 0) ageNow = 0;
  if (ageNow > 120) ageNow = 120;
  if (ageStart < 0) ageStart = 0;
  if (ageStart > 120) ageStart = 120;
  if (monthly < 0) monthly = 0;
  if (monthly > 10000000) monthly = 10000000;
  if (lump < 0) lump = 0;
  if (lump > 1000000000) lump = 1000000000;
  if (dynamicRate < 0) dynamicRate = 0;
  if (dynamicRate > 1) dynamicRate = 1;
  if (inflation < -0.1) inflation = -0.1;
  if (inflation > 1) inflation = 1;

  hideError('err-age');

  if (ageStart >= ageNow) {
    showError('err-age', 'Startalter muss kleiner als aktuelles Alter sein');
    showToast('⚠ Startalter muss kleiner als aktuelles Alter sein');
    return;
  }
  if (monthly <= 0 && lump <= 0) { showToast('⚠ Bitte einen Betrag eingeben'); return; }

  var years   = ageNow - ageStart;
  var rendite = SCENARIOS[activeScenario].rate;

  // Begrenze extreme Renditen für mathematische Stabilität
  if (rendite > 0.30) rendite = 0.30;

  setCalcLoading(true);

  setTimeout(function () {
    var investVal = lump;
    var totalInvested = lump;
    var totalMonths = years * 12;
    var currentMonthly = monthly;

    // Monatliche Rendite berechnen: (1 + r)^(1/12) - 1
    var monthlyRate = Math.pow(1 + rendite, 1 / 12) - 1;

    var chartData = [{ year:0, fiat:Math.round(lump), invest:Math.round(lump), total:Math.round(lump), milestone: null }];

    var mieteGedeckt = false;
    var zinseszins = false;

    for (var m = 1; m <= totalMonths; m++) {
      var startInvestVal = investVal;
      // Monatliche Einzahlung + Verzinsung (DCA)
      investVal = (investVal + currentMonthly) * (1 + monthlyRate);
      totalInvested += currentMonthly;

      // Daten für den Chart am Ende jedes Jahres sammeln
      if (m % 12 === 0) {
        var currentYear = m / 12;
        // Inflationsbereinigung
        var fiatReal = totalInvested / Math.pow(1 + inflation, currentYear); // Uninvestiertes Geld
        var investReal = investVal / Math.pow(1 + inflation, currentYear);   // Investiertes Geld (Kaufkraft)

        var milestone = null;

        // Meilenstein: Miete gedeckt (4% Entnahme > 1000€/Monat)
        if (!mieteGedeckt && (investReal * 0.04) / 12 > 1000) {
          milestone = 'Miete gedeckt';
          mieteGedeckt = true;
        }

        // Meilenstein: Zinseszinseffekt-Überholung (Zinsen > Sparrate)
        // Zinsen dieses Monats = (startInvestVal + currentMonthly) * monthlyRate
        var interestThisMonth = (startInvestVal + currentMonthly) * monthlyRate;
        if (!zinseszins && interestThisMonth > currentMonthly && currentMonthly > 0) {
          milestone = (milestone ? milestone + ' & ' : '') + 'Zinseszins > Sparrate';
          zinseszins = true;
        }

        // Korrektur: Wir speichern sowohl Real- als auch Nominalwerte, 
        // nutzen aber für den primären Vergleich (invest) den Realwert.
        chartData.push({
          year: currentYear,
          fiat: Math.round(fiatReal),      // Kaufkraft Bargeld
          invest: Math.round(investReal),  // Kaufkraft Investment (NEU: war vorher nominal)
          investNominal: Math.round(investVal), // Nominalwert für Details
          total: Math.round(totalInvested),
          milestone: milestone
        });

        // Sparraten-Dynamik: Jährliche Erhöhung der monatlichen Sparrate
        currentMonthly = currentMonthly * (1 + dynamicRate);
      }
    }

    // Endwert inflationsbereinigen für den Vergleich
    var fiatVal = totalInvested / Math.pow(1 + inflation, years); // Uninvestiert
    var realValue = investVal / Math.pow(1 + inflation, years);   // Investiert (Kaufkraft)

    var rawGain       = investVal - totalInvested;
    var taxable       = Math.max(0, rawGain - FREIBETRAG);

    // Steuerlogik basierend auf Asset-Klasse
    var afterTax = investVal;
    var effectiveTaxRate = 0;
    var taxType = SCENARIOS[activeScenario].type;

    if (taxType === 'etf') {
      // Aktien-ETFs: 30% Teilfreistellung -> 70% sind steuerpflichtig
      effectiveTaxRate = TAX_RATE_BASE * 0.7;
      afterTax = investVal - (taxable * effectiveTaxRate);
    } else if (taxType === 'crypto') {
      // Krypto: Nach 1 Jahr Haltefrist steuerfrei (vereinfachte Annahme für Sparplan > 1 Jahr)
      // Wir nehmen an, dass der Großteil steuerfrei ist, wenn years > 1
      if (years > 1) {
        effectiveTaxRate = 0;
        afterTax = investVal; // Steuerfrei
      } else {
        // Unter 1 Jahr: Persönlicher Einkommenssteuersatz (hier vereinfacht auf Base-Rate geschätzt)
        effectiveTaxRate = TAX_RATE_BASE;
        afterTax = investVal - (taxable * effectiveTaxRate);
      }
    } else {
      // Cash/Zinsen: Volle Abgeltungssteuer
      effectiveTaxRate = TAX_RATE_BASE;
      afterTax = investVal - (taxable * effectiveTaxRate);
    }

    var factor        = totalInvested > 0 ? investVal / totalInvested : 0;

    lastResult = {
      fiatVal:fiatVal, realValue:realValue, investVal:investVal, afterTax:afterTax,
      totalInvested:totalInvested, gain:rawGain, factor:factor,
      years:years, monthly:monthly, dynamicRate:dynamicRate, lump:lump, chartData:chartData,
      ageNow:ageNow, ageStart:ageStart, rendite:rendite,
      taxType: taxType, effectiveTaxRate: effectiveTaxRate
    };

    setCalcLoading(false);
    showResult(lastResult);
  }, 160);
}

// ============================================================
//  ERGEBNIS ANZEIGEN
// ============================================================

function showResult(r) {
  var section = document.getElementById('result-section');
  if (!section) return;
  section.style.display = 'flex';

  // Hero mit animiertem Counter
  animateCounter('hook-number', r.investVal);
  setText('hook-sub', 'Entspricht einer heutigen Kaufkraft von ca. ' + formatCurrency(r.realValue));

  // Steuer-Hint
  var taxHint = document.getElementById('tax-hint');
  if (taxHint) {
    if (r.taxType === 'crypto' && r.years > 1) {
      taxHint.style.display = 'inline-flex';
      setText('tax-after', 'Steuerfrei (Haltefrist > 1 Jahr)');
    } else if (r.gain > FREIBETRAG) {
      taxHint.style.display = 'inline-flex';
      var taxPercent = (r.effectiveTaxRate * 100).toFixed(1).replace('.0', '');
      var taxLabel = r.taxType === 'etf' ? `Nach ~${taxPercent}% Steuer (Teilfreistellung): ` : `Nach ~${taxPercent}% Steuer: `;
      setText('tax-after', taxLabel + formatCurrency(r.afterTax));
    } else {
      taxHint.style.display = 'none';
    }
  }

  // Kontext-Vergleich (neues Feature)
  renderContextBox(r.investVal);

  // Vergleich
  setText('val-fiat',    formatCurrency(r.fiatVal));
  setText('val-invest',  formatCurrency(r.investVal));
  setText('invest-label', SCENARIOS[activeScenario].name + ' · Investiert');

  // Details
  setText('detail-years',    r.years);
  setText('detail-invested', formatCurrencyShort(r.totalInvested));
  setText('detail-gain',     formatCurrencyShort(Math.max(0, r.gain)));
  setText('detail-factor',   r.factor.toFixed(1) + 'x');

  // Wow-Meter
  var fill   = document.getElementById('wow-fill');

  if (r.realValue < r.totalInvested * 1.05) {
    if (fill) {
      fill.style.width = '20%';
      fill.style.background = 'var(--gold)';
      fill.style.boxShadow = '0 0 10px var(--gold)';
    }
    setText('wow-label', 'Inflationsfalle ⚠️');
  } else {
    var pct    = Math.min(100, Math.round(((r.factor - 1) / 19) * 100));
    var labels = ['Besser als nichts','Solide','Gut','Sehr gut','Exzellent','Außergewöhnlich'];
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = 'var(--primary)';
      fill.style.boxShadow = '0 0 10px var(--primary)';
    }
    setText('wow-label', labels[Math.min(labels.length-1, Math.floor(pct/17))] + ' ('+pct+'%)');
  }

  // Insight
  setText('insight-text', buildInsight(r));

  // Chart
  drawChart(r.chartData, r.investVal);

  // Jahrestabelle (befüllen, nicht öffnen)
  fillYearTable(r);

  // Share Preview
  setText('sp-number',    formatCurrency(r.investVal));
  setText('sp-fiat',      formatCurrencyShort(r.fiatVal));
  setText('sp-invest',    formatCurrencyShort(r.investVal));
  setText('sp-inv-label', SCENARIOS[activeScenario].name);
  setText('sp-sub',       'wenn du vor '+r.years+' Jahren angefangen hättest');

  setTimeout(function () {
    section.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 130);
}

// ============================================================
//  ANIMIERTER COUNTER
// ============================================================

function animateCounter(id, targetVal) {
  var el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('animating');
  void el.offsetWidth;
  el.classList.add('animating');

  if (counterTimer) clearInterval(counterTimer);
  var start     = 0;
  var duration  = 800;
  var startTime = null;

  counterTimer = requestAnimationFrame(function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased    = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    var current  = Math.round(eased * targetVal);
    el.textContent = formatCurrency(current);
    if (progress < 1) counterTimer = requestAnimationFrame(step);
    else el.textContent = formatCurrency(targetVal);
  });
}

// ============================================================
//  KONTEXT-VERGLEICH (neues Feature)
// ============================================================

function renderContextBox(val) {
  var box  = document.getElementById('context-box');
  var grid = document.getElementById('context-grid');
  if (!box || !grid) return;

  var avgSalaryDE = 45000; // Brutto Durchschnittsgehalt DE
  var avgRentDE   = 12000; // 1.000 €/Monat Miete × 12
  var carAvg      = 35000; // Durchschnittlicher Neuwagen

  var items = [
    { emoji:'💰', label:'Jahresgehälter (DE)', val: Math.round(val / avgSalaryDE * 10) / 10 },
    { emoji:'🏠', label:'Jahre Miete (ø DE)',  val: Math.round(val / avgRentDE * 10) / 10 },
    { emoji:'🚗', label:'Durchschnittliche Neuwagen', val: Math.round(val / carAvg) },
    { emoji:'✈️', label:'Weltreisen (ca. 5.000€)', val: Math.round(val / 5000) },
  ];

  grid.innerHTML = items.map(function(item) {
    return '<div class="context-item">' +
      '<span class="context-emoji">'+item.emoji+'</span>' +
      '<div class="context-text">' +
        '<strong>' + formatNum(item.val) + (item.val % 1 !== 0 ? '' : '') + '</strong>' +
        item.label +
      '</div>' +
    '</div>';
  }).join('');
}

function formatNum(n) {
  if (n >= 1000) return Math.round(n).toLocaleString('de-DE') + ' ×';
  if (n % 1 === 0) return n + ' ×';
  return n.toFixed(1) + ' ×';
}

// ============================================================
//  JAHRESTABELLE (neues Feature)
// ============================================================

function fillYearTable(r) {
  var tbody = document.getElementById('year-table-body');
  if (!tbody) return;

  var ageStart    = r.ageStart;
  var milestones  = [100000, 250000, 500000, 1000000, 5000000];
  var passedMiles = {};

  tbody.innerHTML = r.chartData.map(function(d) {
    var gain       = d.invest - d.total;
    var isMile     = false;

    milestones.forEach(function(m) {
      if (d.invest >= m && !passedMiles[m]) {
        passedMiles[m] = true; isMile = true;
      }
    });

    return '<tr class="'+(isMile?'milestone-row':'')+'">' +
      '<td>'+d.year+'</td>' +
      '<td>'+(ageStart+d.year)+'</td>' +
      '<td>'+formatCurrencyShort(d.total)+'</td>' +
      '<td class="col-invest">'+formatCurrencyShort(d.invest)+'</td>' +
      '<td>'+formatCurrencyShort(d.fiat)+'</td>' +
      '<td class="col-gain">'+(gain>0?'+':'')+formatCurrencyShort(gain)+'</td>' +
    '</tr>';
  }).join('');
}

// ============================================================
//  REVERSE-RECHNER: Wann bin ich Millionär?
// ============================================================

function calculateReverse() {
  if (!lastResult) { showToast('⚠ Bitte zuerst berechnen'); return; }

  var targetEl = document.getElementById('target-amount');
  var target   = parseFloat(targetEl ? targetEl.value : 0) || 1000000;
  var r        = lastResult;
  var rendite  = r.rendite;
  var monthly  = r.monthly;
  var dynamicRate = r.dynamicRate || 0;
  var lump     = r.lump;

  var val      = lump;
  var years    = 0;
  var maxYears = 200;
  var currentMonthly = monthly;

  var monthlyRate = Math.pow(1 + rendite, 1 / 12) - 1;

  while (val < target && years < maxYears) {
    // Monatliche Berechnung für Genauigkeit
    for(var m=0; m<12; m++) {
      val = (val + currentMonthly) * (1 + monthlyRate);
    }
    currentMonthly = currentMonthly * (1 + dynamicRate);
    years++;
  }

  var resultEl = document.getElementById('reverse-result');
  var textEl   = document.getElementById('reverse-result-text');
  if (!resultEl || !textEl) return;
  resultEl.style.display = 'block';

  if (years >= maxYears) {
    textEl.innerHTML = 'Mit diesem Szenario und ' + formatCurrencyShort(monthly) + '/Monat ist das Ziel von ' + formatCurrency(target) + ' rechnerisch nicht erreichbar. Erhöhe den monatlichen Betrag oder wähle ein renditereicheres Szenario.';
  } else {
    var reachAge = r.ageStart + years;
    var now      = r.ageNow;
    var futureYears = years - r.years;

    if (futureYears <= 0) {
      textEl.innerHTML = '✦ Du hättest das Ziel von <strong>' + formatCurrency(target) + '</strong> bereits nach <strong>' + years + ' Jahren</strong> (mit ' + reachAge + ') erreicht — wenn du damals gestartet wärst.';
    } else {
      textEl.innerHTML = '✦ Du erreichst <strong>' + formatCurrency(target) + '</strong> in weiteren <strong>' + futureYears + ' Jahren</strong> (mit ' + (now + futureYears) + ') — wenn du <strong>jetzt</strong> mit ' + formatCurrencyShort(monthly) + '/Monat startest.';
    }
  }
}

// ============================================================
//  CHART (mit Milestone-Linien)
// ============================================================

function drawChart(data, maxInvest) {
  var canvas = document.getElementById('growth-chart');
  if (!canvas || !canvas.getContext) return;
  var ctx  = canvas.getContext('2d');

  // Clear canvas for redraw (prevents memory leaks / overdrawing)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var dpr  = window.devicePixelRatio || 1;
  var w    = canvas.parentElement.clientWidth || 300;
  var h    = 200;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var pL=18, pR=22, pT=18, pB=26;
  var cW=w-pL-pR, cH=h-pT-pB;
  var maxV = Math.max.apply(null, data.map(function(d){return d.invest;})) || 1;

  function xP(i)   { return pL + (i/Math.max(data.length-1,1))*cW; }
  function yP(v)   { return pT + cH - (v/maxV)*cH; }

  // Grid-Linien
  ctx.strokeStyle='rgba(100,70,200,.07)'; ctx.lineWidth=1;
  for(var g=0;g<=4;g++){
    var gy=pT+(cH/4)*g;
    ctx.beginPath();ctx.moveTo(pL,gy);ctx.lineTo(pL+cW,gy);ctx.stroke();
  }

  // Milestone-Linien (100k, 500k, 1M, etc.)
  var milestones=[100000,500000,1000000,5000000];
  milestones.forEach(function(m){
    if(m>maxV*1.1) return;
    var my=yP(m);
    ctx.strokeStyle='rgba(179,136,255,.12)';ctx.lineWidth=1;
    ctx.setLineDash([3,5]);
    ctx.beginPath();ctx.moveTo(pL,my);ctx.lineTo(pL+cW,my);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(179,136,255,.4)';ctx.font='8px Space Mono,monospace';
    ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.fillText(formatCurrencyShort(m),pL+cW,my-2);
  });

  // Fiat (gestrichelt)
  ctx.beginPath();
  data.forEach(function(d,i){
    if(i===0)ctx.moveTo(xP(i),yP(d.fiat));else ctx.lineTo(xP(i),yP(d.fiat));
  });
  ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(255,107,107,.52)';ctx.lineWidth=1.5;
  ctx.stroke();ctx.setLineDash([]);

  // Invest-Fläche
  var gr=ctx.createLinearGradient(0,pT,0,pT+cH);
  gr.addColorStop(0,'rgba(179,136,255,.26)');gr.addColorStop(1,'rgba(179,136,255,.02)');
  ctx.beginPath();
  data.forEach(function(d,i){
    if(i===0)ctx.moveTo(xP(i),yP(d.invest));else ctx.lineTo(xP(i),yP(d.invest));
  });
  ctx.lineTo(xP(data.length-1),pT+cH);ctx.lineTo(xP(0),pT+cH);ctx.closePath();
  ctx.fillStyle=gr;ctx.fill();

  // Invest-Linie
  ctx.beginPath();
  data.forEach(function(d,i){
    if(i===0)ctx.moveTo(xP(i),yP(d.invest));else ctx.lineTo(xP(i),yP(d.invest));
  });
  ctx.strokeStyle='rgba(179,136,255,.9)';ctx.lineWidth=2;ctx.stroke();

  // Endwert Label
  if(data.length>1){
    var last=data[data.length-1];
    ctx.fillStyle='rgba(179,136,255,.85)';ctx.font='700 9px Space Mono,monospace';
    ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.fillText(formatCurrencyShort(last.invest),pL+cW,yP(last.invest)-4);
  }

  // X-Labels
  ctx.fillStyle='rgba(234,234,244,.28)';ctx.font='8px Space Mono,monospace';
  ctx.textAlign='center';ctx.textBaseline='bottom';
  [0,Math.floor((data.length-1)/2),data.length-1].forEach(function(i){
    ctx.fillText('Jahr '+data[i].year,xP(i),h-3);
  });

  // Psychologische Meilensteine (Miete gedeckt, Zinseszins > Sparrate)
  data.forEach(function(d, i) {
    if (d.milestone) {
      var mx = xP(i);
      var my = yP(d.invest);

      // Punkt zeichnen
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'var(--gold)';
      ctx.fill();
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text zeichnen
      ctx.fillStyle = 'var(--gold)';
      ctx.font = '700 8px Space Mono,monospace';
      ctx.textAlign = (i > data.length * 0.7) ? 'right' : 'left'; // Verhindern, dass Text abgeschnitten wird
      var textX = (i > data.length * 0.7) ? mx - 6 : mx + 6;
      ctx.fillText(d.milestone, textX, my - 6);
    }
  });
}

// ============================================================
//  INSIGHT TEXT
// ============================================================

function buildInsight(r) {
  var s    = SCENARIOS[activeScenario].name;
  var diff = formatCurrency(r.investVal - r.fiatVal);
  var base;

  if(r.factor>=10){
    base='Mit '+s+' hättest du dein Kapital ver'+r.factor.toFixed(0)+'facht — '+diff+' mehr als auf dem Konto. Das ist kein Zufall, das ist Zinseszins über Zeit.';
  }else if(r.factor>=3){
    base=diff+' trennen die Entscheidung zu investieren von der Entscheidung es nicht zu tun. '+r.years+' Jahre, '+formatCurrencyShort(r.monthly)+'/Monat.';
  }else{
    base='Selbst '+s+' schlägt Inflation in '+r.years+' Jahren deutlich — '+diff+' Unterschied bei nur '+formatCurrencyShort(r.monthly)+'/Monat.';
  }

  if(activeScenario==='btc'){
    base+=' ⚠ Bitcoin: historische ø-Rendite 60%/Jahr. Zukünftig deutlich moderater wahrscheinlich — nur mit Geld investieren, dessen Verlust du verkraften könntest.';
  }
  return base;
}

// ============================================================
//  SHARE IMAGE
// ============================================================

function generateShareImage(fmt) {
  if(!lastResult){showToast('⚠ Bitte zuerst berechnen');return;}
  var r=lastResult,isStory=fmt==='story';
  var W=1080,H=isStory?1920:1080;
  var c=document.createElement('canvas');
  c.width=W;c.height=H;
  var ctx=c.getContext('2d');

  // BG
  ctx.fillStyle='#030014';ctx.fillRect(0,0,W,H);
  var g1=ctx.createRadialGradient(W,0,0,W,0,600);
  g1.addColorStop(0,'rgba(157,80,187,.35)');g1.addColorStop(1,'transparent');
  ctx.fillStyle=g1;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#b388ff';ctx.fillRect(0,0,W,6);ctx.fillRect(0,H-6,W,6);

  if(isStory) drawStoryCard(ctx,r,W,H);
  else        drawPostCard(ctx,r,W,H);

  var a=document.createElement('a');
  a.download=isStory?'mbrn-finanz-story.png':'mbrn-finanz-post.png';
  a.href=c.toDataURL('image/png');a.click();
}

function drawPostCard(ctx,r,W,H){
  var cx=W/2;
  ctx.fillStyle='rgba(179,136,255,.55)';ctx.font='500 24px monospace';
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText('WAS WÄRST DU HEUTE WERT? ✦ MBRN',cx,68);

  var nTxt=formatCurrency(r.investVal),fs=180;
  ctx.font='bold '+fs+'px sans-serif';
  while(ctx.measureText(nTxt).width>W*.82&&fs>60){fs-=8;ctx.font='bold '+fs+'px sans-serif';}
  ctx.textBaseline='middle';ctx.shadowColor='rgba(179,136,255,.3)';ctx.shadowBlur=40;
  var tg=ctx.createLinearGradient(200,0,W-200,0);
  tg.addColorStop(0,'#fff');tg.addColorStop(1,'#b388ff');
  ctx.fillStyle=tg;ctx.fillText(nTxt,cx,330);ctx.shadowBlur=0;

  ctx.fillStyle='rgba(234,234,244,.4)';ctx.font='400 26px monospace';ctx.textBaseline='alphabetic';
  ctx.fillText('wenn du vor '+r.years+' Jahren angefangen hättest',cx,430);

  var bW=420,bH=130,gap=36,bY=480;
  var b1x=cx-bW-gap/2,b2x=cx+gap/2;
  drawBox(ctx,'rgba(255,107,107,.1)','rgba(255,107,107,.35)',b1x,bY,bW,bH,'FIAT · INFLATION','#ff6b6b',formatCurrencyShort(r.fiatVal),36);
  drawBox(ctx,'rgba(79,255,176,.1)','rgba(79,255,176,.35)',b2x,bY,bW,bH,SCENARIOS[activeScenario].name.toUpperCase(),'#4fffb0',formatCurrencyShort(r.investVal),36);
  drawStats(ctx,r,W,656);
  drawInsBox(ctx,r,W,760,116);
  ctx.fillStyle='rgba(179,136,255,.4)';ctx.font='400 18px monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io/FinanzRechner  ✦',cx,H-22);
}

function drawStoryCard(ctx,r,W,H){
  var cx=W/2;
  ctx.fillStyle='rgba(179,136,255,.6)';ctx.font='500 26px monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText('✦ MBRN · FINANZ-RECHNER ✦',cx,100);
  ctx.fillStyle='rgba(234,234,244,.85)';ctx.font='bold 50px sans-serif';
  ctx.fillText('Was wärst du heute',cx,200);ctx.fillText('wert?',cx,265);

  var nTxt=formatCurrency(r.investVal),fs=140;
  ctx.font='bold '+fs+'px sans-serif';
  while(ctx.measureText(nTxt).width>W*.85&&fs>60){fs-=8;ctx.font='bold '+fs+'px sans-serif';}
  ctx.textBaseline='middle';ctx.shadowColor='rgba(179,136,255,.4)';ctx.shadowBlur=50;
  var tg=ctx.createLinearGradient(100,0,W-100,0);tg.addColorStop(0,'#fff');tg.addColorStop(1,'#b388ff');
  ctx.fillStyle=tg;ctx.fillText(nTxt,cx,430);ctx.shadowBlur=0;
  ctx.fillStyle='rgba(234,234,244,.5)';ctx.font='400 28px monospace';ctx.textBaseline='alphabetic';
  ctx.fillText('bei '+r.years+' Jahren '+SCENARIOS[activeScenario].name,cx,530);

  var bW=380,bH=155,gap=36,bY=598;
  drawBox(ctx,'rgba(255,107,107,.1)','rgba(255,107,107,.35)',cx-bW-gap/2,bY,bW,bH,'FIAT · INFLATION','#ff6b6b',formatCurrencyShort(r.fiatVal),42);
  drawBox(ctx,'rgba(79,255,176,.1)','rgba(79,255,176,.35)',cx+gap/2,bY,bW,bH,SCENARIOS[activeScenario].name.toUpperCase(),'#4fffb0',formatCurrencyShort(r.investVal),42);
  drawStats(ctx,r,W,822);

  ctx.fillStyle='rgba(179,136,255,.12)';ctx.strokeStyle='rgba(179,136,255,.3)';ctx.lineWidth=1;
  roundRect(ctx,80,1080,W-160,165,18,true,true);
  ctx.fillStyle='#b388ff';ctx.font='bold 28px sans-serif';ctx.textBaseline='middle';ctx.textAlign='center';
  ctx.fillText('Berechne dein Ergebnis:',cx,1142);
  ctx.fillStyle='rgba(234,234,244,.7)';ctx.font='400 22px monospace';
  ctx.fillText('flase-mbrn.github.io/FinanzRechner',cx,1196);

  drawInsBox(ctx,r,W,1310,200);
  ctx.fillStyle='rgba(179,136,255,.4)';ctx.font='400 22px monospace';ctx.textBaseline='alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io  ✦',cx,H-22);
}

function drawBox(ctx,fill,stroke,x,y,w,h,label,valColor,valText,fs){
  ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;
  roundRect(ctx,x,y,w,h,12,true,true);
  ctx.fillStyle='rgba(234,234,244,.35)';ctx.font='400 17px monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText(label,x+w/2,y+30);
  ctx.fillStyle=valColor;ctx.font='bold '+fs+'px sans-serif';ctx.textBaseline='middle';
  ctx.fillText(valText,x+w/2,y+h*.65);
}

function drawStats(ctx,r,W,y){
  var stats=[{l:'JAHRE',v:r.years},{l:'EINGEZAHLT',v:formatCurrencyShort(r.totalInvested)},{l:'GEWINN',v:formatCurrencyShort(Math.max(0,r.gain))},{l:'FAKTOR',v:r.factor.toFixed(1)+'x'}];
  var sw=(W-120)/4;
  stats.forEach(function(s,i){
    var sx=60+i*sw;
    ctx.fillStyle='rgba(234,234,244,.25)';ctx.font='400 15px monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.fillText(s.l,sx+sw/2,y+22);
    ctx.fillStyle='#b388ff';ctx.font='bold 28px sans-serif';ctx.textBaseline='middle';
    ctx.fillText(s.v,sx+sw/2,y+62);
  });
}

function drawInsBox(ctx,r,W,y,boxH){
  ctx.fillStyle='rgba(179,136,255,.1)';ctx.strokeStyle='rgba(179,136,255,.2)';ctx.lineWidth=1;
  roundRect(ctx,60,y,W-120,boxH,12,true,true);
  ctx.fillStyle='rgba(234,234,244,.5)';ctx.font='400 19px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  var ins=buildInsight(r);if(ins.length>170)ins=ins.substring(0,167)+'…';
  wrapText(ctx,ins,W/2,y+boxH/2-16,W-160,32);
}

// ============================================================
//  SHARE TEXT
// ============================================================

function buildShareText(){
  if(!lastResult)return'';
  var r=lastResult,url=window.location.href.split('?')[0];
  return[
    '💸 Was wärst du heute wert, wenn du früher investiert hättest?',
    'Ich hab es durchgerechnet: '+SCENARIOS[activeScenario].name+' über '+r.years+' Jahre → '+formatCurrency(r.investVal),
    'Statt '+formatCurrencyShort(r.fiatVal)+' auf dem Konto. Unterschied: '+formatCurrency(r.investVal-r.fiatVal),
    '👉 '+url,
    '#Investieren #FinanzielleFreiheit #MBRN #Vermögensaufbau',
  ].join('\n');
}

// ============================================================
//  EVENTS
// ============================================================

function bindEvents(){

  // Szenarien
  document.querySelectorAll('.scenario-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.scenario-btn').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      activeScenario=btn.getAttribute('data-scenario');
      updateScenarioNote();
      if(lastResult)calculate();
    });
  });

  // Alter → Hint
  ['age-now','age-start'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('input',updateYearsHint);
  });

  // Enter
  ['age-now','age-start','monthly','dynamic-rate','lump','inflation-input'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('keydown',function(e){if(e.key==='Enter')calculate();});
  });

  // Inflation Presets
  document.querySelectorAll('.inf-preset').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.inf-preset').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      inflation=parseFloat(btn.getAttribute('data-val'));
      var el=document.getElementById('inflation-input');
      if(el)el.value=(inflation*100).toFixed(1);
      setText('inflation-display','+'+(inflation*100).toFixed(1)+'%/Jahr');
      if(lastResult)calculate();
    });
  });

  // Custom Inflation
  var inflEl=document.getElementById('inflation-input');
  if(inflEl)inflEl.addEventListener('input',function(){
    var v=parseFloat(inflEl.value);
    if(!isNaN(v)&&v>=0&&v<=20){
      inflation=v/100;
      document.querySelectorAll('.inf-preset').forEach(function(b){b.classList.remove('active');});
      setText('inflation-display','+'+v.toFixed(1)+'%/Jahr');
      scheduleRecalc();
    }
  });

  // Berechnen
  var calcBtn=document.getElementById('btn-calculate');
  if(calcBtn)calcBtn.addEventListener('click',calculate);

  // Jahrestabelle toggle
  var toggleBtn=document.getElementById('btn-toggle-table');
  var tableWrap=document.getElementById('year-table-wrap');
  var toggleIcon=document.getElementById('table-toggle-icon');
  if(toggleBtn&&tableWrap){
    toggleBtn.addEventListener('click',function(){
      var open=tableWrap.style.display==='none';
      tableWrap.style.display=open?'block':'none';
      if(toggleIcon)toggleIcon.textContent=open?'▼':'▶';
      toggleBtn.textContent=(open?'▼ ':'▶ ')+'Jahres-Übersicht '+(open?'ausblenden':'anzeigen');
    });
  }

  // Reverse-Rechner
  var revBtn=document.getElementById('btn-reverse');
  if(revBtn)revBtn.addEventListener('click',calculateReverse);
  var revInput=document.getElementById('target-amount');
  if(revInput)revInput.addEventListener('keydown',function(e){if(e.key==='Enter')calculateReverse();});

  // Share
  bind('btn-share-result',function(){
    if(!lastResult){showToast('⚠ Bitte zuerst berechnen');return;}
    var o=document.getElementById('share-overlay');if(o)o.style.display='flex';
  });
  bind('btn-save-image',  function(){generateShareImage('post');});
  bind('btn-save-story',  function(){generateShareImage('story');});
  bind('btn-dl',          function(){generateShareImage('post');});
  bind('btn-story-modal', function(){generateShareImage('story');});
  bind('btn-wa',          function(){window.open('https://wa.me/?text='+encodeURIComponent(buildShareText()),'_blank');});
  bind('btn-tw',          function(){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(buildShareText()),'_blank');});
  bind('btn-copy',        function(){
    var url=window.location.href.split('?')[0];
    if(navigator.clipboard)navigator.clipboard.writeText(url).catch(function(){fallbackCopy(url);});
    else fallbackCopy(url);
    setText('btn-copy','✓ Kopiert!');
    setTimeout(function(){setText('btn-copy','🔗 Link kopieren');},2000);
  });

  // Modals
  closeModal('share-close','share-overlay');
  closeModal('privacy-close','privacy-overlay');
  closeBackdrop('share-overlay');
  closeBackdrop('privacy-overlay');
  bind('btn-privacy',function(){var o=document.getElementById('privacy-overlay');if(o)o.style.display='flex';});

  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    ['share-overlay','privacy-overlay'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.style.display='none';
    });
  });
}

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

function setCalcLoading(on){
  var btn=document.getElementById('btn-calculate');
  var icon=document.getElementById('calc-icon');
  var txt=document.getElementById('calc-text');
  if(!btn)return;
  if(on){btn.classList.add('loading');if(icon)icon.style.animation='spin 1s linear infinite';if(txt)txt.textContent='Berechne…';}
  else{btn.classList.remove('loading');if(icon){icon.style.animation='';icon.textContent='✦';}if(txt)txt.textContent='Jetzt berechnen';}
}

function showError(id,msg){var el=document.getElementById(id);if(el){el.textContent='⚠ '+msg;el.style.display='block';}}
function hideError(id){var el=document.getElementById(id);if(el)el.style.display='none';}

function updateYearsHint(){
  var n=parseInt(getVal('age-now'),10)||0,s=parseInt(getVal('age-start'),10)||0;
  var el=document.getElementById('years-hint');if(!el)return;
  var y=n-s;
  el.textContent=y<=0?'— Startalter muss kleiner als aktuelles Alter sein':'= '+y+' Jahre Wachstum verpasst';
}

function updateScenarioNote(){
  var notes={'sp500':'Historische Durchschnittsrendite S&P 500 (1957–2024). Vergangene Performance ist keine Garantie.','world-etf':'MSCI World historische Durchschnittsrendite (~1970–2024). Vergangene Performance ist keine Garantie.','btc':'Bitcoin ø 25%/Jahr (konservative Simulation). Hochspekulativ — bei steigender Marktkapitalisierung deutlich geringere Renditen wahrscheinlich.','savings':'Sparkonto DE geschätzter Schnitt 2000–2024.'};
  var el=document.getElementById('scenario-disclaimer');if(el)el.textContent=notes[activeScenario]||'';
}

function getVal(id){var el=document.getElementById(id);return el?el.value:'';}
function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
function bind(id,fn){var el=document.getElementById(id);if(el)el.addEventListener('click',fn);}

function closeModal(btnId,overlayId){
  var btn=document.getElementById(btnId);
  if(btn)btn.addEventListener('click',function(){var el=document.getElementById(overlayId);if(el)el.style.display='none';});
}
function closeBackdrop(overlayId){
  var el=document.getElementById(overlayId);
  if(el)el.addEventListener('click',function(e){if(e.target===el)el.style.display='none';});
}
function fallbackCopy(text){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}

function formatCurrency(v){return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);}
function formatCurrencyShort(v){
  if(v>=1000000)return(v/1000000).toFixed(1).replace('.',',')+' Mio. €';
  if(v>=1000)return Math.round(v/1000)+' T€';
  return formatCurrency(v);
}

function wrapText(ctx,text,x,y,maxW,lh){
  var words=text.split(' '),line='',ly=y;
  words.forEach(function(w){
    var t=line+(line?' ':'')+w;
    if(ctx.measureText(t).width>maxW&&line){ctx.fillText(line,x,ly);line=w;ly+=lh;}else line=t;
  });
  if(line)ctx.fillText(line,x,ly);
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill)ctx.fill();if(stroke)ctx.stroke();
}
