/**
 * FinanzRechner Calculation Engine
 * Robust, modular calculation logic with correct mathematical formulas
 * 
 * Key fixes:
 * 1. Total Contributions: Dynamic yearly increases applied correctly
 * 2. Nominal End Value: Year-by-year iteration with compounding
 * 3. Real Value: Each year's contribution discounted by remaining inflation years
 * 4. Tax: Only applied to profit (End Value - Contributions)
 * 5. Purchasing Power: Final value discounted by full runtime inflation
 */

/**
 * Input parameters for the calculation
 * @typedef {Object} CalculationInput
 * @property {number} currentAge - Current age (e.g., 47)
 * @property {number} startAge - Starting age (e.g., 18)
 * @property {number} monthlyContribution - Monthly contribution (e.g., 1500)
 * @property {number} yearlyDynamicPercent - Yearly increase % (e.g., 2.0)
 * @property {number} startCapital - Initial capital (e.g., 1000)
 * @property {number} returnRatePA - Annual return rate % (e.g., 10.2)
 * @property {number} inflationRatePA - Annual inflation rate % (e.g., 7.0)
 * @property {number} taxRate - Tax rate on profits % (e.g., 18.46)
 */

/**
 * Calculation results
 * @typedef {Object} CalculationResult
 * @property {number} totalContributions - Sum of all contributions including start capital
 * @property {number} nominalEndValue - Final value before taxes
 * @property {number} totalProfit - Nominal end value minus total contributions
 * @property {number} taxAmount - Tax on profit
 * @property {number} netEndValue - Nominal end value minus tax
 * @property {number} realValueCashOnAccount - Present value of all contributions (inflation-adjusted)
 * @property {number} purchasingPowerNominal - Purchasing power of nominal end value today
 * @property {number} purchasingPowerNet - Purchasing power of net end value today
 * @property {number} effectiveReturn - Effective return percentage
 * @property {YearlyData[]} yearlyBreakdown - Year-by-year calculation data
 */

/**
 * Year-by-year calculation data
 * @typedef {Object} YearlyData
 * @property {number} year - Year number (1-based)
 * @property {number} age - Age in that year
 * @property {number} monthlyContribution - Monthly contribution for that year
 * @property {number} yearlyContribution - Total contribution for that year
 * @property {number} capitalAtStart - Capital at start of year
 * @property {number} capitalAtEnd - Capital at end of year
 * @property {number} returnAmount - Return earned that year
 * @property {number} cumulativeContributions - Total contributions up to this year
 */

/**
 * Main calculation function
 * @param {CalculationInput} input - Input parameters
 * @returns {CalculationResult} Calculation results
 */
function calculateFinancialScenario(input) {
  const {
    currentAge,
    startAge,
    monthlyContribution,
    yearlyDynamicPercent,
    startCapital,
    returnRatePA,
    inflationRatePA,
    taxRate
  } = input;

  // Calculate runtime
  const runtimeYears = currentAge - startAge;
  
  if (runtimeYears <= 0) {
    throw new Error('Current age must be greater than start age');
  }

  // Convert percentages to decimals
  const returnRate = returnRatePA / 100;
  const inflationRate = inflationRatePA / 100;
  const dynamicIncrease = yearlyDynamicPercent / 100;
  const tax = taxRate / 100;

  // Arrays to store yearly data
  const yearlyBreakdown = [];
  
  // Running totals
  let capital = startCapital;
  let cumulativeContributions = startCapital;
  let currentMonthlyContribution = monthlyContribution;

  // === 1 & 2: Calculate Total Contributions and Nominal End Value year by year ===
  for (let year = 1; year <= runtimeYears; year++) {
    const age = startAge + year;
    
    // Calculate this year's contribution
    const yearlyContribution = currentMonthlyContribution * 12;
    
    // Store capital at start of year
    const capitalAtStart = capital;
    
    // Add yearly contribution to capital (assumed to be spread throughout the year)
    // For simplicity, we add it at mid-year or distribute it
    // More accurate: add monthly with partial returns, but for this model:
    // We'll add the full yearly contribution at start, then apply return
    capital += yearlyContribution;
    cumulativeContributions += yearlyContribution;
    
    // Apply return rate for this year
    const returnAmount = capital * returnRate;
    capital += returnAmount;
    
    // Store data for this year
    yearlyBreakdown.push({
      year,
      age,
      monthlyContribution: currentMonthlyContribution,
      yearlyContribution,
      capitalAtStart,
      capitalAtEnd: capital,
      returnAmount,
      cumulativeContributions
    });
    
    // Increase monthly contribution for next year
    currentMonthlyContribution = currentMonthlyContribution * (1 + dynamicIncrease);
  }

  // Final values
  const totalContributions = cumulativeContributions;
  const nominalEndValue = capital;
  const totalProfit = nominalEndValue - totalContributions;

  // === 4: Calculate Tax and Net Value ===
  // Tax is only on profit, not on total sum
  const taxAmount = totalProfit > 0 ? totalProfit * tax : 0;
  const netEndValue = nominalEndValue - taxAmount;

  // === 3: Calculate Real Value (Cash on Account with inflation) ===
  // Each year's contribution must be discounted by the remaining years of inflation
  // Start capital is discounted by full runtime
  // Year 1 contributions are discounted by (runtime - 1) years
  // Year 2 contributions are discounted by (runtime - 2) years
  // ...
  // Final year contributions are not discounted (0 years remaining)
  
  let realValue = 0;
  
  // Discount start capital by full runtime
  realValue += startCapital / Math.pow(1 + inflationRate, runtimeYears);
  
  // Reset for iteration
  currentMonthlyContribution = monthlyContribution;
  
  for (let year = 1; year <= runtimeYears; year++) {
    const remainingYears = runtimeYears - year;
    const yearlyContribution = currentMonthlyContribution * 12;
    
    // Discount this year's contribution by remaining years
    const discountedContribution = yearlyContribution / Math.pow(1 + inflationRate, remainingYears);
    realValue += discountedContribution;
    
    // Increase for next iteration
    currentMonthlyContribution = currentMonthlyContribution * (1 + dynamicIncrease);
  }

  // === 5: Calculate Purchasing Power ===
  // Discount final values by full runtime inflation
  const purchasingPowerNominal = nominalEndValue / Math.pow(1 + inflationRate, runtimeYears);
  const purchasingPowerNet = netEndValue / Math.pow(1 + inflationRate, runtimeYears);

  // Calculate effective return
  const effectiveReturn = (Math.pow(nominalEndValue / startCapital, 1 / runtimeYears) - 1) * 100;

  return {
    totalContributions,
    nominalEndValue,
    totalProfit,
    taxAmount,
    netEndValue,
    realValueCashOnAccount: realValue,
    purchasingPowerNominal,
    purchasingPowerNet,
    effectiveReturn,
    yearlyBreakdown,
    runtimeYears
  };
}

/**
 * Alternative calculation with monthly granularity for higher accuracy
 * This version compounds monthly and applies contributions monthly
 * @param {CalculationInput} input - Input parameters
 * @returns {CalculationResult} Calculation results
 */
function calculateFinancialScenarioMonthly(input) {
  const {
    currentAge,
    startAge,
    monthlyContribution,
    yearlyDynamicPercent,
    startCapital,
    returnRatePA,
    inflationRatePA,
    taxRate
  } = input;

  const runtimeYears = currentAge - startAge;
  const totalMonths = runtimeYears * 12;
  
  if (runtimeYears <= 0) {
    throw new Error('Current age must be greater than start age');
  }

  // Convert annual rates to monthly
  const monthlyReturnRate = Math.pow(1 + returnRatePA / 100, 1/12) - 1;
  const monthlyInflationRate = Math.pow(1 + inflationRatePA / 100, 1/12) - 1;
  const monthlyDynamicIncrease = Math.pow(1 + yearlyDynamicPercent / 100, 1/12) - 1;
  const tax = taxRate / 100;

  let capital = startCapital;
  let cumulativeContributions = startCapital;
  let currentMonthlyContribution = monthlyContribution;
  
  const monthlyBreakdown = [];
  const yearlyBreakdown = [];

  // Month-by-month calculation
  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);
    const monthInYear = ((month - 1) % 12) + 1;
    
    // Apply dynamic increase at the start of each year (except first)
    if (month > 1 && monthInYear === 1) {
      currentMonthlyContribution = currentMonthlyContribution * (1 + yearlyDynamicPercent / 100);
    }
    
    // Store capital at start of month
    const capitalAtStart = capital;
    
    // Add monthly contribution
    capital += currentMonthlyContribution;
    cumulativeContributions += currentMonthlyContribution;
    
    // Apply monthly return
    const returnAmount = capital * monthlyReturnRate;
    capital += returnAmount;
    
    monthlyBreakdown.push({
      month,
      year,
      contribution: currentMonthlyContribution,
      capitalAtStart,
      capitalAtEnd: capital,
      returnAmount
    });
  }

  // Build yearly summary from monthly data
  for (let y = 1; y <= runtimeYears; y++) {
    const yearMonths = monthlyBreakdown.filter(m => m.year === y);
    const firstMonth = yearMonths[0];
    const lastMonth = yearMonths[yearMonths.length - 1];
    
    const yearlyContribution = yearMonths.reduce((sum, m) => sum + m.contribution, 0);
    
    yearlyBreakdown.push({
      year: y,
      age: startAge + y,
      monthlyContribution: firstMonth.contribution,
      yearlyContribution,
      capitalAtStart: firstMonth.capitalAtStart,
      capitalAtEnd: lastMonth.capitalAtEnd,
      returnAmount: yearMonths.reduce((sum, m) => sum + m.returnAmount, 0),
      cumulativeContributions: lastMonth.capitalAtEnd - lastMonth.capitalAtEnd + startCapital + 
        monthlyBreakdown.filter(m => m.year <= y).reduce((sum, m) => sum + m.contribution, 0)
    });
  }

  // Final calculations
  const totalContributions = cumulativeContributions;
  const nominalEndValue = capital;
  const totalProfit = nominalEndValue - totalContributions;
  const taxAmount = totalProfit > 0 ? totalProfit * tax : 0;
  const netEndValue = nominalEndValue - taxAmount;

  // Calculate real value with monthly discounting
  let realValue = startCapital / Math.pow(1 + inflationRatePA / 100, runtimeYears);
  
  currentMonthlyContribution = monthlyContribution;
  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);
    const monthInYear = ((month - 1) % 12) + 1;
    
    if (month > 1 && monthInYear === 1) {
      currentMonthlyContribution = currentMonthlyContribution * (1 + yearlyDynamicPercent / 100);
    }
    
    const remainingMonths = totalMonths - month;
    const discountedContribution = currentMonthlyContribution / Math.pow(1 + monthlyInflationRate, remainingMonths);
    realValue += discountedContribution;
  }

  // Purchasing power
  const inflationFactor = Math.pow(1 + inflationRatePA / 100, runtimeYears);
  const purchasingPowerNominal = nominalEndValue / inflationFactor;
  const purchasingPowerNet = netEndValue / inflationFactor;

  const effectiveReturn = (Math.pow(nominalEndValue / startCapital, 1 / runtimeYears) - 1) * 100;

  return {
    totalContributions,
    nominalEndValue,
    totalProfit,
    taxAmount,
    netEndValue,
    realValueCashOnAccount: realValue,
    purchasingPowerNominal,
    purchasingPowerNet,
    effectiveReturn,
    yearlyBreakdown,
    monthlyBreakdown,
    runtimeYears
  };
}

/**
 * Format currency for display
 * @param {number} value - Value to format
 * @param {string} locale - Locale (default: 'de-DE')
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, locale = 'de-DE') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format percentage for display
 * @param {number} value - Value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
function formatPercent(value, decimals = 2) {
  return value.toFixed(decimals).replace('.', ',') + '%';
}

// Export for use in FinanzRechner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateFinancialScenario,
    calculateFinancialScenarioMonthly,
    formatCurrency,
    formatPercent
  };
}
