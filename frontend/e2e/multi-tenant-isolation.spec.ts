import { test, expect } from '@playwright/test';

test.describe('Healthcare Security — Multi-Tenant Isolation & IDOR Prevention', () => {

  test('Doctor in Clinic A cannot access Patient belonging to Clinic B', async ({ browser }) => {
    // 1. Launch Browser Context for Doctor A (Clinic A)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // 2. Launch Browser Context for Doctor B (Clinic B)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Simulate Doctor A session
    await pageA.goto('/portal');
    await pageA.evaluate(() => {
      localStorage.setItem('auth_token', 'JWT_DOCTOR_CLINIC_A_TOKEN');
      localStorage.setItem('tenant_id', 'CLINIC_A');
    });

    // Simulate Doctor B session
    await pageB.goto('/portal');
    await pageB.evaluate(() => {
      localStorage.setItem('auth_token', 'JWT_DOCTOR_CLINIC_B_TOKEN');
      localStorage.setItem('tenant_id', 'CLINIC_B');
    });

    // Doctor A attempts IDOR request to fetch Clinic B patient record
    const response = await pageA.request.get('/api/patients/PATIENT_CLINIC_B_9999', {
      headers: {
        'Authorization': 'Bearer JWT_DOCTOR_CLINIC_A_TOKEN',
        'X-Tenant-ID': 'CLINIC_B', // Header manipulation attack attempt
      },
    });

    // Server MUST derive tenant_id from JWT and reject cross-tenant access with 403 or 404
    expect([403, 404]).toContain(response.status());

    await contextA.close();
    await contextB.close();
  });
});
