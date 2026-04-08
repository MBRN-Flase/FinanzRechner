import { formatCurrency, formatCurrencyShort } from './core/formatters.js';
import { fetchPrices } from './modules/prices.js';
import { createStorageAdapter } from '../../shared/core/storage.mjs';
import { createBackendClient } from '../../shared/core/backend.mjs';
import { createThemeController } from '../../shared/core/theme.mjs';
import { createFinanceDom } from './ui/dom.js';
import { createFinanceSliderController } from './ui/sliders.js';
import { createFinanceNotificationController } from './ui/notifications.js';
import { createFinanceChartController } from './ui/chart.js';
import { setText, updateScenarioNote, updateYearsHint } from './ui/render.js';

const state = {
  activeScenario: 'sp500',
  lastResult: null,
  inflation: 0.038,
  debounceTimer: null,
};

const dom = createFinanceDom(document);
const storage = createStorageAdapter({ prefix: 'mbrn_' });
const backend = createBackendClient({ apiBase: '', storage, eventKey: 'finanz_events' });
const themeController = createThemeController({
  documentRef: document,
  storageAdapter: storage,
  buttonId: 'frThemeBtn',
  storageKey: 'fr-theme',
  defaultTheme: 'dark',
  buttonDarkText: '☀',
  buttonLightText: '☾',
});
const chartController = createFinanceChartController({ dom });
const sliderController = createFinanceSliderController({ dom });
const notificationController = createFinanceNotificationController({
  dom,
  state,
  chartController,
  sliderController,
});

function initTheme() {
  themeController.init();
}

function initChart() {
  chartController.init();
}

function bindEvents() {
  notificationController.bindEvents();
}

async function bootstrap() {
  initTheme();
  initChart();
  bindEvents();
  await fetchPrices({ setText, formatCurrency, formatCurrencyShort, backend });
  updateYearsHint((id) => dom.doc.getElementById(id)?.value ?? '');
  updateScenarioNote(state.activeScenario);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
