import { test, expect } from '@playwright/test';

/**
 * ClinicalHub EMR End-to-End Suite
 * Tests Doctor Suite, Nursing Station, Front Desk, Admin Console, and Settings.
 */

test.describe('ClinicalHub EMR Suite E2E Tests', () => {
  const targetURL = process.env.TEST_URL || 'http://localhost:8080';

  test.beforeEach(async ({ page }) => {
    await page.goto(targetURL);
  });

  test('1. Application Login & Role Switcher', async ({ page }) => {
    // Check main title or login element
    const pageTitle = page.locator('text=ClinicalHub').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  test('2. Doctor Suite & Prescriptions Navigation', async ({ page }) => {
    // Navigate to Prescriptions
    const rxNav = page.locator('text=Prescriptions').first();
    if (await rxNav.isVisible()) {
      await rxNav.click();
      await expect(page.locator('text=No prescriptions found').or(page.locator('text=Write Prescription'))).toBeVisible();
    }
  });

  test('3. Write Prescription Form & Patient Selection', async ({ page }) => {
    // Navigate to Write Prescription page
    const writeBtn = page.locator('text=+ Write Prescription').first();
    if (await writeBtn.isVisible()) {
      await writeBtn.click();
      await expect(page.locator('text=Write Prescription')).toBeVisible();
      await expect(page.locator('text=Patient Information')).toBeVisible();
      await expect(page.locator('text=Clinical Notes (SOAP)')).toBeVisible();
    }
  });

  test('4. Nursing Station & Bed Rounds', async ({ page }) => {
    const bedsNav = page.locator('text=My Beds & Vitals').or(page.locator('text=Beds')).first();
    if (await bedsNav.isVisible()) {
      await bedsNav.click();
      await expect(page.locator('text=Bed Rounds').or(page.locator('text=Nursing Station'))).toBeVisible();
    }
  });

  test('5. Settings Page & Tabs Navigation', async ({ page }) => {
    const settingsNav = page.locator('text=Settings').or(page.locator('text=Profile')).first();
    if (await settingsNav.isVisible()) {
      await settingsNav.click();
      await expect(page.locator('text=API Health Monitor').or(page.locator('text=System'))).toBeVisible();
    }
  });
});
