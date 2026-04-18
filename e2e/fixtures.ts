/**
 * Playwright test fixtures for E2E tests.
 * Provides reusable authenticated context and helper functions.
 */

import { test as base, expect, Page } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'test.user@cellebrite.com',
  name: 'Test User',
};

// Extend base test with custom fixtures
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  // Fixture that provides an authenticated page
  authenticatedPage: async ({ page }, use) => {
    // Navigate to app and login
    await page.goto('/');
    
    // Wait for login page (SiX text might be a paragraph or heading)
    await expect(page.getByText(/SiX/i).first()).toBeVisible();
    
    // Fill in email and submit
    const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
    await emailInput.fill(TEST_USER.email);
    await page.getByRole('button', { name: /continue/i }).click();
    
    // Wait for navigation to home page
    await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });
    
    // Use the authenticated page
    await use(page);
  },
});

export { expect };
