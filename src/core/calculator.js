import { SCENARIOS, TAX_RATE_BASE } from './scenarios.js';

export function calculateScenario(input) {
  const {
    ageNow,
    ageStart,
    monthlyContribution,
    yearlyDynamic,
    startCapital,
    activeScenario,
    inflation,
  } = input;

  const runtimeYears = ageNow - ageStart;
  if (ageNow < 0 || ageNow > 120 || ageStart < 0 || ageStart > 120 || runtimeYears <= 0) {
    return { error: 'err-age', message: 'Startalter muss kleiner als aktuelles Alter sein' };
  }
  if (monthlyContribution <= 0 && startCapital <= 0) {
    return { error: null, message: 'Bitte einen Betrag eingeben' };
  }

  const scenario = SCENARIOS[activeScenario];
  const returnRatePA = scenario.rate;
  const inflationRatePA = inflation;

  let totalInvested = startCapital;
  let nominalEndValue = startCapital;
  let currentMonthlyRate = monthlyContribution;
  const yearlyData = [];

  let rentCovered = false;
  let compoundingOutpacedSavings = false;
  const monthlyRate = Math.pow(1 + returnRatePA, 1 / 12) - 1;

  for (let year = 1; year <= runtimeYears; year += 1) {
    let yearlyProfit = 0;
    let milestone = null;

    for (let month = 1; month <= 12; month += 1) {
      const monthStartValue = nominalEndValue;
      nominalEndValue *= 1 + monthlyRate;
      yearlyProfit += nominalEndValue - monthStartValue;
      nominalEndValue += currentMonthlyRate;
      totalInvested += currentMonthlyRate;

      if (month === 12 && !compoundingOutpacedSavings) {
        if (yearlyProfit > currentMonthlyRate * 12 && currentMonthlyRate > 0) {
          milestone = `${milestone ? `${milestone} & ` : ''}Zinseszins > Sparrate`;
          compoundingOutpacedSavings = true;
        }
      }
    }

    const investedReal = nominalEndValue / Math.pow(1 + inflationRatePA, year);
    if (!rentCovered && (investedReal * 0.04) / 12 > 1000) {
      milestone = `${milestone ? `${milestone} & ` : ''}Miete gedeckt`;
      rentCovered = true;
    }

    currentMonthlyRate *= 1 + yearlyDynamic;

    yearlyData.push({
      year,
      age: ageStart + year,
      fiat: Math.round(startCapital / Math.pow(1 + inflationRatePA, year)),
      invest: Math.round(nominalEndValue / Math.pow(1 + inflationRatePA, year)),
      total: Math.round(totalInvested),
      milestone,
      nominalValue: nominalEndValue,
    });
  }

  const totalProfit = Math.max(0, nominalEndValue - totalInvested);
  let effectiveTaxRate;
  if (scenario.type === 'crypto') effectiveTaxRate = 0;
  else if (scenario.type === 'etf') effectiveTaxRate = TAX_RATE_BASE * 0.7;
  else effectiveTaxRate = TAX_RATE_BASE;

  const taxAmount = totalProfit * effectiveTaxRate;
  const netEndValue = nominalEndValue - taxAmount;
  const purchasingPower = netEndValue / Math.pow(1 + inflationRatePA, runtimeYears);
  const purchasingPowerNominal = nominalEndValue / Math.pow(1 + inflationRatePA, runtimeYears);

  let cashAccountValue = startCapital / Math.pow(1 + inflationRatePA, runtimeYears);
  let discountedMonthly = monthlyContribution;
  for (let year = 0; year < runtimeYears; year += 1) {
    const yearsRemaining = runtimeYears - year;
    cashAccountValue += (discountedMonthly * 12) / Math.pow(1 + inflationRatePA, yearsRemaining);
    discountedMonthly *= 1 + yearlyDynamic;
  }

  for (let i = 0; i < yearlyData.length; i += 1) {
    const point = yearlyData[i];
    let cumulativeDiscounted = startCapital / Math.pow(1 + inflationRatePA, point.year);
    let contribution = monthlyContribution;
    for (let year = 1; year <= point.year; year += 1) {
      const remainingYears = point.year - year;
      cumulativeDiscounted += (contribution * 12) / Math.pow(1 + inflationRatePA, remainingYears);
      contribution *= 1 + yearlyDynamic;
    }
    point.fiat = Math.round(cumulativeDiscounted);
  }

  return {
    nominalEndValue,
    netEndValue,
    totalInvested,
    totalProfit,
    taxAmount,
    purchasingPower,
    purchasingPowerNominal,
    cashAccountValue,
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
    ageNow,
    ageStart,
    rendite: returnRatePA,
    taxType: scenario.type,
    effectiveTaxRate,
    inflation: inflationRatePA,
    purchasingPowerNet: purchasingPower,
  };
}
