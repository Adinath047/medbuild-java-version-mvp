import { test, expect } from '@playwright/test';

test.describe('PrescriptionsListPage E2E Tests', () => {
  const baseURL = process.env.TEST_URL || 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Intercept API routes to ensure deterministic E2E UI testing
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'doc-001',
            name: 'Dr. Aarav Mehta',
            email: 'doctor@medicos.com',
            role: 'doctor',
            hospitalId: 'hsp-001'
          }
        })
      });
    });

    await page.route('**/api/prescriptions*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'rx-001',
            slip_token: 'SLIP1001',
            patient_id: 'pat-001',
            patient_name: 'Aarav Sharma',
            uhid: 'UHID-1001',
            doctor_name: 'Dr. Aarav Mehta',
            medicines: [
              { name: 'Amoxicillin 500mg', dose: '1 cap', frequency: '1-0-1', duration: '5 days' }
            ],
            advice: 'Take with food',
            follow_up_date: '2026-08-10',
            created_at: new Date().toISOString()
          }
        ])
      });
    });

    await page.goto(baseURL);
    await page.evaluate(() => {
      localStorage.setItem(
        'emr_user',
        JSON.stringify({
          id: 'doc-001',
          name: 'Dr. Aarav Mehta',
          email: 'doctor@medicos.com',
          role: 'doctor',
          hospitalId: 'hsp-001'
        })
      );
    });
    await page.reload();
  });

  test('1. PrescriptionsListPage renders title, action button, and search input', async ({ page }) => {
    const rxNav = page.locator('text=Prescriptions').first();
    await expect(rxNav).toBeVisible({ timeout: 10000 });
    await rxNav.click();

    // Check main page title
    const pageTitle = page.locator('.page-title', { hasText: 'Prescriptions' });
    await expect(pageTitle).toBeVisible();

    // Check "+ Write Prescription" button
    const writeBtn = page.locator('button', { hasText: 'Write Prescription' }).first();
    await expect(writeBtn).toBeVisible();

    // Check search input
    const searchInput = page.locator('input[placeholder*="Search patient"]').first();
    await expect(searchInput).toBeVisible();

    // Test typing in search filter
    await searchInput.fill('Aarav');
    await expect(searchInput).toHaveValue('Aarav');
  });

  test('2. Pre-printed letterhead checkbox toggle works', async ({ page }) => {
    const rxNav = page.locator('text=Prescriptions').first();
    await expect(rxNav).toBeVisible({ timeout: 10000 });
    await rxNav.click();

    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('3. Table renders prescription rows with patient and medicines correctly', async ({ page }) => {
    const rxNav = page.locator('text=Prescriptions').first();
    await expect(rxNav).toBeVisible({ timeout: 10000 });
    await rxNav.click();

    // Expect prescription patient name, slip token, and medicine name
    await expect(page.locator('text=Aarav Sharma')).toBeVisible();
    await expect(page.locator('text=SLIP1001')).toBeVisible();
    await expect(page.locator('text=Amoxicillin 500mg')).toBeVisible();
  });
});
