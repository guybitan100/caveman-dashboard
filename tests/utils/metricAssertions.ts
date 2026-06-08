import { expect, Page } from '@playwright/test';

import { AISession, DashboardSummary } from '../../src/runtime/session/sessionModels';

import { dashboardSelectors } from './dashboardSelectors';

const numberFormatter = new Intl.NumberFormat('en-US');
const creditFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export async function expectSummaryKpis(page: Page, summary: DashboardSummary): Promise<void> {
  await expect(page.locator(dashboardSelectors.kpiSessions)).toHaveText(numberFormatter.format(summary.sessions));
  await expect(page.locator(dashboardSelectors.kpiCost)).toHaveText(currencyFormatter.format(summary.totalCost));
  await expect(page.locator(dashboardSelectors.kpiCredits)).toHaveText(creditFormatter.format(summary.totalCredits));
}

export async function expectLatestSessionHeader(page: Page, session: AISession): Promise<void> {
  await expect(page.locator(dashboardSelectors.latestSessionTitle)).toHaveText(session.title);
  await expect(page.locator(dashboardSelectors.latestSessionWorkspace)).toHaveText(session.workspace);
  await expect(page.locator(dashboardSelectors.latestSessionRisk)).toHaveText(session.risk.toUpperCase());
}

export function parseCurrency(value: string): number {
  return Number(value.replace(/[^\d.-]+/g, ''));
}

export function parseNumber(value: string): number {
  return Number(value.replace(/[^\d.-]+/g, ''));
}