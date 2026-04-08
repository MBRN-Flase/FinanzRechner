import { calculateScenario } from '../core/calculator.js';
import { formatCurrency } from '../core/formatters.js';
import { buildShareText, exportScreenshot, generateShareImage } from '../modules/share.js';
import {
  hideError,
  setCalcLoading,
  setText,
  showError,
  showResult,
  showToast,
  updateScenarioNote,
} from './render.js';

function fallbackCopy(documentRef, text) {
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  documentRef.body.appendChild(textarea);
  textarea.select();
  documentRef.execCommand('copy');
  documentRef.body.removeChild(textarea);
}

function bindClick(element, handler) {
  if (element) element.addEventListener('click', handler);
}

function closeModal(dom, button, overlay) {
  bindClick(button, () => {
    if (overlay) overlay.style.display = 'none';
  });
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.style.display = 'none';
  });
}

function updateDynamicHint(dom, value) {
  if (!dom.dynamicHint) return;
  dom.dynamicHint.textContent = value === 0
    ? 'Deine Sparrate bleibt konstant'
    : `Deine Sparrate steigt jedes Jahr automatisch um ${value}%`;
}

function getInputValue(input) {
  return input ? parseFloat(input.value) || 0 : 0;
}

export function createFinanceNotificationController({
  dom,
  state,
  chartController,
  sliderController,
}) {
  function runCalculation() {
    hideError('err-age');

    const result = calculateScenario({
      ageNow: getInputValue(dom.ageNowInput),
      ageStart: getInputValue(dom.ageStartInput),
      monthlyContribution: getInputValue(dom.monthlyInput),
      yearlyDynamic: getInputValue(dom.dynamicInput) / 100,
      startCapital: getInputValue(dom.lumpInput),
      activeScenario: state.activeScenario,
      inflation: state.inflation,
    });

    if (result.error === 'err-age') {
      showError('err-age', result.message);
      showToast(result.message);
      return;
    }
    if (result.message) {
      showToast(result.message);
      return;
    }

    setCalcLoading(true);
    setTimeout(() => {
      state.lastResult = result;
      setCalcLoading(false);
      showResult(state, result, state.activeScenario);
      chartController.render(result);
    }, 160);
  }

  function scheduleRecalc() {
    if (!state.lastResult) return;
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(runCalculation, 300);
  }

  function calculateReverse() {
    if (!state.lastResult) {
      showToast('Bitte zuerst berechnen');
      return;
    }

    const target = getInputValue(dom.reverseInput) || 1000000;
    const result = state.lastResult;
    let value = result.lump;
    let years = 0;
    let currentMonthly = result.monthly;
    const monthlyRate = Math.pow(1 + result.rendite, 1 / 12) - 1;

    while (value < target && years < 200) {
      for (let month = 0; month < 12; month += 1) {
        value *= 1 + monthlyRate;
        value += currentMonthly;
      }
      currentMonthly *= 1 + result.dynamicRate;
      years += 1;
    }

    if (!dom.reverseResult || !dom.reverseResultText) return;
    dom.reverseResult.style.display = 'block';
    dom.reverseResultText.innerHTML = years >= 200
      ? `Mit diesem Szenario und ${result.monthly} EUR/Monat ist ${formatCurrency(target)} rechnerisch nicht erreichbar.`
      : `✦ Du erreichst <strong>${formatCurrency(target)}</strong> nach insgesamt <strong>${years} Jahren</strong>.`;
  }

  function bindEvents() {
    sliderController.bind({
      onInputChange: scheduleRecalc,
      updateYearsHint: () => {
        const currentAge = getInputValue(dom.ageNowInput);
        const startAge = getInputValue(dom.ageStartInput);
        if (!dom.yearsHint) return;
        const years = currentAge - startAge;
        dom.yearsHint.textContent = years <= 0 ? '— Startalter muss kleiner als aktuelles Alter sein' : `= ${years} Jahre Wachstum verpasst`;
      },
      updateDynamicHint: (value) => updateDynamicHint(dom, value),
    });

    dom.scenarioButtons.forEach((button) => {
      button.addEventListener('click', () => {
        dom.scenarioButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        state.activeScenario = button.getAttribute('data-scenario');
        updateScenarioNote(state.activeScenario);
        if (state.lastResult) runCalculation();
      });
    });

    ['age-now', 'age-start', 'monthly', 'dynamic-rate', 'lump', 'inflation-input'].forEach((id) => {
      const element = dom.doc.getElementById(id);
      if (element) {
        element.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') runCalculation();
        });
      }
    });

    dom.inflationPresets.forEach((button) => {
      button.addEventListener('click', () => {
        dom.inflationPresets.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        state.inflation = parseFloat(button.getAttribute('data-val')) || state.inflation;
        if (dom.inflationInput) dom.inflationInput.value = (state.inflation * 100).toFixed(1);
        setText('inflation-display', `+${(state.inflation * 100).toFixed(1)}%/Jahr`);
        if (state.lastResult) runCalculation();
      });
    });

    dom.inflationInput?.addEventListener('input', () => {
      const value = parseFloat(dom.inflationInput.value);
      if (!Number.isNaN(value) && value >= 0 && value <= 20) {
        state.inflation = value / 100;
        dom.inflationPresets.forEach((item) => item.classList.remove('active'));
        setText('inflation-display', `+${value.toFixed(1)}%/Jahr`);
        scheduleRecalc();
      }
    });

    bindClick(dom.btnCalculate, runCalculation);
    bindClick(dom.btnReverse, calculateReverse);
    bindClick(dom.btnShareResult, () => {
      if (!state.lastResult) {
        showToast('Bitte zuerst berechnen');
        return;
      }
      if (dom.shareOverlay) dom.shareOverlay.style.display = 'flex';
    });
    bindClick(dom.btnSaveImage, () => exportScreenshot({
      showToast,
      generateShareImage: (format) => generateShareImage(state.lastResult, state.activeScenario, format),
    }));
    bindClick(dom.btnSaveStory, () => generateShareImage(state.lastResult, state.activeScenario, 'story'));
    bindClick(dom.btnDl, () => generateShareImage(state.lastResult, state.activeScenario, 'post'));
    bindClick(dom.btnStoryModal, () => generateShareImage(state.lastResult, state.activeScenario, 'story'));
    bindClick(dom.btnWa, () => window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText(state.lastResult, state.activeScenario))}`, '_blank'));
    bindClick(dom.btnTw, () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(state.lastResult, state.activeScenario))}`, '_blank'));
    bindClick(dom.btnCopy, () => {
      const url = window.location.href.split('?')[0];
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => fallbackCopy(dom.doc, url));
      else fallbackCopy(dom.doc, url);
      setText('btn-copy', '✓ Kopiert!');
      setTimeout(() => setText('btn-copy', '🔗 Link kopieren'), 2000);
    });

    closeModal(dom, dom.shareClose, dom.shareOverlay);
    closeModal(dom, dom.privacyClose, dom.privacyOverlay);

    bindClick(dom.btnPrivacy, () => {
      if (dom.privacyOverlay) dom.privacyOverlay.style.display = 'flex';
    });

    dom.doc.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      [dom.shareOverlay, dom.privacyOverlay].forEach((element) => {
        if (element) element.style.display = 'none';
      });
    });
  }

  return {
    bindEvents,
    runCalculation,
    scheduleRecalc,
  };
}
