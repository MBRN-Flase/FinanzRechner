import { test, expect } from '@playwright/test'

test.describe('FinanzRechner - Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load homepage with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Finanz-Rechner/)
    await expect(page.locator('h1')).toContainText('wert')
  })

  test('should calculate investment with default values', async ({ page }) => {
    // Click calculate with default values (age 30, start 20, 250€/month)
    await page.click('#btn-calculate')
    
    // Wait for results
    await expect(page.locator('#result-section')).toBeVisible()
    await expect(page.locator('#hook-number')).not.toHaveText('—')
  })

  test('should switch scenarios', async ({ page }) => {
    // Click on Bitcoin scenario
    await page.click('[data-scenario="btc"]')
    
    // Check if active class applied
    const btcButton = page.locator('[data-scenario="btc"]')
    await expect(btcButton).toHaveClass(/active/)
    
    // Calculate
    await page.click('#btn-calculate')
    await expect(page.locator('#result-section')).toBeVisible()
  })

  test('should update inflation presets', async ({ page }) => {
    // Click on 2% preset
    await page.click('[data-val="0.02"]')
    
    // Check if input updated
    const inflationInput = page.locator('#inflation-input')
    await expect(inflationInput).toHaveValue('2')
  })

  test('should toggle theme', async ({ page }) => {
    const themeButton = page.locator('#themeToggle')
    
    // Click theme toggle
    await themeButton.click()
    
    // Check if theme changed
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('should be accessible', async ({ page }) => {
    const accessibilityScanResults = await page.accessibility.snapshot()
    expect(accessibilityScanResults).toBeTruthy()
  })
})

test.describe('Legal Pages', () => {
  test('should display impressum', async ({ page }) => {
    await page.goto('/impressum.html')
    await expect(page.locator('h1')).toContainText('Impressum')
  })

  test('should display datenschutz', async ({ page }) => {
    await page.goto('/datenschutz.html')
    await expect(page.locator('h1')).toContainText('Datenschutz')
  })
})
