import { SCENARIOS } from '../core/scenarios.js';
import { buildInsight } from '../core/insight.js';
import { formatCurrency, formatCurrencyShort } from '../core/formatters.js';

export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

export function setCalcLoading(isLoading) {
  const button = document.getElementById('btn-calculate');
  const icon = document.getElementById('calc-icon');
  const text = document.getElementById('calc-text');
  if (!button) return;

  if (isLoading) {
    button.classList.add('loading');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    if (text) text.textContent = 'Berechne...';
  } else {
    button.classList.remove('loading');
    if (icon) {
      icon.style.animation = '';
      icon.textContent = '✦';
    }
    if (text) text.textContent = 'Jetzt berechnen';
  }
}

export function showError(id, message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = `⚠ ${message}`;
  element.style.display = 'block';
}

export function hideError(id) {
  const element = document.getElementById(id);
  if (element) element.style.display = 'none';
}

export function updateYearsHint(getValue) {
  const currentAge = parseInt(getValue('age-now'), 10) || 0;
  const startAge = parseInt(getValue('age-start'), 10) || 0;
  const element = document.getElementById('years-hint');
  if (!element) return;
  const years = currentAge - startAge;
  element.textContent = years <= 0 ? '— Startalter muss kleiner als aktuelles Alter sein' : `= ${years} Jahre Wachstum verpasst`;
}

export function updateScenarioNote(activeScenario) {
  const notes = {
    sp500: 'Historische Durchschnittsrendite S&P 500 (1957–2024). Vergangene Performance ist keine Garantie.',
    'world-etf': 'MSCI World historische Durchschnittsrendite (~1970–2024). Vergangene Performance ist keine Garantie.',
    btc: 'Bitcoin ø 25%/Jahr (konservative Simulation). Hochspekulativ - bei steigender Marktkapitalisierung deutlich geringere Renditen wahrscheinlich.',
    savings: 'Sparkonto DE geschaetzter Schnitt 2000–2024.',
  };
  setText('scenario-disclaimer', notes[activeScenario] || '');
}

export function animateCounter(state, id, targetValue) {
  const element = document.getElementById(id);
  if (!element) return;

  element.classList.remove('animating');
  void element.offsetWidth;
  element.classList.add('animating');

  if (state.counterTimer) cancelAnimationFrame(state.counterTimer);
  let startTime = null;
  const duration = 800;

  state.counterTimer = requestAnimationFrame(function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * targetValue);
    element.textContent = formatCurrency(current);
    if (progress < 1) state.counterTimer = requestAnimationFrame(step);
    else element.textContent = formatCurrency(targetValue);
  });
}

export function showResult(state, result, activeScenario) {
  const section = document.getElementById('result-section');
  if (!section) return;
  section.style.display = 'flex';

  animateCounter(state, 'hook-number', Math.round(result.realValue));
  setText('hook-sub', `Nominale Endsumme: ${formatCurrency(result.investVal)} · heutige Kaufkraft: ${formatCurrency(result.realValue)}`);

  const powerInfo = document.getElementById('kaufkraft-info');
  if (powerInfo) {
    powerInfo.style.display = 'flex';
    const text = powerInfo.querySelector('.kaufkraft-text');
    if (text) {
      text.textContent = `Deine ${formatCurrency(result.investVal)} im Jahr ${result.ageNow + 2026 - result.ageStart} haben die Kaufkraft von ca. ${formatCurrency(result.realValue)} heute.`;
    }
  }

  const taxHint = document.getElementById('tax-hint');
  if (taxHint) {
    if (result.taxType === 'crypto' && result.years > 1) {
      taxHint.style.display = 'inline-flex';
      setText('tax-after', 'Steuerfrei (Haltefrist > 1 Jahr)');
    } else if (result.taxAmount > 0) {
      taxHint.style.display = 'inline-flex';
      const taxPercent = (result.effectiveTaxRate * 100).toFixed(1).replace('.0', '');
      const taxLabel = result.taxType === 'etf'
        ? `Nach ~${taxPercent}% Steuer (Teilfreistellung): `
        : `Nach ~${taxPercent}% Steuer: `;
      setText('tax-after', `${taxLabel}${formatCurrency(result.afterTax)}`);
    } else {
      taxHint.style.display = 'none';
    }
  }

  setText('val-fiat', formatCurrency(result.fiatVal));
  setText('val-invest', formatCurrency(result.realValue));
  setText('invest-label', `${SCENARIOS[activeScenario].name} · heutige Kaufkraft`);
  setText('detail-years', result.years);
  setText('detail-invested', formatCurrencyShort(result.totalInvested));
  setText('detail-gain', formatCurrencyShort(Math.max(0, result.realGain)));
  setText('detail-factor', `${result.realFactor.toFixed(1)}x`);
  setText('insight-text', buildInsight(result, activeScenario));

  setText('sp-number', formatCurrency(result.realValue));
  setText('sp-fiat', formatCurrencyShort(result.fiatVal));
  setText('sp-invest', formatCurrencyShort(result.realValue));
  setText('sp-inv-label', SCENARIOS[activeScenario].name);
  setText('sp-sub', `wenn du vor ${result.years} Jahren angefangen hättest`);

  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 130);
}
