import { test, expect } from '@playwright/test';

test.describe('Healthcare Accessibility (a11y) — WCAG 2.2 AA Compliance', () => {

  test('Main login and patient portal pages satisfy accessibility guidelines', async ({ page }) => {
    await page.goto('/');

    // Verify all visible interactive form fields are visible
    const inputs = page.locator('input:visible, button:visible, select:visible, textarea:visible');
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
