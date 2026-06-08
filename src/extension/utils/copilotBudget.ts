import * as vscode from 'vscode';

import { calculateBudget } from '../../core/budget/budgetEngine';
import {
  analyzeWorkspaceBudget,
  estimateBudget,
  estimateDocumentTokens,
  estimateTextBudget
} from '../../core/budget/budgetEstimator';
import {
  BudgetResult,
  BudgetTokenSource,
  WorkspaceBudgetAnalysis
} from '../../core/budget/budgetModels';
import {
  detectKind,
  isGeneratedDependencyFile,
  normalizeFileName
} from '../../core/parser/languageDetector';
import { TokenLintSidebarBudgetPayload } from '../providers/sidebarProvider';

import { shouldAnalyzeFile, workspaceScanGlob } from './scanFilter';
import { resolveTargetDocument } from './targetDocument';

type SidebarBudgetTarget = {
  updateBudget(payload: TokenLintSidebarBudgetPayload): void;
};

type BudgetSettings = {
  budgetTokens: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  includeWorkspaceEstimate: boolean;
  includeRetrievalAmplification: boolean;
};

type RefreshOptions = {
  includeWorkspaceEstimate?: boolean;
  forceWorkspaceRefresh?: boolean;
};

const defaultCopilotBudget = 128_000;
const defaultWarningThresholdPercent = 70;
const defaultCriticalThresholdPercent = 90;
const budgetRelevantBaseNameRegex = /(?:^|[._-])(agent|agents|skill|skills|mcp|prompt|prompts|instruction|instructions|workflow|workflows|memory|memories|retrieval|rag|context)(?:[._-]|$)/i;
const budgetRelevantPathRegex = /(^|\/)(\.github\/agents|\.github\/workflows|\.vscode\/prompts|agents|skills|prompts|mcp|memories?|memory|retrieval|rag|context)(\/|$)/i;

export class CopilotBudgetController {
  private workspaceAnalysis: WorkspaceBudgetAnalysis | undefined;
  private workspaceRefreshPromise: Promise<WorkspaceBudgetAnalysis | undefined> | undefined;
  private workspaceAnalysisDirty = true;

  constructor(
    private readonly statusBar: vscode.StatusBarItem,
    private readonly sidebar: SidebarBudgetTarget
  ) {
    this.statusBar.command = 'tokenlint.showCopilotBudget';
    this.statusBar.text = 'TokenLint: Budget meter';
    this.statusBar.tooltip = 'TokenLint Copilot budget meter';
    this.statusBar.show();
  }

  invalidateWorkspaceEstimate(): void {
    this.workspaceAnalysisDirty = true;
  }

  async refresh(options: RefreshOptions = {}): Promise<BudgetResult> {
    const result = await this.calculateCurrentBudget(options);

    this.applyStatusBarState(result);
    this.sidebar.updateBudget({
      budget: result,
      workspaceAnalysis: this.workspaceAnalysis
    });

    return result;
  }

  async showCopilotBudget(): Promise<BudgetResult> {
    const result = await this.refresh();

    vscode.window.showInformationMessage([
      `TokenLint Copilot budget: ${formatDetailedTokens(result.usedTokens)} / ${formatDetailedTokens(result.budgetTokens)} tokens`,
      `(${formatUsagePercent(result.usagePercent)}, ${result.risk.toUpperCase()})`,
      `Current file ${formatDetailedTokens(result.currentFileTokens)}, open files ${formatDetailedTokens(result.openFilesTokens)}, workspace ${formatDetailedTokens(result.workspaceTokens)}, retrieval ${formatDetailedTokens(result.estimatedRetrievalTokens)}.`
    ].join(' '));

    return result;
  }

  async analyzeOpenFilesBudget(): Promise<BudgetResult> {
    const result = await this.refresh({ includeWorkspaceEstimate: false });

    vscode.window.showInformationMessage(
      `TokenLint open files budget: ${formatDetailedTokens(result.usedTokens)} / ${formatDetailedTokens(result.budgetTokens)} tokens (${formatUsagePercent(result.usagePercent)}, ${result.risk.toUpperCase()}).`
    );

    return result;
  }

  async analyzeWorkspaceBudget(): Promise<WorkspaceBudgetAnalysis | undefined> {
    const analysis = await this.getWorkspaceAnalysis(true);
    const result = await this.refresh({ includeWorkspaceEstimate: true });

    if (!analysis) {
      vscode.window.showInformationMessage(
        'TokenLint: Open a workspace folder to analyze the Copilot budget.'
      );
      return undefined;
    }

    const reportDocument = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: renderWorkspaceBudgetReport(analysis, result)
    });

    await vscode.window.showTextDocument(reportDocument, vscode.ViewColumn.Beside);

    return analysis;
  }

  async setCopilotBudget(): Promise<number | undefined> {
    const settings = this.getSettings();
    const input = await vscode.window.showInputBox({
      prompt: 'Set the GitHub Copilot context budget in tokens',
      value: String(settings.budgetTokens),
      validateInput(value) {
        const parsed = Number(value);

        if (!Number.isInteger(parsed) || parsed <= 0) {
          return 'Enter a positive whole number.';
        }

        return undefined;
      }
    });

    if (!input) {
      return undefined;
    }

    const budgetTokens = Number(input);
    await vscode.workspace
      .getConfiguration('tokenlint')
      .update('copilotBudget', budgetTokens, vscode.ConfigurationTarget.Workspace);

    await this.refresh();

    vscode.window.showInformationMessage(
      `TokenLint Copilot budget set to ${formatDetailedTokens(budgetTokens)} tokens.`
    );

    return budgetTokens;
  }

  private async calculateCurrentBudget(options: RefreshOptions): Promise<BudgetResult> {
    const settings = this.getSettings(options);
    const currentDocument = await resolveTargetDocument();
    const currentFile = toBudgetSource(currentDocument);
    const openFiles = this.getOpenFileSources();
    const liveBudget = estimateBudget({
      budgetTokens: settings.budgetTokens,
      currentFile,
      openFiles,
      includeWorkspaceEstimate: false,
      includeRetrievalAmplification: settings.includeRetrievalAmplification,
      warningThresholdPercent: settings.warningThresholdPercent,
      criticalThresholdPercent: settings.criticalThresholdPercent
    });

    const workspaceAnalysis = settings.includeWorkspaceEstimate
      ? await this.getWorkspaceAnalysis(options.forceWorkspaceRefresh === true)
      : undefined;
    const workspaceTokens = workspaceAnalysis?.estimatedTokens ?? 0;
    const workspaceContextTokens = !workspaceAnalysis
      ? 0
      : settings.includeRetrievalAmplification
        ? workspaceAnalysis.estimatedFinalContext
        : workspaceAnalysis.estimatedTokens;
    const liveContextTokens = liveBudget.estimatedFinalContext;
    const usedTokens = Math.max(liveContextTokens, workspaceContextTokens);
    const estimatedRetrievalTokens = usedTokens === workspaceContextTokens
      ? (settings.includeRetrievalAmplification
        ? workspaceAnalysis?.estimatedRetrievalTokens ?? 0
        : 0)
      : liveBudget.estimatedRetrievalTokens;

    return calculateBudget(usedTokens, settings.budgetTokens, {
      currentFileTokens: liveBudget.currentFileTokens,
      openFilesTokens: liveBudget.openFilesTokens,
      workspaceTokens,
      estimatedRetrievalTokens,
      estimatedFinalContext: usedTokens,
      warningThresholdPercent: settings.warningThresholdPercent,
      criticalThresholdPercent: settings.criticalThresholdPercent
    });
  }

  private getOpenFileSources(): BudgetTokenSource[] {
    const unique = new Map<string, BudgetTokenSource>();

    for (const editor of vscode.window.visibleTextEditors) {
      const source = toBudgetSource(editor.document);
      if (!source) {
        continue;
      }

      unique.set(source.key ?? source.fileName ?? source.text, source);
    }

    return [...unique.values()];
  }

  private async getWorkspaceAnalysis(
    forceRefresh = false
  ): Promise<WorkspaceBudgetAnalysis | undefined> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return undefined;
    }

    if (!forceRefresh && !this.workspaceAnalysisDirty && this.workspaceAnalysis) {
      return this.workspaceAnalysis;
    }

    if (!forceRefresh && this.workspaceRefreshPromise) {
      return this.workspaceRefreshPromise;
    }

    this.workspaceRefreshPromise = this.collectWorkspaceAnalysis();

    const analysis = await this.workspaceRefreshPromise;
    this.workspaceRefreshPromise = undefined;

    if (analysis) {
      this.workspaceAnalysis = analysis;
      this.workspaceAnalysisDirty = false;
    }

    return analysis;
  }

  private async collectWorkspaceAnalysis(): Promise<WorkspaceBudgetAnalysis | undefined> {
    const files = await vscode.workspace.findFiles(workspaceScanGlob, '**/node_modules/**');
    const sources: BudgetTokenSource[] = [];

    for (const file of files) {
      if (!shouldIncludeBudgetFile(file.fsPath)) {
        continue;
      }

      const document = await vscode.workspace.openTextDocument(file);

      sources.push({
        key: typeof file.toString === 'function' ? file.toString() : file.fsPath,
        fileName: vscode.workspace.asRelativePath(file),
        text: document.getText()
      });
    }

    return analyzeWorkspaceBudget(sources);
  }

  private getSettings(options: RefreshOptions = {}): BudgetSettings {
    const configuration = vscode.workspace.getConfiguration('tokenlint');

    return {
      budgetTokens: getNumberSetting(
        configuration,
        'copilotBudget',
        defaultCopilotBudget
      ),
      warningThresholdPercent: getNumberSetting(
        configuration,
        'warningThresholdPercent',
        defaultWarningThresholdPercent
      ),
      criticalThresholdPercent: getNumberSetting(
        configuration,
        'criticalThresholdPercent',
        defaultCriticalThresholdPercent
      ),
      includeWorkspaceEstimate: options.includeWorkspaceEstimate
        ?? configuration.get<boolean>('includeWorkspaceEstimate', true),
      includeRetrievalAmplification: configuration.get<boolean>('includeRetrievalAmplification', true)
    };
  }

  private applyStatusBarState(result: BudgetResult): void {
    this.statusBar.text = formatStatusBarText(result);
    this.statusBar.tooltip = [
      'Copilot Context Budget',
      `Current file: ${formatDetailedTokens(result.currentFileTokens)} tokens`,
      `Open files: ${formatDetailedTokens(result.openFilesTokens)} tokens`,
      `Workspace estimate: ${formatDetailedTokens(result.workspaceTokens)} tokens`,
      `Retrieval estimate: ${formatDetailedTokens(result.estimatedRetrievalTokens)} tokens`,
      `Usage: ${formatUsagePercent(result.usagePercent)} (${result.risk.toUpperCase()})`
    ].join('\n');
    this.statusBar.backgroundColor = toStatusBarThemeColor(result.risk);
    this.statusBar.show();
  }
}

export function shouldIncludeBudgetFile(fileName: string): boolean {
  if (shouldAnalyzeFile(fileName)) {
    return true;
  }

  if (isGeneratedDependencyFile(fileName)) {
    return false;
  }

  if (detectKind(fileName) === 'unknown') {
    return false;
  }

  const normalized = normalizeFileName(fileName);
  const baseName = normalized.split('/').pop() ?? normalized;

  if (baseName.endsWith('.prompt')) {
    return true;
  }

  return budgetRelevantBaseNameRegex.test(baseName) || budgetRelevantPathRegex.test(normalized);
}

function toBudgetSource(document: vscode.TextDocument | undefined): BudgetTokenSource | undefined {
  if (!document || !shouldAnalyzeFile(document.fileName)) {
    return undefined;
  }

  return {
    key: document.uri.toString(),
    fileName: document.fileName,
    text: document.getText()
  };
}

function getNumberSetting(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
  fallback: number
): number {
  const value = configuration.get<number>(key, fallback);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function toStatusBarThemeColor(risk: BudgetResult['risk']): vscode.ThemeColor | undefined {
  if (risk === 'critical') {
    return new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  if (risk === 'high') {
    return new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  return undefined;
}

function formatDetailedTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

function formatCompactTokens(value: number): string {
  if (value < 1_000) {
    return String(Math.max(0, Math.round(value)));
  }

  if (value >= 90_000 || value % 1_000 === 0) {
    return `${Math.round(value / 1_000)}k`;
  }

  return `${(value / 1_000).toFixed(1)}k`;
}

function formatUsagePercent(usagePercent: number): string {
  return `${Math.round(usagePercent)}%`;
}

export function formatStatusBarText(result: BudgetResult): string {
  const summary = `${formatCompactTokens(result.usedTokens)} / ${formatCompactTokens(result.budgetTokens)}`;

  if (result.risk === 'critical') {
    return `TokenLint: ${summary} - CRITICAL`;
  }

  if (result.risk === 'high') {
    return `TokenLint: ${summary} - HIGH`;
  }

  return `TokenLint: ${summary} - ${formatUsagePercent(result.usagePercent)}`;
}

export function renderWorkspaceBudgetReport(
  analysis: WorkspaceBudgetAnalysis,
  result: BudgetResult
): string {
  const highestRiskFiles = analysis.highestRiskFiles.length > 0
    ? analysis.highestRiskFiles.map(fileName => `- ${fileName}`).join('\n')
    : '- None';

  return [
    '# Workspace Context Analysis',
    '',
    `Files scanned: ${analysis.filesScanned}`,
    '',
    `Estimated Tokens: ${formatDetailedTokens(analysis.estimatedTokens)}`,
    `Estimated Retrieval Tokens: ${formatDetailedTokens(analysis.estimatedRetrievalTokens)}`,
    `Estimated Final Context: ${formatDetailedTokens(analysis.estimatedFinalContext)}`,
    `Estimated Runtime Amplification: ${analysis.estimatedRuntimeAmplification.toFixed(1)}x`,
    `Configured Budget: ${formatDetailedTokens(result.budgetTokens)}`,
    `Usage: ${formatUsagePercent(result.usagePercent)} (${result.risk.toUpperCase()})`,
    '',
    '## Highest Risk Files',
    highestRiskFiles
  ].join('\n');
}

export function getCurrentFileTokenCount(document: vscode.TextDocument | undefined): number {
  if (!document || !shouldAnalyzeFile(document.fileName)) {
    return 0;
  }

  return estimateDocumentTokens(document.getText());
}

export function getCurrentFileRetrievalTokens(document: vscode.TextDocument | undefined): number {
  if (!document || !shouldAnalyzeFile(document.fileName)) {
    return 0;
  }

  return estimateTextBudget(document.getText(), document.fileName).estimatedRetrievalTokens;
}