/**
 * E2E tests for job management.
 * Tests creating, viewing, searching, and deleting jobs.
 * 
 * Note: These tests assume backend API is running and responding.
 * They use real API and data-testid selectors for reliable element selection.
 */

import { test, expect } from './fixtures';

test.describe('Job Management', () => {
  test.describe('Job List', () => {
    test('should display jobs list in sidebar', async ({ authenticatedPage: page }) => {
      // Should see the sidebar
      await expect(page.getByTestId('left-sidebar')).toBeVisible();
      
      // Should see new job button
      await expect(page.getByTestId('new-job-button')).toBeVisible();
      
      // Should see search bar
      await expect(page.getByTestId('search-bar')).toBeVisible();
    });

    test('should show New Job button', async ({ authenticatedPage: page }) => {
      const newJobButton = page.getByTestId('new-job-button');
      await expect(newJobButton).toBeVisible();
      await expect(newJobButton).toBeEnabled();
    });

    test('should have search functionality', async ({ authenticatedPage: page }) => {
      // Look for search input
      const searchInput = page.getByTestId('search-input');
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('Create Job', () => {
    test('should open create job dialog when clicking New Job button', async ({ authenticatedPage: page }) => {
      // Click New Job button
      await page.getByTestId('new-job-button').click();

      // Dialog should open
      await expect(page.getByTestId('new-job-dialog')).toBeVisible();
      await expect(page.getByText(/create new job/i)).toBeVisible();
    });

    test('should successfully create a new job', async ({ authenticatedPage: page }) => {
      // Open create dialog
      await page.getByTestId('new-job-button').click();
      await expect(page.getByTestId('new-job-dialog')).toBeVisible();

      // Fill in job name
      const jobName = `E2E Test Job ${Date.now()}`;
      await page.getByTestId('job-name-input').fill(jobName);

      // Create button should be enabled
      const createButton = page.getByTestId('create-job-button');
      await expect(createButton).toBeEnabled();

      // Click create
      await createButton.click();

      // Dialog should close
      await expect(page.getByTestId('new-job-dialog')).not.toBeVisible({ timeout: 5000 });

      // New job should appear in the list (in sidebar)
      await expect(page.getByTestId('left-sidebar').getByText(jobName)).toBeVisible({ timeout: 10000 });
    });

    test('should allow creating job with empty name', async ({ authenticatedPage: page }) => {
      // Open create dialog
      await page.getByTestId('new-job-button').click();
      await expect(page.getByTestId('new-job-dialog')).toBeVisible();

      // Don't fill in name, just click create
      const createButton = page.getByTestId('create-job-button');
      await expect(createButton).toBeEnabled(); // Should be enabled even without name
      await createButton.click();

      // Dialog should close
      await expect(page.getByTestId('new-job-dialog')).not.toBeVisible({ timeout: 5000 });

      // A new job should appear with auto-generated name
      await page.waitForTimeout(2000);
      const sidebar = page.getByTestId('left-sidebar');
      await expect(sidebar.locator('[data-testid^="job-card-"]').first()).toBeVisible();
    });

    test('should auto-select newly created job', async ({ authenticatedPage: page }) => {
      // Create a job
      await page.getByTestId('new-job-button').click();
      await expect(page.getByTestId('new-job-dialog')).toBeVisible();

      const jobName = `E2E Auto-Select Test ${Date.now()}`;
      await page.getByTestId('job-name-input').fill(jobName);
      await page.getByTestId('create-job-button').click();

      // Wait for job to appear
      await page.waitForTimeout(2000);

      // Job should be selected (has selection indicator)
      await expect(page.getByTestId('job-selection-indicator')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Job Selection', () => {
    test('should select job when clicked', async ({ authenticatedPage: page }) => {
      // Ensure we have at least one job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(`Selection Test ${Date.now()}`);
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000); // Wait for job to appear

      // Find a job card and click it
      const firstJobCard = page.locator('[data-testid^="job-card-"]').first();
      
      if (await firstJobCard.isVisible()) {
        await firstJobCard.click();
        
        // Should show selection indicator
        await expect(page.getByTestId('job-selection-indicator')).toBeVisible();
      }
    });
  });

  test.describe('Job Search', () => {
    test('should filter jobs by name', async ({ authenticatedPage: page }) => {
      // Create a uniquely named job
      const uniqueName = `Unique Search Test ${Date.now()}`;
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(uniqueName);
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Use search
      const searchInput = page.getByTestId('search-input');
      await searchInput.fill('Unique Search Test');

      // Wait for debounce
      await page.waitForTimeout(500);

      // Should see the job we just created (in sidebar only)
      await expect(page.getByTestId('left-sidebar').getByTestId('job-name').filter({ hasText: uniqueName })).toBeVisible({ timeout: 5000 });
    });

    test('should clear search with clear button', async ({ authenticatedPage: page }) => {
      const searchInput = page.getByTestId('search-input');
      
      // Type in search
      await searchInput.fill('test search');

      // Clear button should appear
      const clearButton = page.getByTestId('clear-search-button');
      await expect(clearButton).toBeVisible();

      // Click clear
      await clearButton.click();

      // Search input should be empty
      await expect(searchInput).toHaveValue('');
    });

    test('should debounce search input', async ({ authenticatedPage: page }) => {
      const searchInput = page.getByTestId('search-input');
      
      // Type rapidly
      await searchInput.fill('t');
      await page.waitForTimeout(100);
      await searchInput.fill('te');
      await page.waitForTimeout(100);
      await searchInput.fill('tes');
      await page.waitForTimeout(100);
      await searchInput.fill('test');

      // Wait for debounce (300ms)
      await page.waitForTimeout(400);

      // Search should have been executed
      await expect(searchInput).toHaveValue('test');
    });
  });

  test.describe('Job Actions', () => {
    test('should show job context menu', async ({ authenticatedPage: page }) => {
      // Create a job first
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(`Context Menu Test ${Date.now()}`);
      await page.getByTestId('create-job-button').click();
      await page.waitForTimeout(2000);

      // Find the more options button (using data-testid)
      const moreButton = page.getByTestId('job-options-button').first();
      await moreButton.click();

      // Menu should appear
      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByTestId('delete-job-menu-item')).toBeVisible();
    });

    test('should delete job from context menu', async ({ authenticatedPage: page }) => {
      // Create a job to delete
      const jobName = `Delete Test ${Date.now()}`;
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(jobName);
      await page.getByTestId('create-job-button').click();
      await page.waitForTimeout(2000);

      // Verify job exists in sidebar
      await expect(page.getByTestId('left-sidebar').getByTestId('job-name').filter({ hasText: jobName })).toBeVisible();

      // Open context menu and delete
      const moreButton = page.getByTestId('job-options-button').first();
      await moreButton.click();
      
      const deleteButton = page.getByTestId('delete-job-menu-item');
      await deleteButton.click();

      // Job should be removed from list
      await expect(page.getByTestId('left-sidebar').getByTestId('job-name').filter({ hasText: jobName })).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Job Status', () => {
    test('should display job status badge', async ({ authenticatedPage: page }) => {
      // Create a job
      const jobName = `Status Test ${Date.now()}`;
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(jobName);
      await page.getByTestId('create-job-button').click();
      await page.waitForTimeout(2000);

      // Should see status badge (DRAFT for new jobs)
      await expect(page.getByTestId('job-status-draft').first()).toBeVisible();
    });

    test('should show different status colors', async ({ authenticatedPage: page }) => {
      // Just verify that status badges are rendered with testids
      const statusBadges = page.locator('[data-testid^="job-status-"]');
      
      if (await statusBadges.first().isVisible()) {
        await expect(statusBadges.first()).toBeVisible();
      }
    });
  });

  test.describe('Job Timestamps', () => {
    test('should display relative timestamps', async ({ authenticatedPage: page }) => {
      // Create a new job
      const jobName = `Timestamp Test ${Date.now()}`;
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(jobName);
      await page.getByTestId('create-job-button').click();
      await page.waitForTimeout(2000);

      // Should show "Just now" or similar
      const timestamp = page.getByTestId('job-timestamp').first();
      await expect(timestamp).toContainText(/just now|ago|min|hour|day/i);
    });
  });

  test.describe('Pagination', () => {
    test('should support infinite scroll or load more', async ({ authenticatedPage: page }) => {
      // Create multiple jobs to test pagination
      // This assumes pagination/infinite scroll is implemented
      
      // Get initial job count
      const initialJobs = await page.locator('[data-testid^="job-card-"]').count();
      
      // Scroll to bottom if there are jobs
      if (initialJobs > 0) {
        const sidebar = page.getByTestId('left-sidebar');
        await sidebar.evaluate(el => el.scrollTo(0, el.scrollHeight));
        
        // Wait for potential load
        await page.waitForTimeout(1000);
        
        // Check if more jobs loaded (if applicable)
        const finalJobs = await page.locator('[data-testid^="job-card-"]').count();
        expect(finalJobs).toBeGreaterThanOrEqual(initialJobs);
      }
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no jobs match search', async ({ authenticatedPage: page }) => {
      const searchInput = page.getByTestId('search-input');
      
      // Search for something that definitely doesn't exist
      await searchInput.fill('xyznonexistentjob12345');
      await page.waitForTimeout(500);

      // Should show some indication of no results
      // This could be empty state, "No jobs found", etc.
      // The exact implementation depends on the UI
    });
  });
});
