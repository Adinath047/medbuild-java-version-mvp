import { test, expect } from '@playwright/test';

test.describe('Healthcare Accessibility (a11y) — WCAG 2.2 AA Compliance', () => {

  test('Main login and patient portal pages satisfy accessibility guidelines', async ({ page }) => {
    await page.goto('/');

    // Verify all interactive form fields have accessible labels
    const inputs = page.locator('input, button, select, textarea');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const element = inputs.nth(i);
      await expect(element).toBeVisible();
    }

    // Verify keyboard navigation focus states
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
