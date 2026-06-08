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
  await page.setContent(withVsCodeBootstrap(buildRuntimeDashboardHtml('playwright-test-nonce')));
  await page.waitForFunction(() => Boolean(window.__tokenlintDashboardTestApi));
  await stabilizeDashboardPage(page);
  await dispatchDashboardState(page, state);
  await page.waitForFunction(expectedSessions => {
    const currentState = window.__tokenlintDashboardTestApi?.getCurrentState() as {
      summary?: { sessions?: number };
    } | undefined;

    return currentState?.summary?.sessions === expectedSessions;
  }, state.summary.sessions);
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

function withVsCodeBootstrap(html: string): string {
  const bootstrap = [
    '<script nonce="playwright-test-nonce">',
    'window.__persistedState = {};',
    'window.__postedMessages = [];',
    'window.acquireVsCodeApi = function () {',
    '  return {',
    '    postMessage: function (message) { window.__postedMessages.push(message); },',
    '    getState: function () { return window.__persistedState; },',
    '    setState: function (nextState) { window.__persistedState = nextState; }',
    '  };',
    '};',
    '</script>'
  ].join('');

  return html.replace('<script nonce="playwright-test-nonce">', `${bootstrap}<script nonce="playwright-test-nonce">`);
}