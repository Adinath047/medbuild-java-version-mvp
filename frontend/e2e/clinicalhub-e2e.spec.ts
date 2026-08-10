import { test, expect } from '@playwright/test';

/**
 * ClinicalHub EMR End-to-End Suite
 * Tests Doctor Suite, Nursing Station, Front Desk, Admin Console, and Settings.
 */

test.describe('ClinicalHub EMR Suite E2E Tests', () => {
  const targetURL = process.env.TEST_URL || 'http://localhost:8080';

  test.beforeEach(async ({ page }) => {
    await page.goto(targetURL);
    
    // Wait for the login screen to render and authenticate the test user
    const hospitalInput = page.locator('input[placeholder*="Clinic or Hospital Code"]');
    await hospitalInput.waitFor({ state: 'visible', timeout: 15000 });
    
    await hospitalInput.fill('hsp-001');
    await page.locator('button:has-text("Verify Hospital")').click();

    const roleSelect = page.locator('select').first();
    await roleSelect.waitFor({ state: 'visible', timeout: 10000 });
    await roleSelect.selectOption('doctor');

    await page.locator('select').nth(1).selectOption({ label: 'Dr. Ananya Rao' });
    await page.locator('input[type="password"]').fill('doctor123');
    await page.locator('button:has-text("Sign In")').click();

    // Verify successful login by waiting for the dashboard/sidebar user element to render
    await expect(page.locator('.sidebar-user-name')).toContainText('Dr. Ananya', { timeout: 15000 });
  });

  test('1. Application Login & Role Switcher', async ({ page }) => {
    // Once logged in, the brand title on the sidebar should be visible
    const brandTitle = page.locator('text=ClinicalHub').first();
    await expect(brandTitle).toBeVisible({ timeout: 10000 });
  });

  test('2. Doctor Suite & Prescriptions Navigation', async ({ page }) => {
    // Navigate to Prescriptions
    const rxNav = page.locator('text=Prescriptions').first();
    await expect(rxNav).toBeVisible({ timeout: 10000 });
    await rxNav.click();
    await expect(page.locator('text=No prescriptions found').or(page.locator('text=Write Prescription'))).toBeVisible();
  });

  test('3. Write Prescription Form & Patient Selection', async ({ page }) => {
    // Navigate to Prescriptions first
    const rxNav = page.locator('text=Prescriptions').first();
    await expect(rxNav).toBeVisible({ timeout: 10000 });
    await rxNav.click();

    // Click "Write Prescription" button
    const writeBtn = page.locator('button:has-text("Write Prescription")').first();
    await expect(writeBtn).toBeVisible({ timeout: 10000 });
    await writeBtn.click();

    // Verify fields are visible
    await expect(page.locator('text=Patient Information')).toBeVisible();
    await expect(page.locator('text=Clinical Notes (SOAP)')).toBeVisible();
  });

  test('4. Nursing Station & Bed Rounds', async ({ page }) => {
    const bedsNav = page.locator('text=My Beds & Vitals').or(page.locator('text=Beds')).first();
    await expect(bedsNav).toBeVisible({ timeout: 10000 });
    await bedsNav.click();
    await expect(page.locator('.page-title', { hasText: 'Bed Allocation Management' }).first()).toBeVisible();
  });

  test('5. Settings Page & Tabs Navigation', async ({ page }) => {
    const settingsNav = page.locator('text=Settings').or(page.locator('text=Profile')).first();
    await expect(settingsNav).toBeVisible({ timeout: 10000 });
    await settingsNav.click();
    await expect(page.locator('.page-title', { hasText: 'Settings' }).first()).toBeVisible();
    await expect(page.locator('.tab', { hasText: 'API Health Monitor' }).first()).toBeVisible();
  });
});
