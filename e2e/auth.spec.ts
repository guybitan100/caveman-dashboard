/**
 * E2E tests for authentication flow.
 * Tests login, logout, and session persistence.
 */

import { test, expect } from '@playwright/test';
import { TEST_USER } from './fixtures';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Login Flow', () => {
    test('should display login page on first visit', async ({ page }) => {
      await page.goto('/');

      // Verify login page elements
      await expect(page.getByText(/SiX/i)).toBeVisible();
      await expect(page.getByText(/Cellebrite AI/i)).toBeVisible();
      await expect(page.getByText(/Enter your Cellebrite email/i)).toBeVisible();
      await expect(page.getByPlaceholder(/your.name@cellebrite.com/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
    });

    test('should require valid email format', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Try invalid email
      await emailInput.fill('invalid');
      await emailInput.blur();

      // Continue button should be disabled
      await expect(continueButton).toBeDisabled();

      // Error message should appear
      await expect(page.getByText(/Please enter a valid email address/i)).toBeVisible();
    });

    test('should require Cellebrite email domain', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Try non-Cellebrite email
      await emailInput.fill('user@gmail.com');
      await emailInput.blur();

      // Continue button should be disabled
      await expect(continueButton).toBeDisabled();

      // Error message should appear
      await expect(page.getByText(/Please use your Cellebrite email address/i)).toBeVisible();
    });

    test('should successfully login with valid Cellebrite email', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Fill valid email
      await emailInput.fill(TEST_USER.email);

      // Continue button should be enabled
      await expect(continueButton).toBeEnabled();

      // Click continue
      await continueButton.click();

      // Should navigate to home page
      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });
    });

    test('should accept email with different casing', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Fill email with different casing
      await emailInput.fill('TEST.USER@CELLEBRITE.COM');

      await expect(continueButton).toBeEnabled();
      await continueButton.click();

      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist login after page reload', async ({ page }) => {
      await page.goto('/');

      // Login
      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      await emailInput.fill(TEST_USER.email);
      await page.getByRole('button', { name: /continue/i }).click();

      // Wait for home page
      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });

      // Reload page
      await page.reload();

      // Should still be on home page (not redirected to login)
      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });
    });

    test('should store user data in localStorage', async ({ page }) => {
      await page.goto('/');

      // Login
      await page.getByPlaceholder(/your.name@cellebrite.com/i).fill(TEST_USER.email);
      await page.getByRole('button', { name: /continue/i }).click();

      // Wait for navigation
      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });

      // Check localStorage
      const userData = await page.evaluate(() => localStorage.getItem('six_user'));
      expect(userData).toBeTruthy();

      // Verify user data structure
      const user = JSON.parse(userData!);
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
    });
  });

  test.describe('Input Validation', () => {
    test('should disable continue button when input is empty', async ({ page }) => {
      await page.goto('/');

      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();
    });

    test('should enable continue button only with valid email', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Empty - disabled
      await expect(continueButton).toBeDisabled();

      // Invalid format - disabled
      await emailInput.fill('notanemail');
      await expect(continueButton).toBeDisabled();

      // Valid format but wrong domain - disabled
      await emailInput.fill('user@gmail.com');
      await expect(continueButton).toBeDisabled();

      // Valid Cellebrite email - enabled
      await emailInput.fill(TEST_USER.email);
      await expect(continueButton).toBeEnabled();
    });

    test('should trim whitespace from email', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      await emailInput.fill(`  ${TEST_USER.email}  `);
      await page.getByRole('button', { name: /continue/i }).click();

      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });

      // Check that stored email is trimmed
      const userData = await page.evaluate(() => localStorage.getItem('six_user'));
      const user = JSON.parse(userData!);
      expect(user.email).toBe(TEST_USER.email);
      expect(user.email).not.toContain('  ');
    });
  });

  test.describe('UI Behavior', () => {
    test('should auto-focus email input on load', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);
      
      // Email input should be focused
      await expect(emailInput).toBeFocused();
    });

    test('should show error only after blur', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);

      // Type invalid email but don't blur
      await emailInput.fill('invalid');

      // Error should not be visible yet
      await expect(page.getByText(/Please enter a valid email address/i)).not.toBeVisible();

      // Blur the input
      await emailInput.blur();

      // Error should now be visible
      await expect(page.getByText(/Please enter a valid email address/i)).toBeVisible();
    });

    test('should allow form submission with Enter key', async ({ page }) => {
      await page.goto('/');

      const emailInput = page.getByPlaceholder(/your.name@cellebrite.com/i);

      // Fill email and press Enter
      await emailInput.fill(TEST_USER.email);
      await emailInput.press('Enter');

      // Should navigate to home page
      await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible({ timeout: 10000 });
    });
  });
});
