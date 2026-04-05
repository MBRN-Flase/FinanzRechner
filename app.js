// MBRN FINANZ-RECHNER v1.4 — Security Enhanced

'use strict';

// ═══════════════════════════════════════════════════════════
// SECURITY UTILITIES
// ═══════════════════════════════════════════════════════════

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeSetText(elementOrId, text) {
  const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!element) return;
  element.textContent = String(text ?? '');
}

function safeClear(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// ═══════════════════════════════════════════════════════════
// END SECURITY UTILITIES
// ═══════════════════════════════════════════════════════════

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
let lastResult = null;
let inflation = 0.038;
let debounceTimer = null;
let counterTimer = null;
let chartResizeObserver = null;

// //  INIT
// 
document.addEventListener('DOMContentLoaded', function () {
  fetchPrices();
  updateYearsHint();
  initSliders();
  bindEvents();
  initChartResizeObserver();
  updateScenarioNote();
});

// //  CHART RESIZE OBSERVER
// 
function initChartResizeObserver() {
  const chartWrap = document.querySelector('.chart-wrap');
  if (!chartWrap) return;

  chartResizeObserver = new ResizeObserver(entries => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (lastResult && lastResult.chartData) {
        drawChart(lastResult.chartData, lastResult.investVal);
      }
    }, 100);
  });

  chartResizeObserver.observe(chartWrap);
}

// //  TOAST
// 
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}

// //  LIVE PREISE mit Validierung
// 
async function fetchPrices() {
  // Prüfe ob Validator verfügbar
  if (typeof CoinGeckoValidator === 'undefined') {
    logger.warn('[FinanzRechner] CoinGeckoValidator nicht geladen, nutze Standard-Fetch');
    fetchPricesLegacy();
    return;
  }

  const result = await CoinGeckoValidator.fetchSecure(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
    { timeout: 8000 }
  );

  if (result.success) {
    const data = result.data;
    const btc = data.bitcoin.eur;
    const eth = data.ethereum.eur;
    
    setText('btc-price', formatCurrency(btc));
    setText('eth-price', formatCurrency(eth));
    setText('btc-scenario-rate', 'BTC @ ' + formatCurrencyShort(btc));
    
    if (result.warnings && result.warnings.length > 0) {
      window.logger.warn('[FinanzRechner] Preis-Warnungen:', result.warnings);
    }
  } else {
    window.logger.warn('[FinanzRechner] API Fehler:', result.error);
    setText('btc-price', '~84.000 €');
    setText('eth-price', '~2.000 €');
    
    var tickerInner = document.getElementById('ticker-inner');
    if (tickerInner && !document.getElementById('api-warning')) {
      var warning = document.createElement('span');
      warning.id = 'api-warning';
      warning.className = 'ticker-label';
      warning.style.color = 'var(--gold)';
      warning.textContent = '(Fallback-Preise)';
      tickerInner.appendChild(warning);
    }
  }
}

// Legacy Fallback ohne Validator
function fetchPricesLegacy() {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 6000);

  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur',
    { signal: ctrl.signal })
    .then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('api_error');
      return r.json();
    })
    .then(function (d) {
      var btc = d && d.bitcoin && d.bitcoin.eur;
      var eth = d && d.ethereum && d.ethereum.eur;
      setText('btc-price', btc ? formatCurrency(btc) : '~84.000 €');
      setText('eth-price', eth ? formatCurrency(eth) : '~2.000 €');
    })
    .catch(function () {
      clearTimeout(timer);
      setText('btc-price', '~84.000 €');
      setText('eth-price', '~2.000 €');
    });
}

// //  SLIDER INIT
// 
function initSliders() {
  linkSlider('slider-age-now',   'age-now',     'badge-age-now',   function(v){ return v + ' Jahre'; });
  linkSlider('slider-age-start', 'age-start',   'badge-age-start', function(v){ return v + ' Jahre'; });
  linkSlider('slider-monthly',   'monthly',     'badge-monthly',   function(v){ return v + ' €'; });
  linkSlider('slider-dynamic',   'dynamic-rate','badge-dynamic',   function(v){ return v + ' %'; });

  document.querySelectorAll('.slider').forEach(function(sl) {
    updateSliderFill(sl);
    sl.addEventListener('input', function(){ updateSliderFill(sl); });
  });
}

function linkSlider(slId, inId, badgeId, fmt) {
  var sl = document.getElementById(slId);
  var input = document.getElementById(inId);
  var badge = document.getElementById(badgeId);
  if (!sl || !input) return;

  // CountUp animation state
  var currentBadgeValue = parseInt(input.value) || 0;
  var badgeAnimationId = null;

  function animateBadge(from, to, duration) {
    if (!badge) return;
    var startTime = null;
    if (badgeAnimationId) cancelAnimationFrame(badgeAnimationId);
    
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out
      var current = Math.round(from + (to - from) * eased);
      badge.textContent = fmt(current);
      if (progress < 1) {
        badgeAnimationId = requestAnimationFrame(step);
      }
    }
    badgeAnimationId = requestAnimationFrame(step);
  }

  sl.addEventListener('input', function() {
    var newValue = parseInt(sl.value) || 0;
    input.value = sl.value;
    animateBadge(currentBadgeValue, newValue, 200);
    currentBadgeValue = newValue;
    updateYearsHint();
    updateDynamicHint(newValue);
    scheduleRecalc();
  });

  input.addEventListener('input', function() {
    var newValue = parseInt(input.value) || 0;
    sl.value = input.value;
    animateBadge(currentBadgeValue, newValue, 200);
    currentBadgeValue = newValue;
    updateSliderFill(sl);
    updateYearsHint();
    updateDynamicHint(newValue);
    scheduleRecalc();
  });

  if (badge) badge.textContent = fmt(input.value);
}

function updateDynamicHint(value) {
  var hint = document.getElementById('dynamic-hint');
  if (!hint) return;
  
  if (value === 0) {
    hint.textContent = 'Deine Sparrate bleibt konstant';
  } else {
    hint.textContent = 'Deine Sparrate steigt jedes Jahr automatisch um ' + value + '%';
  }
}

function exportScreenshot() {
  var resultSection = document.getElementById('result-section');
  if (!resultSection || resultSection.style.display === 'none') {
    showToast('⚠ Bitte zuerst berechnen');
    return;
  }
  
  // Temporarily show the section fully for capture
  var originalScroll = window.scrollY;
  
  // Capture only the result hero and comparison cards
  var captureElement = document.createElement('div');
  captureElement.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:#030014;padding:40px;border-radius:20px;';
  
  // Clone the hero section
  var hero = document.querySelector('.result-hero').cloneNode(true);
  var compare = document.querySelector('.compare-grid').cloneNode(true);
  var details = document.querySelector('.details-grid').cloneNode(true);
  
  captureElement.appendChild(hero);
  captureElement.appendChild(compare);
  captureElement.appendChild(details);
  document.body.appendChild(captureElement);
  
  // Use html2canvas if available, otherwise fallback to canvas export
  if (typeof html2canvas !== 'undefined') {
    html2canvas(captureElement, {
      backgroundColor: '#030014',
      scale: 2,
      logging: false
    }).then(function(canvas) {
      var link = document.createElement('a');
      link.download = 'MBRN-Finanz-Ergebnis.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(captureElement);
    }).catch(function(err) {
      logger.error('Screenshot failed:', err);
      showToast('⚠ Screenshot konnte nicht erstellt werden');
      document.body.removeChild(captureElement);
    });
  } else {
    // Fallback: use the existing canvas generation
    generateShareImage('post');
    document.body.removeChild(captureElement);
  }
}

function updateSliderFill(sl) {
  var min = parseFloat(sl.min) || 0;
  var max = parseFloat(sl.max) || 100;
  var pct = ((parseFloat(sl.value) || 0) - min) / (max - min) * 100;
  sl.style.background = 'linear-gradient(90deg,#b388ff ' + pct + '%,rgba(100,70,200,.2) ' + pct + '%)';
}

// Debounced Auto-Neuberechnung (300ms nach letzter Änderung)
function scheduleRecalc() {
  if (!lastResult) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(calculate, 300);
}

// //  BERECHNUNG
// 
function calculate() {
    // 1. Inputs abgreifen (Sicherstellen, dass es Zahlen sind)
    const ageNow = parseFloat(getVal('age-now')) || 0;
    const ageStart = parseFloat(getVal('age-start')) || 0;
    const runtimeYears = ageNow - ageStart;

    const monthlyContribution = parseFloat(getVal('monthly')) || 0;
    const yearlyDynamic = parseFloat(getVal('dynamic-rate')) / 100 || 0;
    const startCapital = parseFloat(getVal('lump')) || 0;
    
    // Szenario-Daten
    const scenario = SCENARIOS[activeScenario];
    const returnRatePA = scenario.rate;
    const inflationRatePA = inflation; // Bereits als Dezimal gesetzt
    
    // Input Sanitization
    if (ageNow < 0 || ageNow > 120 || ageStart < 0 || ageStart > 120 || runtimeYears <= 0) {
        showError('err-age', 'Startalter muss kleiner als aktuelles Alter sein');
        showToast('⚠ Startalter muss kleiner als aktuelles Alter sein');
        return;
    }
    
    if (monthlyContribution <= 0 && startCapital <= 0) {
        showToast('⚠ Bitte einen Betrag eingeben');
        return;
    }

    setCalcLoading(true);

    setTimeout(function () {
        // 2. Initialisierung der Rechen-Variablen
        let totalInvested = startCapital;
        let nominalEndValue = startCapital;
        let currentMonthlyRate = monthlyContribution;
        
        // Array für den Chart
        const yearlyData = [];
        
        var mieteGedeckt = false;
        var zinseszins = false;

        // Monatliche Rate für Zinseszins (exponentiell, nicht linear!)
        const monthlyRate = Math.pow(1 + returnRatePA, 1 / 12) - 1;

        // 3. Berechnungsschleife (Monatlich für höchste Präzision)
        for (let year = 1; year <= runtimeYears; year++) {
            let yearlyProfit = 0;
            let yearlyInput = 0;
            var milestone = null;

            for (let month = 1; month <= 12; month++) {
                // 1. Zinsen auf das vorhandene Kapital (Zinseszins!)
                const monthStartValue = nominalEndValue;
                nominalEndValue *= (1 + monthlyRate);
                const monthlyProfit = nominalEndValue - monthStartValue;
                yearlyProfit += monthlyProfit;
                
                // 2. Einzahlung am Monatsende (nachschüssig)
                nominalEndValue += currentMonthlyRate;
                totalInvested += currentMonthlyRate;
                yearlyInput += currentMonthlyRate;
                
                // Meilenstein-Check: Zinseszins > Sparrate
                if (month === 12 && !zinseszins) {
                    var interestThisYear = yearlyProfit;
                    if (interestThisYear > (currentMonthlyRate * 12) && currentMonthlyRate > 0) {
                        milestone = (milestone ? milestone + ' & ' : '') + 'Zinseszins > Sparrate';
                        zinseszins = true;
                    }
                }
            }
            
            // Meilenstein: Miete gedeckt (4% Entnahme > 1000€/Monat)
            var investReal = nominalEndValue / Math.pow(1 + inflationRatePA, year);
            if (!mieteGedeckt && (investReal * 0.04) / 12 > 1000) {
                milestone = (milestone ? milestone + ' & ' : '') + 'Miete gedeckt';
                mieteGedeckt = true;
            }

            // Dynamik am Jahresende anwenden
            currentMonthlyRate *= (1 + yearlyDynamic);

            // Daten für Chart speichern (angepasst an bestehendes Format)
            yearlyData.push({
                year: year,
                age: ageStart + year,
                fiat: Math.round(startCapital / Math.pow(1 + inflationRatePA, year)), // Wird später korrigiert
                invest: Math.round(nominalEndValue / Math.pow(1 + inflationRatePA, year)),
                total: Math.round(totalInvested),
                milestone: milestone,
                nominalValue: nominalEndValue
            });
        }

        // 4. Abschluss-Kalkulationen (Mathematik-Fixes)
        
        // A. Gewinn & Steuern - KORRIGIERTE STEUERLOGIK
        const totalProfit = Math.max(0, nominalEndValue - totalInvested);
        
        // Steuerberechnung: Crypto 0%, ETF mit Teilfreistellung, Cash voll
        let effectiveTaxRate;
        if (scenario.type === 'crypto') {
            // Krypto ist nach 1 Jahr Haltefrist in DE steuerfrei
            effectiveTaxRate = 0; 
        } else if (scenario.type === 'etf') {
            // 30% Teilfreistellung auf Aktien-ETFs
            effectiveTaxRate = TAX_RATE_BASE * 0.7; 
        } else {
            // Volle Steuer z.B. für Sparkonto/Cash
            effectiveTaxRate = TAX_RATE_BASE; 
        }

        // KEIN FREIBETRAG (vereinfachte Berechnung am Laufzeitende)
        const taxAmount = totalProfit * effectiveTaxRate;
        const netEndValue = nominalEndValue - taxAmount;

        // B. Kaufkraft (Inflation über die volle Laufzeit diskontiert)
        // Formel: Nominalwert / (1 + Inflation)^Jahre
        const purchasingPower = netEndValue / Math.pow(1 + inflationRatePA, runtimeYears);
        const purchasingPowerNominal = nominalEndValue / Math.pow(1 + inflationRatePA, runtimeYears);

        // C. Real-Konto (Was wäre das Geld "unter dem Kissen" wert?)
        // Jede Einzahlung verliert über die Restlaufzeit an Wert
        let cashAccountValue = startCapital / Math.pow(1 + inflationRatePA, runtimeYears);
        let tempMonthly = monthlyContribution;
        for (let y = 0; y < runtimeYears; y++) {
            const yearsRemaining = runtimeYears - y;
            cashAccountValue += (tempMonthly * 12) / Math.pow(1 + inflationRatePA, yearsRemaining);
            tempMonthly *= (1 + yearlyDynamic);
        }
        
        // Korrekte Chart-Daten berechnen
        for (var i = 0; i < yearlyData.length; i++) {
            var yearData = yearlyData[i];
            var cumulativeDiscounted = startCapital / Math.pow(1 + inflationRatePA, yearData.year);
            
            tempMonthly = monthlyContribution;
            for (var yy = 1; yy <= yearData.year; yy++) {
                var remainingY = yearData.year - yy;
                var yearlyContrib = tempMonthly * 12;
                cumulativeDiscounted += yearlyContrib / Math.pow(1 + inflationRatePA, remainingY);
                tempMonthly = tempMonthly * (1 + yearlyDynamic);
            }
            
            yearData.fiat = Math.round(cumulativeDiscounted);
        }

        // 5. Ergebnisse an das UI übergeben
        lastResult = {
            nominalEndValue: nominalEndValue,
            netEndValue: netEndValue,
            totalInvested: totalInvested,
            totalProfit: totalProfit,
            taxAmount: taxAmount,
            purchasingPower: purchasingPower,
            purchasingPowerNominal: purchasingPowerNominal,
            cashAccountValue: cashAccountValue,
            factor: totalInvested > 0 ? nominalEndValue / totalInvested : 0,
            realFactor: cashAccountValue > 0 ? purchasingPowerNominal / cashAccountValue : 0,
            realGain: purchasingPowerNominal - cashAccountValue,
            fiatVal: cashAccountValue,
            realValue: purchasingPowerNominal,
            investVal: nominalEndValue,
            afterTax: netEndValue,
            gain: totalProfit,
            years: runtimeYears,
            monthly: monthlyContribution,
            dynamicRate: yearlyDynamic,
            lump: startCapital,
            chartData: yearlyData,
            ageNow: ageNow,
            ageStart: ageStart,
            rendite: returnRatePA,
            taxType: scenario.type,
            effectiveTaxRate: effectiveTaxRate,
            inflation: inflationRatePA,
            purchasingPowerNet: purchasingPower
        };

        setCalcLoading(false);
        showResult(lastResult);
    }, 160);
}

// //  ERGEBNIS ANZEIGEN
// 
function showResult(r) {
  var section = document.getElementById('result-section');
  if (!section) return;
  section.style.display = 'flex';

  // Hero mit animiertem Counter: inflationsbereinigter Hauptwert (Kaufkraft des Endwerts)
  animateCounter('hook-number', Math.round(r.realValue));
  setText('hook-sub', 'Nominale Endsumme: ' + formatCurrency(r.investVal) + '  ·  heutige Kaufkraft: ' + formatCurrency(r.realValue));

  // Kaufkraft Info anzeigen
  var kaufkraftInfo = document.getElementById('kaufkraft-info');
  if (kaufkraftInfo) {
    kaufkraftInfo.style.display = 'flex';
    var kaufkraftText = kaufkraftInfo.querySelector('.kaufkraft-text');
    if (kaufkraftText) {
      kaufkraftText.textContent = 'Deine ' + formatCurrency(r.investVal) + ' im Jahr ' + (r.ageNow + 2026 - r.ageStart) + ' haben die Kaufkraft von ca. ' + formatCurrency(r.realValue) + ' heute.';
    }
  }

  // Steuer-Hint
  var taxHint = document.getElementById('tax-hint');
  if (taxHint) {
    if (r.taxType === 'crypto' && r.years > 1) {
      taxHint.style.display = 'inline-flex';
      setText('tax-after', 'Steuerfrei (Haltefrist > 1 Jahr)');
    } else if (r.taxAmount > 0) {
      taxHint.style.display = 'inline-flex';
      var taxPercent = (r.effectiveTaxRate * 100).toFixed(1).replace('.0', '');
      var taxLabel = r.taxType === 'etf'
        ? `Nach ~${taxPercent}% Steuer (Teilfreistellung): `
        : `Nach ~${taxPercent}% Steuer: `;
      setText('tax-after', taxLabel + formatCurrency(r.afterTax));
    } else {
      taxHint.style.display = 'none';
    }
  }

  // Kontext-Vergleich auf Basis der KAUFKRAFT (nicht Netto-Endwert)
  // Ehrliche Darstellung: Was kann ich mir HEUTE für das Geld kaufen?
  renderContextBox(r.purchasingPower, r.purchasingPower);

  // Vergleich: Kaufkraft heute vs. Inflationsbereinigte Einzahlungen
  setText('val-fiat', formatCurrency(r.fiatVal));
  setText('val-invest', formatCurrency(r.realValue));
  setText('invest-label', SCENARIOS[activeScenario].name + ' · heutige Kaufkraft');

  // Details: KORRIGIERT - zeige NOMINALE Werte für Eingezahlt und realen Gewinn
  setText('detail-years', r.years);
  setText('detail-invested', formatCurrencyShort(r.totalInvested));  // NOMINAL eingezahlt
  setText('detail-gain', formatCurrencyShort(Math.max(0, r.realGain)));  // REALER Gewinn (Kaufkraft)
  setText('detail-factor', r.realFactor.toFixed(1) + 'x');

  // Wow-Meter mit dynamischem Performance Score
  // 0% = Inflation frisst alles (realer Gewinn = 0)
  // 100% = S&P 500 Performance (~10% p.a.)
  // >100% = Besser als S&P 500 (z.B. Krypto)
  var fill = document.getElementById('wow-fill');
  var wowLabel = document.getElementById('wow-label');

  // Annualisierte Rendite berechnen
  var annualReturn = Math.pow(r.nominalEndValue / r.totalInvested, 1 / r.years) - 1;
  var sp500Benchmark = 0.10; // S&P 500 ~10%
  var inflationRate = r.inflation;

  // Performance Score: 0% = Inflation, 100% = S&P 500
  var performanceScore = ((annualReturn - inflationRate) / (sp500Benchmark - inflationRate)) * 100;
  performanceScore = Math.max(0, Math.min(100, performanceScore)); // Clamp 0% - 100% (Maximum)

  // Dynamische Farben basierend auf Score
  var scoreColor, scoreText, scoreGlow;
  if (performanceScore >= 80) {
    // Neon-Grün: Finanzielle Freiheit erreicht
    scoreColor = '#00ff88';
    scoreGlow = '0 0 20px #00ff88';
    scoreText = 'Finanzielle Freiheit ✦ (' + Math.round(performanceScore) + '%)';
  } else if (performanceScore >= 40) {
    // Gold/Gelb: Solider Vermögensaufbau
    scoreColor = '#ffd700';
    scoreGlow = '0 0 15px #ffd700';
    scoreText = 'Solider Vermögensaufbau (' + Math.round(performanceScore) + '%)';
  } else {
    // Soft-Rot: Inflation frisst dein Erspartes
    scoreColor = '#ff6b6b';
    scoreGlow = '0 0 10px #ff6b6b';
    scoreText = 'Inflation frisst dein Erspartes ⚠️ (' + Math.round(performanceScore) + '%)';
  }

  // Balken-Breite (max 100%)
  var wowPct = Math.min(100, Math.round(performanceScore));

  if (fill) {
    fill.style.width = wowPct + '%';
    fill.style.background = scoreColor;
    fill.style.boxShadow = scoreGlow;
  }
  setText('wow-label', scoreText);

  // Insight
  setText('insight-text', buildInsight(r));

  // Chart
  drawChart(r.chartData, r.investVal);

  // Jahrestabelle
  fillYearTable(r);

  // Share Preview
  setText('sp-number', formatCurrency(r.realValue));
  setText('sp-fiat', formatCurrencyShort(r.fiatVal));
  setText('sp-invest', formatCurrencyShort(r.realValue));
  setText('sp-inv-label', SCENARIOS[activeScenario].name);
  setText('sp-sub', 'wenn du vor ' + r.years + ' Jahren angefangen hättest');

  setTimeout(function () {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 130);
}

// //  ANIMIERTER COUNTER
// 
function animateCounter(id, targetVal) {
  var el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('animating');
  void el.offsetWidth;
  el.classList.add('animating');

  if (counterTimer) cancelAnimationFrame(counterTimer);

  var duration = 800;
  var startTime = null;

  counterTimer = requestAnimationFrame(function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * targetVal);
    el.textContent = formatCurrency(current);
    if (progress < 1) counterTimer = requestAnimationFrame(step);
    else el.textContent = formatCurrency(targetVal);
  });
}

// //  KONTEXT-VERGLEICH
// 
function renderContextBox(val, netEndValue) {
  var box = document.getElementById('context-box');
  var grid = document.getElementById('context-grid');
  if (!box || !grid) return;

  // Aktuelle Preise für Vergleichs-Karten
  var avgSalaryDE = 45000;
  var avgRentDE = 12000;
  var carAvg = 35000;
  var worldTrip = 5000;

  // Nutze netEndValue (nach Steuern) für realistischere Vergleiche
  var compareValue = netEndValue || val;

  var items = [
    { emoji: '💰', label: 'Jahresgehälter (DE)', val: Math.round(compareValue / avgSalaryDE * 10) / 10, price: avgSalaryDE },
    { emoji: '🏠', label: 'Jahre Miete (ø DE)', val: Math.round(compareValue / avgRentDE * 10) / 10, price: avgRentDE },
    { emoji: '🚗', label: 'Durchschnittliche Neuwagen', val: Math.round(compareValue / carAvg), price: carAvg },
    { emoji: '✈️', label: 'Weltreisen (ca. 5.000€)', val: Math.round(compareValue / worldTrip), price: worldTrip },
  ];

  // SECURITY: DOM-API statt innerHTML
  safeClear(grid);
  items.forEach(function(item) {
    var div = document.createElement('div');
    div.className = 'context-item';
    
    var emojiSpan = document.createElement('span');
    emojiSpan.className = 'context-emoji';
    emojiSpan.textContent = item.emoji;
    
    var textDiv = document.createElement('div');
    textDiv.className = 'context-text';
    
    var strong = document.createElement('strong');
    strong.textContent = formatNum(item.val);
    
    var label = document.createTextNode(item.label);
    
    var small = document.createElement('small');
    small.style.opacity = '0.6';
    small.style.display = 'block';
    small.textContent = formatCurrency(item.price);
    
    textDiv.appendChild(strong);
    textDiv.appendChild(label);
    textDiv.appendChild(small);
    
    div.appendChild(emojiSpan);
    div.appendChild(textDiv);
    grid.appendChild(div);
  });
}

function formatNum(n) {
  if (n >= 1000) return Math.round(n).toLocaleString('de-DE') + ' ×';
  if (n % 1 === 0) return n + ' ×';
  return n.toFixed(1) + ' ×';
}

// //  JAHRESTABELLE
// 
function fillYearTable(r) {
  var tbody = document.getElementById('year-table-body');
  if (!tbody) return;

  var ageStart = r.ageStart;
  var milestones = [100000, 250000, 500000, 1000000, 5000000];
  var passedMiles = {};

  // SECURITY: DOM-API statt innerHTML für Tabellen
  safeClear(tbody);
  r.chartData.forEach(function(d) {
    var gain = d.invest - d.total;
    var isMile = false;
    
    milestones.forEach(function(m) {
      if (d.invest >= m && !passedMiles[m]) {
        passedMiles[m] = true;
        isMile = true;
      }
    });
    
    var tr = document.createElement('tr');
    if (isMile) tr.className = 'milestone-row';
    
    var td1 = document.createElement('td');
    td1.textContent = d.year;
    var td2 = document.createElement('td');
    td2.textContent = (ageStart + d.year);
    var td3 = document.createElement('td');
    td3.textContent = formatCurrencyShort(d.total);
    var td4 = document.createElement('td');
    td4.className = 'col-invest';
    td4.textContent = formatCurrencyShort(d.invest);
    var td5 = document.createElement('td');
    td5.textContent = formatCurrencyShort(d.fiat);
    var td6 = document.createElement('td');
    td6.className = 'col-gain';
    td6.textContent = (gain > 0 ? '+' : '') + formatCurrencyShort(gain);
    
    tr.append(td1, td2, td3, td4, td5, td6);
    tbody.appendChild(tr);
  });
}

// //  REVERSE-RECHNER: Wann bin ich Millionär?
// 
function calculateReverse() {
  if (!lastResult) {
    showToast('⚠ Bitte zuerst berechnen');
    return;
  }

  var targetEl = document.getElementById('target-amount');
  var target = parseFloat(targetEl ? targetEl.value : 0) || 1000000;
  var r = lastResult;
  var rendite = r.rendite;
  var monthly = r.monthly;
  var dynamicRate = r.dynamicRate || 0;
  var lump = r.lump;

  var val = lump;
  var years = 0;
  var maxYears = 200;
  var currentMonthly = monthly;

  var monthlyRate = Math.pow(1 + rendite, 1 / 12) - 1;

  while (val < target && years < maxYears) {
    for (var m = 0; m < 12; m++) {
      // 1. Erst Zinsen auf das Vorab-Kapital (nachschüssig)
      val = val * (1 + monthlyRate);
      // 2. Dann die monatliche Einzahlung addieren
      val = val + currentMonthly;
    }
    currentMonthly = currentMonthly * (1 + dynamicRate);
    years++;
  }

  var resultEl = document.getElementById('reverse-result');
  var textEl = document.getElementById('reverse-result-text');
  if (!resultEl || !textEl) return;
  resultEl.style.display = 'block';

  if (years >= maxYears) {
    textEl.textContent = 'Mit diesem Szenario und ' + formatCurrencyShort(monthly) + '/Monat ist das Ziel von ' + formatCurrency(target) + ' rechnerisch nicht erreichbar. Erhöhe den monatlichen Betrag oder wähle ein renditereicheres Szenario.';
  } else {
    var reachAge = r.ageStart + years;
    var now = r.ageNow;
    var futureYears = years - r.years;

    if (futureYears <= 0) {
      // SECURITY: textContent statt innerHTML
      textEl.textContent = '✦ Du hättest das Ziel von ' + formatCurrency(target) + ' bereits nach ' + years + ' Jahren (mit ' + reachAge + ') erreicht — wenn du damals gestartet wärst.';
    } else {
      textEl.textContent = '✦ Du erreichst ' + formatCurrency(target) + ' in weiteren ' + futureYears + ' Jahren (mit ' + (now + futureYears) + ') — wenn du jetzt mit ' + formatCurrencyShort(monthly) + '/Monat startest.';
    }
  }
}

// //  CHART (mit Milestone-Linien)
// 
function drawChart(data, maxInvest) {
  var canvas = document.getElementById('growth-chart');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var dpr = window.devicePixelRatio || 1;
  var w = canvas.parentElement.clientWidth || 300;
  var h = 200;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var pL = 18, pR = 22, pT = 18, pB = 26;
  var cW = w - pL - pR, cH = h - pT - pB;
  var maxV = Math.max.apply(null, data.map(function(d){ return d.invest; })) || 1;

  function xP(i) { return pL + (i / Math.max(data.length - 1, 1)) * cW; }
  function yP(v) { return pT + cH - (v / maxV) * cH; }

  // Grid-Linien
  ctx.strokeStyle = 'rgba(100,70,200,.07)';
  ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var gy = pT + (cH / 4) * g;
    ctx.beginPath();
    ctx.moveTo(pL, gy);
    ctx.lineTo(pL + cW, gy);
    ctx.stroke();
  }

  // Milestone-Linien
  var milestones = [100000, 500000, 1000000, 5000000];
  milestones.forEach(function(m) {
    if (m > maxV * 1.1) return;
    var my = yP(m);
    ctx.strokeStyle = 'rgba(179,136,255,.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(pL, my);
    ctx.lineTo(pL + cW, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(179,136,255,.4)';
    ctx.font = '8px Space Mono,monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatCurrencyShort(m), pL + cW, my - 2);
  });

  // Fiat (gestrichelt)
  ctx.beginPath();
  data.forEach(function(d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.fiat));
    else ctx.lineTo(xP(i), yP(d.fiat));
  });
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,107,107,.52)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Invest-Fläche
  var gr = ctx.createLinearGradient(0, pT, 0, pT + cH);
  gr.addColorStop(0, 'rgba(179,136,255,.26)');
  gr.addColorStop(1, 'rgba(179,136,255,.02)');
  ctx.beginPath();
  data.forEach(function(d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.invest));
    else ctx.lineTo(xP(i), yP(d.invest));
  });
  ctx.lineTo(xP(data.length - 1), pT + cH);
  ctx.lineTo(xP(0), pT + cH);
  ctx.closePath();
  ctx.fillStyle = gr;
  ctx.fill();

  // Invest-Linie
  ctx.beginPath();
  data.forEach(function(d, i) {
    if (i === 0) ctx.moveTo(xP(i), yP(d.invest));
    else ctx.lineTo(xP(i), yP(d.invest));
  });
  ctx.strokeStyle = 'rgba(179,136,255,.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Endwert Label
  if (data.length > 1) {
    var last = data[data.length - 1];
    ctx.fillStyle = 'rgba(179,136,255,.85)';
    ctx.font = '700 9px Space Mono,monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatCurrencyShort(last.invest), pL + cW, yP(last.invest) - 4);
  }

  // X-Labels
  ctx.fillStyle = 'rgba(234,234,244,.28)';
  ctx.font = '8px Space Mono,monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach(function(i) {
    if (data[i]) ctx.fillText('Jahr ' + data[i].year, xP(i), h - 3);
  });

  // Psychologische Meilensteine
  data.forEach(function(d, i) {
    if (d.milestone) {
      var mx = xP(i);
      var my = yP(d.invest);

      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'var(--gold)';
      ctx.fill();
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'var(--gold)';
      ctx.font = '700 8px Space Mono,monospace';
      ctx.textAlign = (i > data.length * 0.7) ? 'right' : 'left';
      var textX = (i > data.length * 0.7) ? mx - 6 : mx + 6;
      ctx.fillText(d.milestone, textX, my - 6);
    }
  });
}

// //  INSIGHT TEXT
// 
function buildInsight(r) {
  var s = SCENARIOS[activeScenario].name;
  var diff = formatCurrency(r.realValue - r.fiatVal);
  var base;

  if (r.realFactor >= 10) {
    base = 'Mit ' + s + ' hättest du dein Kapital ver' + r.realFactor.toFixed(0) + 'facht - ' + diff + ' mehr als auf dem Konto. Das ist kein Zufall, das ist Zeit plus Zinseszins.';
  } else if (r.realFactor >= 3) {
    base = diff + ' trennen die Entscheidung zu investieren von der Entscheidung es nicht zu tun. ' + r.years + ' Jahre, ' + formatCurrencyShort(r.monthly) + '/Monat.';
  } else {
    base = 'Selbst ' + s + ' schlägt Inflation in ' + r.years + ' Jahren deutlich - ' + diff + ' Unterschied bei nur ' + formatCurrencyShort(r.monthly) + '/Monat.';
  }

  if (activeScenario === 'btc') {
    base += ' ⚠ Bitcoin: historische ø-Rendite war extrem hoch, Zukunft wahrscheinlich deutlich moderater. Nur mit Geld investieren, dessen Verlust du verkraften könntest.';
  }
  return base;
}

// //  SHARE IMAGE
// 
function generateShareImage(fmt) {
  if (!lastResult) {
    showToast('⚠ Bitte zuerst berechnen');
    return;
  }

  var r = lastResult, isStory = fmt === 'story';
  var W = 1080, H = isStory ? 1920 : 1080;
  var c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  var ctx = c.getContext('2d');

  // BG
  ctx.fillStyle = '#030014';
  ctx.fillRect(0, 0, W, H);
  var g1 = ctx.createRadialGradient(W, 0, 0, W, 0, 600);
  g1.addColorStop(0, 'rgba(157,80,187,.35)');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b388ff';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);

  if (isStory) drawStoryCard(ctx, r, W, H);
  else drawPostCard(ctx, r, W, H);

  var a = document.createElement('a');
  a.download = isStory ? 'mbrn-finanz-story.png' : 'mbrn-finanz-post.png';
  a.href = c.toDataURL('image/png');
  a.click();
}

function drawPostCard(ctx, r, W, H) {
  var cx = W / 2;
  ctx.fillStyle = 'rgba(179,136,255,.55)';
  ctx.font = '500 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('WAS WÄRST DU HEUTE WERT? ✦ MBRN', cx, 68);

  var nTxt = formatCurrency(r.realValue), fs = 180;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  while (ctx.measureText(nTxt).width > W * .82 && fs > 60) {
    fs -= 8;
    ctx.font = 'bold ' + fs + 'px sans-serif';
  }
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,.3)';
  ctx.shadowBlur = 40;
  var tg = ctx.createLinearGradient(200, 0, W - 200, 0);
  tg.addColorStop(0, '#fff');
  tg.addColorStop(1, '#b388ff');
  ctx.fillStyle = tg;
  ctx.fillText(nTxt, cx, 330);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(234,234,244,.4)';
  ctx.font = '400 26px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('heutige Kaufkraft nach ' + r.years + ' Jahren', cx, 430);

  var bW = 420, bH = 130, gap = 36, bY = 480;
  var b1x = cx - bW - gap / 2, b2x = cx + gap / 2;

  drawBox(ctx, 'rgba(255,107,107,.1)', 'rgba(255,107,107,.35)', b1x, bY, bW, bH, 'FIAT · INFLATION', '#ff6b6b', formatCurrencyShort(r.fiatVal), 36);
  drawBox(ctx, 'rgba(79,255,176,.1)', 'rgba(79,255,176,.35)', b2x, bY, bW, bH, SCENARIOS[activeScenario].name.toUpperCase(), '#4fffb0', formatCurrencyShort(r.realValue), 36);

  drawStats(ctx, r, W, 656);
  drawInsBox(ctx, r, W, 760, 116);

  ctx.fillStyle = 'rgba(179,136,255,.4)';
  ctx.font = '400 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io/FinanzRechner  ✦', cx, H - 22);
}

function drawStoryCard(ctx, r, W, H) {
  var cx = W / 2;
  ctx.fillStyle = 'rgba(179,136,255,.6)';
  ctx.font = '500 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦ MBRN · FINANZ-RECHNER ✦', cx, 100);

  ctx.fillStyle = 'rgba(234,234,244,.85)';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('Was wärst du heute', cx, 200);
  ctx.fillText('wert?', cx, 265);

  var nTxt = formatCurrency(r.realValue), fs = 140;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  while (ctx.measureText(nTxt).width > W * .85 && fs > 60) {
    fs -= 8;
    ctx.font = 'bold ' + fs + 'px sans-serif';
  }
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(179,136,255,.4)';
  ctx.shadowBlur = 50;
  var tg = ctx.createLinearGradient(100, 0, W - 100, 0);
  tg.addColorStop(0, '#fff');
  tg.addColorStop(1, '#b388ff');
  ctx.fillStyle = tg;
  ctx.fillText(nTxt, cx, 430);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(234,234,244,.5)';
  ctx.font = '400 28px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('bei ' + r.years + ' Jahren ' + SCENARIOS[activeScenario].name, cx, 530);

  var bW = 380, bH = 155, gap = 36, bY = 598;
  drawBox(ctx, 'rgba(255,107,107,.1)', 'rgba(255,107,107,.35)', cx - bW - gap / 2, bY, bW, bH, 'FIAT · INFLATION', '#ff6b6b', formatCurrencyShort(r.fiatVal), 42);
  drawBox(ctx, 'rgba(79,255,176,.1)', 'rgba(79,255,176,.35)', cx + gap / 2, bY, bW, bH, SCENARIOS[activeScenario].name.toUpperCase(), '#4fffb0', formatCurrencyShort(r.realValue), 42);

  drawStats(ctx, r, W, 822);

  ctx.fillStyle = 'rgba(179,136,255,.12)';
  ctx.strokeStyle = 'rgba(179,136,255,.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, 80, 1080, W - 160, 165, 18, true, true);
  ctx.fillStyle = '#b388ff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('Berechne dein Ergebnis:', cx, 1142);
  ctx.fillStyle = 'rgba(234,234,244,.7)';
  ctx.font = '400 22px monospace';
  ctx.fillText('flase-mbrn.github.io/FinanzRechner', cx, 1196);

  drawInsBox(ctx, r, W, 1310, 200);
  ctx.fillStyle = 'rgba(179,136,255,.4)';
  ctx.font = '400 22px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦  flase-mbrn.github.io  ✦', cx, H - 22);
}

function drawBox(ctx, fill, stroke, x, y, w, h, label, valColor, valText, fs) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 12, true, true);
  ctx.fillStyle = 'rgba(234,234,244,.35)';
  ctx.font = '400 17px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x + w / 2, y + 30);
  ctx.fillStyle = valColor;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(valText, x + w / 2, y + h * .65);
}

function drawStats(ctx, r, W, y) {
  var stats = [
    { l: 'JAHRE', v: r.years },
    { l: 'EINGEZAHLT', v: formatCurrencyShort(r.totalInvested) },
    { l: 'GEWINN', v: formatCurrencyShort(Math.max(0, r.realGain)) },
    { l: 'FAKTOR', v: r.realFactor.toFixed(1) + 'x' }
  ];
  var sw = (W - 120) / 4;
  stats.forEach(function(s, i) {
    var sx = 60 + i * sw;
    ctx.fillStyle = 'rgba(234,234,244,.25)';
    ctx.font = '400 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.l, sx + sw / 2, y + 22);
    ctx.fillStyle = '#b388ff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.v, sx + sw / 2, y + 62);
  });
}

function drawInsBox(ctx, r, W, y, boxH) {
  ctx.fillStyle = 'rgba(179,136,255,.1)';
  ctx.strokeStyle = 'rgba(179,136,255,.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, 60, y, W - 120, boxH, 12, true, true);
  ctx.fillStyle = 'rgba(234,234,244,.5)';
  ctx.font = '400 19px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var ins = buildInsight(r);
  if (ins.length > 170) ins = ins.substring(0, 167) + '…';
  wrapText(ctx, ins, W / 2, y + boxH / 2 - 16, W - 160, 32);
}

// //  SHARE TEXT
// 
function buildShareText() {
  if (!lastResult) return '';
  var r = lastResult, url = window.location.href.split('?')[0];
  return [
    '💸 Was wärst du heute wert, wenn du früher investiert hättest?',
    'Ich hab es durchgerechnet: ' + SCENARIOS[activeScenario].name + ' über ' + r.years + ' Jahre → ' + formatCurrency(r.realValue),
    'Statt ' + formatCurrencyShort(r.fiatVal) + ' auf dem Konto. Unterschied: ' + formatCurrency(r.realValue - r.fiatVal),
    '👉 ' + url,
    '#Investieren #FinanzielleFreiheit #MBRN #Vermögensaufbau',
  ].join('\n');
}

// //  EVENTS
// 
function bindEvents() {
  // Szenarien
  document.querySelectorAll('.scenario-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.scenario-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeScenario = btn.getAttribute('data-scenario');
      updateScenarioNote();
      if (lastResult) calculate();
    });
  });

  // Alter → Hint
  ['age-now', 'age-start'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateYearsHint);
  });

  // Enter
  ['age-now', 'age-start', 'monthly', 'dynamic-rate', 'lump', 'inflation-input'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') calculate();
    });
  });

  // Inflation Presets
  document.querySelectorAll('.inf-preset').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.inf-preset').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      inflation = parseFloat(btn.getAttribute('data-val'));
      var el = document.getElementById('inflation-input');
      if (el) el.value = (inflation * 100).toFixed(1);
      setText('inflation-display', '+' + (inflation * 100).toFixed(1) + '%/Jahr');
      if (lastResult) calculate();
    });
  });

  // Custom Inflation
  var inflEl = document.getElementById('inflation-input');
  if (inflEl) inflEl.addEventListener('input', function() {
    var v = parseFloat(inflEl.value);
    if (!isNaN(v) && v >= 0 && v <= 20) {
      inflation = v / 100;
      document.querySelectorAll('.inf-preset').forEach(function(b) { b.classList.remove('active'); });
      setText('inflation-display', '+' + v.toFixed(1) + '%/Jahr');
      scheduleRecalc();
    }
  });

  // Berechnen
  var calcBtn = document.getElementById('btn-calculate');
  if (calcBtn) calcBtn.addEventListener('click', calculate);

  // Jahrestabelle toggle
  var toggleBtn = document.getElementById('btn-toggle-table');
  var tableWrap = document.getElementById('year-table-wrap');
  var toggleIcon = document.getElementById('table-toggle-icon');
  if (toggleBtn && tableWrap) {
    toggleBtn.addEventListener('click', function() {
      var open = tableWrap.style.display === 'none';
      tableWrap.style.display = open ? 'block' : 'none';
      if (toggleIcon) toggleIcon.textContent = open ? '▼' : '▶';
      toggleBtn.textContent = (open ? '▼ ' : '▶ ') + 'Jahres-Übersicht ' + (open ? 'ausblenden' : 'anzeigen');
    });
  }

  // Reverse-Rechner
  var revBtn = document.getElementById('btn-reverse');
  if (revBtn) revBtn.addEventListener('click', calculateReverse);
  var revInput = document.getElementById('target-amount');
  if (revInput) revInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') calculateReverse();
  });

  // Share
  bind('btn-share-result', function() {
    if (!lastResult) { showToast('⚠ Bitte zuerst berechnen'); return; }
    var o = document.getElementById('share-overlay');
    if (o) o.style.display = 'flex';
  });
  bind('btn-save-image', function() { generateShareImage('post'); });
  bind('btn-save-story', function() { generateShareImage('story'); });
  bind('btn-dl', function() { generateShareImage('post'); });
  bind('btn-story-modal', function() { generateShareImage('story'); });
  bind('btn-wa', function() { window.open('https://wa.me/?text=' + encodeURIComponent(buildShareText()), '_blank'); });
  bind('btn-tw', function() { window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildShareText()), '_blank'); });
  bind('btn-copy', function() {
    var url = window.location.href.split('?')[0];
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function(){ fallbackCopy(url); });
    else fallbackCopy(url);
    setText('btn-copy', '✓ Kopiert!');
    setTimeout(function(){ setText('btn-copy', '🔗 Link kopieren'); }, 2000);
  });

  // Modals
  closeModal('share-close', 'share-overlay');
  closeModal('privacy-close', 'privacy-overlay');
  closeBackdrop('share-overlay');
  closeBackdrop('privacy-overlay');
  bind('btn-privacy', function() {
    var o = document.getElementById('privacy-overlay');
    if (o) o.style.display = 'flex';
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    ['share-overlay', 'privacy-overlay'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  });
}

// //  HILFSFUNKTIONEN
// 
function setCalcLoading(on) {
  var btn = document.getElementById('btn-calculate');
  var icon = document.getElementById('calc-icon');
  var txt = document.getElementById('calc-text');
  if (!btn) return;

  if (on) {
    btn.classList.add('loading');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    if (txt) txt.textContent = 'Berechne…';
  } else {
    btn.classList.remove('loading');
    if (icon) {
      icon.style.animation = '';
      icon.textContent = '✦';
    }
    if (txt) txt.textContent = 'Jetzt berechnen';
  }
}

function showError(id, msg) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = '⚠ ' + msg;
    el.style.display = 'block';
  }
}

function hideError(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function updateYearsHint() {
  var n = parseInt(getVal('age-now'), 10) || 0;
  var s = parseInt(getVal('age-start'), 10) || 0;
  var el = document.getElementById('years-hint');
  if (!el) return;
  var y = n - s;
  el.textContent = y <= 0 ? '— Startalter muss kleiner als aktuelles Alter sein' : '= ' + y + ' Jahre Wachstum verpasst';
}

function updateScenarioNote() {
  var notes = {
    'sp500': 'Historische Durchschnittsrendite S&P 500 (1957–2024). Vergangene Performance ist keine Garantie.',
    'world-etf': 'MSCI World historische Durchschnittsrendite (~1970–2024). Vergangene Performance ist keine Garantie.',
    'btc': 'Bitcoin ø 25%/Jahr (konservative Simulation). Hochspekulativ - bei steigender Marktkapitalisierung deutlich geringere Renditen wahrscheinlich.',
    'savings': 'Sparkonto DE geschätzter Schnitt 2000–2024.'
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

function bind(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function closeModal(btnId, overlayId) {
  var btn = document.getElementById(btnId);
  if (btn) btn.addEventListener('click', function() {
    var el = document.getElementById(overlayId);
    if (el) el.style.display = 'none';
  });
}

function closeBackdrop(overlayId) {
  var el = document.getElementById(overlayId);
  if (el) el.addEventListener('click', function(e) {
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

function formatCurrency(v) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(v);
}

function formatCurrencyShort(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
  if (v >= 1000) return Math.round(v / 1000) + ' T€';
  return formatCurrency(v);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  var words = text.split(' ');
  var line = '';
  var ly = y;
  words.forEach(function(w) {
    var t = line + (line ? ' ' : '') + w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, ly);
      line = w;
      ly += lh;
    } else {
      line = t;
    }
  });
  if (line) ctx.fillText(line, x, ly);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/*    THEME TOGGLE - DEPRECATED: Using theme-manager.js instead */
/*
function initTheme() {
  const saved = localStorage.getItem('nTheme') || 'dark';
  const btn   = document.getElementById('themeToggle');
  document.documentElement.setAttribute('data-theme', saved);
  if (btn) btn.textContent = saved === 'dark' ? '☀' : '☾';
  btn?.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nTheme', next);
    btn.textContent = next === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', next === 'dark' ? 'Light Mode' : 'Dark Mode');
  });
}
*/

document.addEventListener('DOMContentLoaded', () => {
  // initTheme(); // DEPRECATED: Using theme-manager.js instead
});
