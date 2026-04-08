import { SCENARIOS } from './scenarios.js';
import { formatCurrency } from './formatters.js';

export function buildInsight(result, activeScenario) {
  const scenarioName = SCENARIOS[activeScenario].name;
  const diff = formatCurrency(result.realValue - result.fiatVal);
  let base;

  if (result.realFactor >= 10) {
    base = `Mit ${scenarioName} haettest du dein Kapital ver${result.realFactor.toFixed(0)}facht - ${diff} mehr als auf dem Konto.`;
  } else if (result.realFactor >= 3) {
    base = `${diff} trennen die Entscheidung zu investieren von der Entscheidung es nicht zu tun. ${result.years} Jahre, ${result.monthly} EUR/Monat.`;
  } else {
    base = `Selbst ${scenarioName} schlaegt Inflation in ${result.years} Jahren deutlich - ${diff} Unterschied bei nur ${result.monthly} EUR/Monat.`;
  }

  if (activeScenario === 'btc') {
    base += ' Bitcoin: historische Renditen waren extrem hoch, die Zukunft wahrscheinlich moderater.';
  }

  return base;
}
