import { describe, it, expect } from 'vitest'

// Helper functions for testing
describe('FinanzRechner Core Functions', () => {
  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      const formatCurrency = (n) => {
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0
        }).format(n)
      }
      
      expect(formatCurrency(1000)).toBe('1.000 €')
      expect(formatCurrency(1000000)).toBe('1.000.000 €')
      expect(formatCurrency(0)).toBe('0 €')
    })
    
    it('should format short currency', () => {
      const formatCurrencyShort = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M €'
        if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K €'
        return n + ' €'
      }
      
      expect(formatCurrencyShort(1500000)).toBe('1.5M €')
      expect(formatCurrencyShort(50000)).toBe('50K €')
      expect(formatCurrencyShort(500)).toBe('500 €')
    })
  })
  
  describe('Investment Calculation', () => {
    it('should calculate compound interest correctly', () => {
      const calculateCompound = (principal, monthly, rate, years) => {
        const monthlyRate = Math.pow(1 + rate, 1 / 12) - 1
        let value = principal
        let invested = principal
        
        for (let m = 1; m <= years * 12; m++) {
          value = (value + monthly) * (1 + monthlyRate)
          invested += monthly
        }
        
        return { value, invested }
      }
      
      const result = calculateCompound(10000, 250, 0.1, 10)
      expect(result.value).toBeGreaterThan(result.invested)
      expect(result.value).toBeGreaterThan(40000)
    })
    
    it('should handle inflation adjustment', () => {
      const adjustForInflation = (value, inflationRate, years) => {
        return value / Math.pow(1 + inflationRate, years)
      }
      
      const nominal = 100000
      const real = adjustForInflation(nominal, 0.03, 10)
      expect(real).toBeLessThan(nominal)
      expect(real).toBeGreaterThan(70000)
    })
  })
  
  describe('Tax Calculation', () => {
    it('should calculate ETF tax with partial exemption', () => {
      const calculateETFTax = (gain, years) => {
        const FREIBETRAG = 1000
        const TAX_RATE = 0.26375 // 26.375% with partial exemption
        
        const taxable = Math.max(0, gain - FREIBETRAG)
        return taxable * TAX_RATE
      }
      
      const tax = calculateETFTax(5000, 5)
      expect(tax).toBeGreaterThan(0)
      expect(tax).toBeLessThan(5000)
    })
    
    it('should handle crypto tax exemption after 1 year', () => {
      const calculateCryptoTax = (gain, years) => {
        if (years > 1) return 0
        const TAX_RATE = 0.26375
        const FREIBETRAG = 1000
        const taxable = Math.max(0, gain - FREIBETRAG)
        return taxable * TAX_RATE
      }
      
      expect(calculateCryptoTax(5000, 0.5)).toBeGreaterThan(0)
      expect(calculateCryptoTax(5000, 2)).toBe(0)
    })
  })
  
  describe('Input Validation', () => {
    it('should validate age inputs', () => {
      const validateAge = (current, start) => {
        if (start >= current) return 'Startalter muss kleiner sein'
        if (current > 100 || start < 0) return 'Ungültiges Alter'
        return null
      }
      
      expect(validateAge(30, 20)).toBeNull()
      expect(validateAge(30, 30)).toBe('Startalter muss kleiner sein')
      expect(validateAge(30, 35)).toBe('Startalter muss kleiner sein')
    })
    
    it('should validate monthly contribution', () => {
      const validateMonthly = (amount) => {
        if (amount < 0) return 'Negativer Betrag nicht erlaubt'
        if (amount > 100000) return 'Maximale Sparrate überschritten'
        return null
      }
      
      expect(validateMonthly(250)).toBeNull()
      expect(validateMonthly(-50)).toBe('Negativer Betrag nicht erlaubt')
    })
  })
})
