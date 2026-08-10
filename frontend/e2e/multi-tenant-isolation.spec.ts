import { test, expect } from '@playwright/test';

test.describe('Healthcare Security — Multi-Tenant Isolation & IDOR Prevention', () => {

  test('Doctor in Clinic A cannot access Patient belonging to Clinic B', async ({ browser }) => {
    // 1. Launch Browser Context for Doctor A (Clinic A)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // 2. Launch Browser Context for Doctor B (Clinic B)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Log in Doctor A (Clinic A: hsp-001) using API
    const responseLoginA = await pageA.request.post('/api/auth/login', {
      data: {
        email: 'doctor@medicos.com',
        password: 'doctor123',
        hospitalId: 'hsp-001'
      }
    });
    expect(responseLoginA.status()).toBe(200);
    const loginDataA = await responseLoginA.json();
    const tokenA = loginDataA.token;

    // Log in Doctor B (Clinic B: hsp-002) using API
    const responseLoginB = await pageB.request.post('/api/auth/login', {
      data: {
        email: 'doctor.city@medicos.com',
        password: 'doctor123',
        hospitalId: 'hsp-002'
      }
    });
    expect(responseLoginB.status()).toBe(200);
    const loginDataB = await responseLoginB.json();
    const tokenB = loginDataB.token;

    // Doctor B (Clinic B) attempts to fetch Clinic A patient (pat-c7757203)
    const response = await pageB.request.get('/api/patients/pat-c7757203', {
      headers: {
        'Authorization': `Bearer ${tokenB}`,
        'X-Tenant-ID': 'hsp-001', // Header manipulation attack attempt
      },
    });

    // Server MUST enforce isolation and reject cross-tenant access with 403 or 404
    expect([403, 404]).toContain(response.status());

    await contextA.close();
    await contextB.close();
  });
});
