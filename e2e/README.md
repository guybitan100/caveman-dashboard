# E2E Testing Guide

End-to-End tests for the SiX Frontend using Playwright.

## Overview

E2E tests simulate real user interactions with the application, testing critical flows from the user's perspective. These tests run in a real browser and interact with the actual UI.

## Test Structure

```
e2e/
├── fixtures.ts          # Reusable test fixtures and helpers
├── auth.spec.ts         # Authentication flow tests (20+ tests)
└── jobs.spec.ts         # Job management tests (25+ tests)
```

## Prerequisites

```bash
# Install Playwright browsers (first time only)
npx playwright install
```

## Running Tests

### Run all E2E tests

```bash
npm run test:e2e
```

### Run specific test file

```bash
npx playwright test e2e/auth.spec.ts
```

### Run in headed mode (see the browser)

```bash
npx playwright test --headed
```

### Run in debug mode (pause execution)

```bash
npx playwright test --debug
```

### Run in UI mode (interactive)

```bash
npx playwright test --ui
```

### Run specific test by name

```bash
npx playwright test -g "should successfully login"
```

## Test Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173`
- **Browser**: Chromium (Desktop Chrome)
- **Retries**: 2 in CI, 0 locally
- **Screenshots**: Only on failure
- **Trace**: On first retry
- **Auto web server**: Starts dev server automatically

## Writing Tests

### Basic Structure

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Hello")).toBeVisible();
  });
});
```

### Using Authenticated Context

```typescript
import { test, expect } from "./fixtures";

test("should access protected route", async ({ authenticatedPage: page }) => {
  // Already logged in!
  await expect(page.getByText(/Let's generate a UFDR/i)).toBeVisible();
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for elements**: Use `await expect(...).toBeVisible()` instead of `waitForTimeout`
3. **Use test fixtures**: Leverage `authenticatedPage` for tests requiring login
4. **Clean state**: Tests should be independent and not rely on each other
5. **Meaningful names**: Use descriptive test names that explain the behavior

### Locator Best Practices

```typescript
// Good - semantic and accessible
await page.getByRole("button", { name: /submit/i });
await page.getByLabel("Email");
await page.getByPlaceholder("Enter your email");
await page.getByText("Welcome");

// Avoid - brittle CSS selectors
await page.locator(".button-class");
await page.locator("#submit-btn");
```

## Debugging

### Visual Debugging

```bash
# Open Playwright Inspector
npx playwright test --debug

# Take screenshot at specific point
await page.screenshot({ path: 'screenshot.png' });

# Pause execution
await page.pause();
```

### View Test Reports

After running tests, open the HTML report:

```bash
npx playwright show-report
```

### View Traces

If a test fails with retries, view the trace:

```bash
npx playwright show-trace trace.zip
```

## CI/CD Integration

Tests are configured to run in CI with:

- 2 retries for flaky tests
- HTML + list + GitHub reporters
- Screenshots on failure
- Trace on first retry

Add to GitHub Actions:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Common Issues

### Port Already in Use

If `localhost:5173` is already in use:

```bash
# Kill the process
lsof -ti:5173 | xargs kill -9

# Or change the port in playwright.config.ts
```

### Tests Timing Out

Increase timeout for slow tests:

```typescript
test("slow test", async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### Flaky Tests

Add explicit waits:

```typescript
// Wait for specific condition
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Welcome");

// Add buffer for animations
await page.waitForTimeout(500);
```

## Test Data Management

### Test User

Defined in `fixtures.ts`:

```typescript
export const TEST_USER = {
  email: "test.user@cellebrite.com",
  name: "Test User",
};
```

### Creating Test Jobs

```typescript
const jobName = `E2E Test Job ${Date.now()}`;
await page.getByRole("button", { name: /new job/i }).click();
await page.getByLabel(/job name/i).fill(jobName);
await page.getByRole("button", { name: /create/i }).click();
```

### Cleaning Up

Tests should clean up after themselves:

```typescript
test.afterEach(async ({ page }) => {
  // Delete created jobs
  // Clear test data
});
```

## Performance

### Parallelization

Playwright runs tests in parallel by default. Control with:

```typescript
// In playwright.config.ts
workers: process.env.CI ? 1 : undefined,
```

### Test Isolation

Each test gets a fresh:

- Browser context
- localStorage
- sessionStorage
- Cookies

## Troubleshooting

### Browser Not Installed

```bash
npx playwright install chromium
```

### Port Conflicts

```bash
# Check what's using port 5173
lsof -i :5173

# Change port in vite.config.ts and playwright.config.ts
```

### Slow Tests

Use `trace: 'on'` to analyze slow operations:

```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Debugging Guide](https://playwright.dev/docs/debug)

## Contributing

When adding new E2E tests:

1. Follow existing patterns in `auth.spec.ts` and `jobs.spec.ts`
2. Use the `authenticatedPage` fixture for tests requiring login
3. Write descriptive test names
4. Add comments for complex interactions
5. Ensure tests are isolated and can run independently
6. Run tests locally before committing:
   ```bash
   npm run test:e2e
   ```
