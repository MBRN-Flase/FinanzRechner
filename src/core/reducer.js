/**
 * FinanzRechner Reducer
 * Redux-style reducer with ACTIONS & STATE_PATHS constants
 */

import { ACTIONS, STATE_PATHS } from '../../../shared/core/keys.mjs';

/**
 * Finance State Reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action with type and payload
 * @returns {Object} New state
 */
export function financeReducer(state = createDefaultFinanceState(), action) {
  switch (action.type) {
    case ACTIONS.FINANCE_CALCULATE:
      return handleCalculation(state, action.payload);
    
    case ACTIONS.FINANCE_ADD_PRESET:
      return handleAddPreset(state, action.payload);
    
    case ACTIONS.FINANCE_REMOVE_PRESET:
      return handleRemovePreset(state, action.payload);
    
    case ACTIONS.FINANCE_SAVE_RESULT:
      return handleSaveResult(state, action.payload);
    
    default:
      return state;
  }
}

/**
 * Scenarios State Reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action with type and payload
 * @returns {Object} New state
 */
export function scenariosReducer(state = createDefaultScenariosState(), action) {
  switch (action.type) {
    case ACTIONS.FINANCE_SCENARIO_CREATED:
      return handleScenarioCreated(state, action.payload);
    
    case ACTIONS.FINANCE_SCENARIO_UPDATED:
      return handleScenarioUpdated(state, action.payload);
    
    case ACTIONS.FINANCE_SCENARIO_DELETED:
      return handleScenarioDeleted(state, action.payload);
    
    default:
      return state;
  }
}

/**
 * Default finance state
 * @returns {Object} Default state
 */
function createDefaultFinanceState() {
  return {
    presets: [],
    currentCalculation: null,
    history: [],
    _version: 1
  };
}

/**
 * Default scenarios state
 * @returns {Object} Default state
 */
function createDefaultScenariosState() {
  return {
    activeScenario: null,
    scenarios: {},
    _version: 1
  };
}

/**
 * Handle calculation result
 * @param {Object} state - Current state
 * @param {Object} payload - Calculation payload
 * @returns {Object} New state
 */
function handleCalculation(state, payload) {
  const { result } = payload;
  
  return {
    ...state,
    currentCalculation: result,
    history: [...state.history, {
      timestamp: new Date().toISOString(),
      result
    }].slice(-50) // Keep last 50 calculations
  };
}

/**
 * Handle preset addition
 * @param {Object} state - Current state
 * @param {Object} payload - Preset payload
 * @returns {Object} New state
 */
function handleAddPreset(state, payload) {
  const { preset } = payload;
  
  return {
    ...state,
    presets: [...state.presets, {
      ...preset,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    }]
  };
}

/**
 * Handle preset removal
 * @param {Object} state - Current state
 * @param {Object} payload - Remove payload
 * @returns {Object} New state
 */
function handleRemovePreset(state, payload) {
  const { id } = payload;
  
  return {
    ...state,
    presets: state.presets.filter(preset => preset.id !== id)
  };
}

/**
 * Handle calculation result save
 * @param {Object} state - Current state
 * @param {Object} payload - Save payload
 * @returns {Object} New state
 */
function handleSaveResult(state, payload) {
  const { result } = payload;
  
  if (!state.currentCalculation) return state;
  
  return {
    ...state,
    presets: [...state.presets, {
      ...state.currentCalculation,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      saved: true
    }]
  };
}

/**
 * Handle scenario creation
 * @param {Object} state - Current state
 * @param {Object} payload - Scenario payload
 * @returns {Object} New state
 */
function handleScenarioCreated(state, payload) {
  const { scenario } = payload;
  
  return {
    ...state,
    scenarios: {
      ...state.scenarios,
      [scenario.id]: scenario
    },
    activeScenario: scenario.id
  };
}

/**
 * Handle scenario update
 * @param {Object} state - Current state
 * @param {Object} payload - Update payload
 * @returns {Object} New state
 */
function handleScenarioUpdated(state, payload) {
  const { id, data } = payload;
  
  return {
    ...state,
    scenarios: {
      ...state.scenarios,
      [id]: {
        ...state.scenarios[id],
        ...data,
        updatedAt: new Date().toISOString()
      }
    }
  };
}

/**
 * Handle scenario deletion
 * @param {Object} state - Current state
 * @param {Object} payload - Delete payload
 * @returns {Object} New state
 */
function handleScenarioDeleted(state, payload) {
  const { id } = payload;
  
  const { [id]: deleted, ...remainingScenarios } = state.scenarios;
  
  return {
    ...state,
    scenarios: remainingScenarios,
    activeScenario: state.activeScenario === id ? null : state.activeScenario
  };
}

/**
 * Action creators
 */
export const financeActions = {
  calculate: (result) => ({
    type: ACTIONS.FINANCE_CALCULATE,
    payload: { result }
  }),
  
  addPreset: (preset) => ({
    type: ACTIONS.FINANCE_ADD_PRESET,
    payload: { preset }
  }),
  
  removePreset: (id) => ({
    type: ACTIONS.FINANCE_REMOVE_PRESET,
    payload: { id }
  }),
  
  saveResult: (result) => ({
    type: ACTIONS.FINANCE_SAVE_RESULT,
    payload: { result }
  }),
  
  createScenario: (scenario) => ({
    type: ACTIONS.FINANCE_SCENARIO_CREATED,
    payload: { scenario }
  }),
  
  updateScenario: (id, data) => ({
    type: ACTIONS.FINANCE_SCENARIO_UPDATED,
    payload: { id, data }
  }),
  
  deleteScenario: (id) => ({
    type: ACTIONS.FINANCE_SCENARIO_DELETED,
    payload: { id }
  })
};

/**
 * Selectors
 */
export const financeSelectors = {
  presets: (state) => state.presets,
  currentCalculation: (state) => state.currentCalculation,
  history: (state) => state.history,
  calculationCount: (state) => state.history.length,
  lastCalculation: (state) => state.history[state.history.length - 1] || null,
  
  // Scenarios
  activeScenario: (state) => state.activeScenario,
  scenarios: (state) => state.scenarios,
  scenarioCount: (state) => Object.keys(state.scenarios).length,
  getScenario: (state, id) => state.scenarios[id]
};
