import { formatCurrency, formatCurrencyShort } from './core/formatters.js';
import { fetchPrices } from './modules/prices.js';
// Global Core System - Silent Integration (Phase 1: Infrastructure)
import { createSchema, createEventBus } from '../../shared/core/index.mjs';
import { ACTIONS, EVENTS, STORAGE_KEYS } from '../../shared/core/keys.mjs';
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

// Global Core System - Finance Schema (Silent Validation)
const financeSchema = createSchema({
  version: 1,
  default: {
    presets: [],
    history: [],
    lastCalculation: null,
    _version: 1
  },
  validate: (data) => {
    // Silent validation - only check structure, don't throw
    if (data.presets && !Array.isArray(data.presets)) {
      console.warn('[Finance] presets should be array');
    }
    if (data.history && !Array.isArray(data.history)) {
      console.warn('[Finance] history should be array');
    }
    return true; // Always pass to not break existing flow
  },
  migrations: {}
});

const dom = createFinanceDom(document);
const storage = createStorageAdapter({ 
  prefix: 'mbrn_',
  schema: financeSchema  // Schema attached but non-blocking
});
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

// Global Core System - Event Bus (Ready for future event-driven features)
const events = createEventBus({ 
  name: 'finance', 
  crossTab: false  // Local events only for now
});

// Example: Emit calculation events (non-blocking, for analytics/debugging)
function emitCalculationEvent(type, data) {
  try {
    events.emit(EVENTS.FINANCE_CALC_START, { type, timestamp: Date.now() });
  } catch (e) {
    // Silent fail - don't break existing functionality
  }
}

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
