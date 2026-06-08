import { expect, Page } from '@playwright/test';

import { buildRuntimeDashboardHtml } from '../../src/extension/providers/runtimeDashboardHtml';
import type { RuntimeDashboardViewState } from '../../src/extension/providers/runtimeDashboardPanel';

import { dashboardSelectors } from './dashboardSelectors';

export interface PostedDashboardMessage {
  command: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    __persistedState?: Record<string, unknown>;
    __postedMessages?: PostedDashboardMessage[];
    __tokenlintDashboardTestApi?: {
      getCurrentState(): unknown;
      getActiveTab(): string;
    };
    acquireVsCodeApi?: () => {
      postMessage(message: PostedDashboardMessage): void;
      getState(): Record<string, unknown>;
      setState(nextState: Record<string, unknown>): void;
    };
  }
}

export async function renderDashboardPage(page: Page, state: RuntimeDashboardViewState): Promise<void> {
  await page.addInitScript(() => {
    window.__persistedState = {};
    window.__postedMessages = [];
    window.acquireVsCodeApi = () => ({
      postMessage(message) {
        window.__postedMessages?.push(message);
      },
      getState() {
        return window.__persistedState ?? {};
      },
      setState(nextState) {
        window.__persistedState = nextState;
      }
    });
  });

  await page.setContent(buildRuntimeDashboardHtml('playwright-test-nonce'));
  await stabilizeDashboardPage(page);
  await dispatchDashboardState(page, state);
  await expect(page.locator(dashboardSelectors.shell)).toBeVisible();
}

export async function dispatchDashboardState(page: Page, state: RuntimeDashboardViewState): Promise<void> {
  await page.evaluate(payload => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'tokenlint.runtimeDashboard',
        payload
      }
    }));
  }, state);
}

export async function getPostedMessages(page: Page): Promise<PostedDashboardMessage[]> {
  return page.evaluate(() => window.__postedMessages ?? []);
}

export async function clearPostedMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__postedMessages = [];
  });
}

export async function getActiveTab(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__tokenlintDashboardTestApi?.getActiveTab() ?? null);
}

export async function stabilizeDashboardPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: [
      '*,*::before,*::after{animation:none!important;transition:none!important;}',
      'body,button,input,select,textarea{font-family:monospace!important;}',
      'html{scroll-behavior:auto!important;}'
    ].join('')
  });
}