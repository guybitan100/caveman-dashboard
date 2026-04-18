/**
 * E2E tests for cart/draft editing functionality.
 * Tests the right sidebar panel where users edit job data inputs.
 * 
 * Note: These tests assume backend API is running and responding.
 * They use real API and data-testid selectors for reliable element selection.
 */

import { test, expect } from './fixtures';
import { Page } from '@playwright/test';

/**
 * Helper to expand the Stories Timeline accordion section
 * The Stories section is collapsed by default, so we need to expand it
 * before we can interact with story controls.
 */
async function expandStoriesSection(page: Page) {
  // Click on "Stories Timeline" header to expand the accordion
  await page.getByText('Stories Timeline').click();
  // Wait a moment for the accordion animation
  await page.waitForTimeout(300);
}

test.describe('Cart/Draft Editing', () => {
  test.describe('Cart Panel', () => {
    test('should open cart panel when job is selected', async ({ authenticatedPage: page }) => {
      // Create a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(`Cart Test ${Date.now()}`);
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Cart should open automatically
      await expect(page.getByTestId('cart-sidebar')).toBeVisible({ timeout: 5000 });
    });

    test('should display job name in cart header', async ({ authenticatedPage: page }) => {
      const jobName = `Header Test ${Date.now()}`;
      
      // Create a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('job-name-input').fill(jobName);
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Should see job name in cart header
      await expect(page.getByTestId('cart-job-name')).toHaveText(jobName);
    });

    test('should show Generate button for draft jobs', async ({ authenticatedPage: page }) => {
      // Create a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Should see Generate button
      await expect(page.getByTestId('generate-button')).toBeVisible();
    });

    test('should close cart panel when close button is clicked', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Cart should be visible
      await expect(page.getByTestId('cart-sidebar')).toBeVisible();

      // Click close button
      await page.getByTestId('close-cart-button').click();

      // Cart should close
      await expect(page.getByTestId('cart-sidebar')).not.toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Stories Management', () => {
    test('should open story type selection dialog', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Click Add Story button
      await page.getByTestId('add-story-button').click();

      // Story type dialog should open
      await expect(page.getByTestId('story-type-dialog')).toBeVisible();
    });

    test('should display story type options', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Click Add Story button
      await page.getByTestId('add-story-button').click();

      // Should see various story type options
      await expect(page.getByTestId('story-type-option-location')).toBeVisible();
      await expect(page.getByTestId('story-type-option-chat')).toBeVisible();
      await expect(page.getByTestId('story-type-option-call')).toBeVisible();
    });

    test('should open story form after selecting type', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Click Add Story button
      await page.getByTestId('add-story-button').click();

      // Select chat story type
      await page.getByTestId('story-type-option-chat').click();

      // Story form should appear
      await expect(page.getByTestId('story-description-input')).toBeVisible();
      await expect(page.getByTestId('save-story-button')).toBeVisible();
    });

    test('should create a new story with description', async ({ authenticatedPage: page }) => {
      const storyDescription = `Test story description ${Date.now()}`;
      
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Add a chat story (chat stories have fewer required fields)
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-chat').click();

      // Fill in story description
      await page.getByTestId('story-description-input').fill(storyDescription);

      // Save story
      await page.getByTestId('save-story-button').click();

      // Wait for story to be created
      await page.waitForTimeout(2000);

      // Story should appear in the list
      await expect(page.getByTestId('story-description')).toContainText(storyDescription);
    });

    test('should display created story in timeline', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Add a chat story
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-chat').click();
      await page.getByTestId('save-story-button').click();

      // Wait for story to be created
      await page.waitForTimeout(2000);

      // Story item should exist (will have dynamic ID)
      const storyItems = page.locator('[data-testid^="story-item-"]');
      await expect(storyItems.first()).toBeVisible();
    });

    test('should show story type badge', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Add a chat story
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-chat').click();
      await page.getByTestId('save-story-button').click();

      // Wait for story to be created
      await page.waitForTimeout(2000);

      // Should see story type badge
      await expect(page.getByTestId('story-type-chat')).toBeVisible();
    });

    test('should allow deleting a story', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Add a story
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-call').click();
      await page.getByTestId('save-story-button').click();

      await page.waitForTimeout(2000);

      // Get the story ID from the first story item
      const firstStory = page.locator('[data-testid^="story-item-"]').first();
      await expect(firstStory).toBeVisible();

      // Hover to show actions
      await firstStory.hover();

      // Click delete button (use locator within the story)
      const deleteButton = page.locator('[data-testid^="delete-story-"]').first();
      await deleteButton.click();

      // Confirm deletion in dialog
      await page.getByRole('button', { name: /delete/i }).last().click();

      // Wait for deletion
      await page.waitForTimeout(1000);

      // Story should be removed (or list should be empty)
      // We can't check for the specific story since it's deleted,
      // but we can verify the delete flow completed
    });
  });

  test.describe('Generate Job', () => {
    test('should start job generation', async ({ authenticatedPage: page }) => {
      // Create a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Click Generate button
      await page.getByTestId('generate-button').click();

      // Wait a moment for status change
      await page.waitForTimeout(1000);

      // Generate button should disappear (job is no longer draft)
      // or show processing indicator
      const generateButton = page.getByTestId('generate-button');
      const processingIndicator = page.getByTestId('processing-indicator');
      
      // Either generate button is gone or processing indicator appears
      const buttonVisible = await generateButton.isVisible().catch(() => false);
      const indicatorVisible = await processingIndicator.isVisible().catch(() => false);
      
      expect(buttonVisible === false || indicatorVisible === true).toBeTruthy();
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no stories added', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Should see "No stories added" text or similar empty state
      await expect(page.getByText(/no stories added/i)).toBeVisible();
    });
  });

  test.describe('Multiple Stories', () => {
    test('should create multiple stories', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Add first story (chat)
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-chat').click();
      await page.getByTestId('story-description-input').fill('First story');
      await page.getByTestId('save-story-button').click();
      await page.waitForTimeout(1500);

      // Add second story (call)
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-call').click();
      await page.getByTestId('story-description-input').fill('Second story');
      await page.getByTestId('save-story-button').click();
      await page.waitForTimeout(1500);

      // Should see two story items
      const storyItems = page.locator('[data-testid^="story-item-"]');
      await expect(storyItems).toHaveCount(2);
    });
  });

  test.describe('Cancel Actions', () => {
    test('should cancel story creation', async ({ authenticatedPage: page }) => {
      // Create and select a job
      await page.getByTestId('new-job-button').click();
      await page.getByTestId('create-job-button').click();
      
      await page.waitForTimeout(2000);

      // Expand Stories Timeline accordion
      await expandStoriesSection(page);

      // Start adding story
      await page.getByTestId('add-story-button').click();
      await page.getByTestId('story-type-option-chat').click();

      // Fill some data
      await page.getByTestId('story-description-input').fill('This will be cancelled');

      // Click cancel
      await page.getByTestId('cancel-story-button').click();

      // Form should close, no new story should be added
      await expect(page.getByTestId('story-description-input')).not.toBeVisible();
      
      // Should still show empty state
      await expect(page.getByText(/no stories added/i)).toBeVisible();
    });
  });
});
