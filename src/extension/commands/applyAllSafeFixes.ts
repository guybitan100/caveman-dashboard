import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { fixesFromFindings } from '../../core/fixes/fixEngine';
import { TokenLintDiagnosticProvider } from '../providers/diagnosticProvider';
import { applySafeFixPreview, showFixGraphPreview } from './showFixGraph';
import { getSkipReason, shouldAnalyzeFile } from '../utils/scanFilter';
import { resolveTargetDocument } from '../utils/targetDocument';

const supportedMarkdownlintCodes = new Set(['MD024', 'MD041', 'MD056']);

function getUriKey(uri: vscode.Uri | { fsPath?: string } | string | undefined): string | undefined {
  if (!uri) {
    return undefined;
  }

  if (typeof uri === 'string') {
    return uri;
  }

  if (typeof uri === 'object' && 'fsPath' in uri && typeof uri.fsPath === 'string') {
    return uri.fsPath;
  }

  return typeof uri.toString === 'function' ? uri.toString() : undefined;
}

function rememberDocument(seenDocuments: Set<string>, document: vscode.TextDocument) {
  seenDocuments.add(document.fileName);

  const uriKey = getUriKey(document.uri);

  if (uriKey) {
    seenDocuments.add(uriKey);
  }
}

function rememberDocumentInCache(
  documents: Map<string, vscode.TextDocument>,
  document: vscode.TextDocument
) {
  documents.set(document.fileName, document);

  const uriKey = getUriKey(document.uri);

  if (uriKey) {
    documents.set(uriKey, document);
  }
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function formatCountSummary(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key} (${count})`)
    .join(', ');
}

function getDiagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  if (typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number') {
    return String(diagnostic.code);
  }

  if (
    diagnostic.code
    && typeof diagnostic.code === 'object'
    && 'value' in diagnostic.code
  ) {
    const codeValue = (diagnostic.code as { value?: unknown }).value;

    if (typeof codeValue === 'string' || typeof codeValue === 'number') {
      return String(codeValue);
    }
  }

  return undefined;
}

function getDiagnosticStartCharacter(diagnostic: vscode.Diagnostic): number {
  return typeof diagnostic.range?.start?.character === 'number'
    ? diagnostic.range.start.character
    : 0;
}

function buildDiagnosticKey(
  uri: vscode.Uri | { fsPath?: string } | string | undefined,
  diagnostic: vscode.Diagnostic
): string {
  const uriKey = getUriKey(uri) ?? 'unknown';
  const source = typeof diagnostic.source === 'string' ? diagnostic.source : 'unknown';
  const code = getDiagnosticCode(diagnostic) ?? 'unknown';
  const startLine = typeof diagnostic.range?.start?.line === 'number'
    ? diagnostic.range.start.line
    : -1;

  return `${uriKey}:${source}:${code}:${startLine}:${getDiagnosticStartCharacter(diagnostic)}`;
}

function getFixBuckets(result: ReturnType<TokenLintDiagnosticProvider['scan']>) {
  const fixes = fixesFromFindings(result.findings);

  return {
    fixes,
    safeFixes: fixes
      .filter(fix => fix.safety !== 'unsafe')
      .sort((a, b) => b.loc.startLine - a.loc.startLine)
  };
}

type DocumentFixPlan = {
  document: vscode.TextDocument;
  result: ReturnType<TokenLintDiagnosticProvider['scan']>;
  fixes: ReturnType<typeof fixesFromFindings>;
  safeFixes: ReturnType<typeof fixesFromFindings>;
};

type MarkdownlintFixOperation =
  | {
      kind: 'replace';
      range: vscode.Range;
      newText: string;
    }
  | {
      kind: 'insert';
      position: vscode.Position;
      newText: string;
    };

type MarkdownlintFixPlan = {
  document: vscode.TextDocument;
  editCount: number;
  fixedDiagnosticKeys: string[];
  apply: (edit: vscode.WorkspaceEdit) => void;
};

type PromptSizeIgnorePlan = {
  document: vscode.TextDocument;
  ignoreFilePath: string;
  relativePath: string;
};

function hasTokenLintDiagnostics(diagnostics: readonly vscode.Diagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.source === 'TokenLint');
}

function getSupportedMarkdownlintDiagnostics(
  diagnostics: readonly vscode.Diagnostic[]
): vscode.Diagnostic[] {
  return diagnostics.filter(diagnostic => (
    typeof diagnostic.source === 'string'
    && diagnostic.source.toLowerCase() === 'markdownlint'
    && supportedMarkdownlintCodes.has(getDiagnosticCode(diagnostic) ?? '')
  ));
}

function getDiagnosticEntries(): ReadonlyArray<[vscode.Uri, readonly vscode.Diagnostic[]]> {
  const diagnostics = vscode.languages.getDiagnostics();

  if (!Array.isArray(diagnostics)) {
    return [];
  }

  const entries: Array<[vscode.Uri, readonly vscode.Diagnostic[]]> = [];

  for (const entry of diagnostics) {
    if (
      Array.isArray(entry)
      && entry.length === 2
      && typeof entry[0] === 'object'
      && entry[0] !== null
      && 'scheme' in entry[0]
      && Array.isArray(entry[1])
    ) {
      entries.push([entry[0], entry[1]]);
    }
  }

  return entries;
}

async function scanDocumentForFixes(
  provider: TokenLintDiagnosticProvider,
  document: vscode.TextDocument,
  seenDocuments: Set<string>
): Promise<DocumentFixPlan> {
  rememberDocument(seenDocuments, document);

  const result = provider.scan(document);
  const { fixes, safeFixes } = getFixBuckets(result);

  return {
    document,
    result,
    fixes,
    safeFixes
  };
}

async function collectDiagnosticFixPlans(
  provider: TokenLintDiagnosticProvider,
  initialDocument: vscode.TextDocument
): Promise<DocumentFixPlan[]> {
  const seenDocuments = new Set<string>();
  const plans = [await scanDocumentForFixes(provider, initialDocument, seenDocuments)];

  for (const [uri, entries] of getDiagnosticEntries()) {
    const uriKey = getUriKey(uri);

    if (
      uri.scheme !== 'file'
      || !hasTokenLintDiagnostics(entries)
      || !shouldAnalyzeFile(uri.fsPath)
      || seenDocuments.has(uri.fsPath)
      || (uriKey ? seenDocuments.has(uriKey) : false)
    ) {
      continue;
    }

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      plans.push(await scanDocumentForFixes(provider, document, seenDocuments));
    } catch {
      seenDocuments.add(uri.fsPath);

      if (uriKey) {
        seenDocuments.add(uriKey);
      }
    }
  }

  return plans;
}

function collectNonFixableTokenLintRuleCounts(
  plans: DocumentFixPlan[],
  ignoredDocumentKeys = new Set<string>()
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const plan of plans) {
    const documentKey = getUriKey(plan.document.uri) ?? plan.document.fileName;

    if (ignoredDocumentKeys.has(documentKey)) {
      continue;
    }

    for (const finding of plan.result.findings) {
      if (finding.fix) {
        continue;
      }

      incrementCount(counts, finding.ruleId);
    }
  }

  return counts;
}

function collectOtherDiagnosticSourceCounts(excludedDiagnosticKeys = new Set<string>()): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [uri, diagnostics] of getDiagnosticEntries()) {
    for (const diagnostic of diagnostics) {
      const source = typeof diagnostic.source === 'string' ? diagnostic.source : 'unknown';
      const diagnosticKey = buildDiagnosticKey(uri, diagnostic);

      if (excludedDiagnosticKeys.has(diagnosticKey)) {
        continue;
      }

      if (source.toLowerCase() === 'tokenlint') {
        continue;
      }

      incrementCount(counts, source);
    }
  }

  return counts;
}

function buildRemainingSummary(remainingRuleCounts: Map<string, number>): string | undefined {
  if (remainingRuleCounts.size === 0) {
    return undefined;
  }

  return `Remaining TokenLint findings without automatic fixes: ${formatCountSummary(remainingRuleCounts)}.`;
}

function buildOtherDiagnosticsSummary(otherSourceCounts: Map<string, number>): string | undefined {
  if (otherSourceCounts.size === 0) {
    return undefined;
  }

  return `Other diagnostics are still present: ${formatCountSummary(otherSourceCounts)}.`;
}

function parseHeading(lineText: string): { prefix: string; heading: string; suffix: string } | undefined {
  const match = /^(\s{0,3}#{1,6}\s+)(.*?)(\s+#+\s*|\s*)$/.exec(lineText);

  if (!match) {
    return undefined;
  }

  return {
    prefix: match[1],
    heading: match[2].trim(),
    suffix: match[3] ?? ''
  };
}

function buildHeadingOccurrencesByLine(lines: string[]): Map<number, number> {
  const counts = new Map<string, number>();
  const occurrences = new Map<number, number>();

  for (const [index, lineText] of lines.entries()) {
    const parsedHeading = parseHeading(lineText);

    if (!parsedHeading) {
      continue;
    }

    const normalizedHeading = parsedHeading.heading.toLowerCase();
    const occurrence = (counts.get(normalizedHeading) ?? 0) + 1;

    counts.set(normalizedHeading, occurrence);
    occurrences.set(index, occurrence);
  }

  return occurrences;
}

function renameDuplicateHeading(lineText: string, occurrence: number): string | undefined {
  const parsedHeading = parseHeading(lineText);

  if (!parsedHeading || occurrence <= 1) {
    return undefined;
  }

  return `${parsedHeading.prefix}${parsedHeading.heading} (${occurrence})${parsedHeading.suffix}`;
}

function buildTitleFromFileName(fileName: string): string {
  const baseName = path.basename(fileName, path.extname(fileName));
  const cleaned = baseName.replace(/[._-]+/g, ' ').trim();

  if (!cleaned) {
    return 'Document';
  }

  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseExpectedColumnCount(message: string): number | undefined {
  const match = /Expected:\s*(\d+)/i.exec(message);

  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function padMarkdownTableRow(lineText: string, expectedColumns: number): string | undefined {
  const leadingWhitespace = lineText.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = lineText.match(/\s*$/)?.[0] ?? '';
  const trimmedLine = lineText.trim();

  if (!trimmedLine.includes('|')) {
    return undefined;
  }

  const inner = trimmedLine.replace(/^\|/, '').replace(/\|$/, '');
  const cells = inner.split('|').map(cell => cell.trim());

  if (cells.length >= expectedColumns) {
    return undefined;
  }

  while (cells.length < expectedColumns) {
    cells.push('');
  }

  return `${leadingWhitespace}| ${cells.join(' | ')} |${trailingWhitespace}`;
}

function buildMarkdownlintFixPlan(
  document: vscode.TextDocument,
  diagnostics: readonly vscode.Diagnostic[]
): MarkdownlintFixPlan | undefined {
  const operations: MarkdownlintFixOperation[] = [];
  const fixedDiagnosticKeys: string[] = [];
  const lines = document.getText().split(/\r?\n/);
  const headingOccurrences = buildHeadingOccurrencesByLine(lines);
  let insertedFirstHeading = false;

  const supportedDiagnostics = getSupportedMarkdownlintDiagnostics(diagnostics)
    .sort((left, right) => right.range.start.line - left.range.start.line);

  for (const diagnostic of supportedDiagnostics) {
    const code = getDiagnosticCode(diagnostic);
    const lineNumber = diagnostic.range.start.line;

    if (code === 'MD024') {
      const replacement = renameDuplicateHeading(lines[lineNumber] ?? '', headingOccurrences.get(lineNumber) ?? 2);

      if (!replacement || replacement === lines[lineNumber]) {
        continue;
      }

      operations.push({
        kind: 'replace',
        range: document.lineAt(lineNumber).range,
        newText: replacement
      });
      fixedDiagnosticKeys.push(buildDiagnosticKey(document.fileName, diagnostic));
      continue;
    }

    if (code === 'MD041') {
      if (insertedFirstHeading) {
        continue;
      }

      operations.push({
        kind: 'insert',
        position: document.lineAt(0).range.start,
        newText: `# ${buildTitleFromFileName(document.fileName)}\n\n`
      });
      fixedDiagnosticKeys.push(buildDiagnosticKey(document.fileName, diagnostic));
      insertedFirstHeading = true;
      continue;
    }

    if (code === 'MD056') {
      const expectedColumns = parseExpectedColumnCount(diagnostic.message);

      if (!expectedColumns) {
        continue;
      }

      const replacement = padMarkdownTableRow(lines[lineNumber] ?? '', expectedColumns);

      if (!replacement || replacement === lines[lineNumber]) {
        continue;
      }

      operations.push({
        kind: 'replace',
        range: document.lineAt(lineNumber).range,
        newText: replacement
      });
      fixedDiagnosticKeys.push(buildDiagnosticKey(document.fileName, diagnostic));
    }
  }

  if (!operations.length) {
    return undefined;
  }

  return {
    document,
    editCount: operations.length,
    fixedDiagnosticKeys,
    apply(edit: vscode.WorkspaceEdit) {
      for (const operation of operations) {
        if (operation.kind === 'replace') {
          edit.replace(document.uri, operation.range, operation.newText);
        } else {
          edit.insert(document.uri, operation.position, operation.newText);
        }
      }
    }
  };
}

async function collectMarkdownlintFixPlans(initialPlans: DocumentFixPlan[]): Promise<MarkdownlintFixPlan[]> {
  const documents = new Map<string, vscode.TextDocument>();

  for (const plan of initialPlans) {
    rememberDocumentInCache(documents, plan.document);
  }

  const plans: MarkdownlintFixPlan[] = [];

  for (const [uri, diagnostics] of getDiagnosticEntries()) {
    const uriKey = getUriKey(uri);
    const supportedDiagnostics = getSupportedMarkdownlintDiagnostics(diagnostics);

    if (
      uri.scheme !== 'file'
      || !supportedDiagnostics.length
      || !shouldAnalyzeFile(uri.fsPath)
    ) {
      continue;
    }

    let document = documents.get(uri.fsPath) ?? (uriKey ? documents.get(uriKey) : undefined);

    if (!document) {
      try {
        document = await vscode.workspace.openTextDocument(uri);
        rememberDocumentInCache(documents, document);
      } catch {
        continue;
      }
    }

    const plan = buildMarkdownlintFixPlan(document, supportedDiagnostics);

    if (plan) {
      plans.push(plan);
    }
  }

  return plans;
}

function collectPromptSizeIgnorePlans(plans: DocumentFixPlan[]): PromptSizeIgnorePlan[] {
  const ignorePlans: PromptSizeIgnorePlan[] = [];
  const seen = new Set<string>();

  for (const plan of plans) {
    if (
      !plan.result.findings.length
      || !plan.result.findings.every(finding => finding.ruleId === 'optimization.promptSize')
    ) {
      continue;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(plan.document.fileName));

    if (!workspaceFolder) {
      continue;
    }

    const relativePath = toPosix(path.relative(workspaceFolder.uri.fsPath, plan.document.fileName));

    if (!relativePath || relativePath.startsWith('..')) {
      continue;
    }

    const key = `${workspaceFolder.uri.fsPath}:${relativePath}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ignorePlans.push({
      document: plan.document,
      ignoreFilePath: path.join(workspaceFolder.uri.fsPath, '.tokenlintignore'),
      relativePath
    });
  }

  return ignorePlans;
}

async function applyPromptSizeIgnorePlans(plans: PromptSizeIgnorePlan[]): Promise<Set<string>> {
  const updates = new Map<string, Set<string>>();
  const ignoredDocumentKeys = new Set<string>();

  for (const plan of plans) {
    const entries = updates.get(plan.ignoreFilePath) ?? new Set<string>();

    entries.add(plan.relativePath);
    updates.set(plan.ignoreFilePath, entries);

    const documentKey = getUriKey(plan.document.uri) ?? plan.document.fileName;
    ignoredDocumentKeys.add(documentKey);
  }

  for (const [ignoreFilePath, entries] of updates) {
    let currentText = '';

    try {
      currentText = await fs.readFile(ignoreFilePath, 'utf8');
    } catch {
      currentText = '';
    }

    const existingEntries = new Set(
      currentText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
    );

    const nextEntries = [...entries].filter(entry => !existingEntries.has(entry));

    if (!nextEntries.length) {
      continue;
    }

    const prefix = currentText.length > 0 && !currentText.endsWith('\n')
      ? `${currentText}\n`
      : currentText;

    await fs.writeFile(ignoreFilePath, `${prefix}${nextEntries.join('\n')}\n`, 'utf8');
  }

  return ignoredDocumentKeys;
}

function buildAppliedBreakdown(markdownlintFixCount: number, promptSizeIgnoreCount: number): string | undefined {
  const parts: string[] = [];

  if (markdownlintFixCount > 0) {
    parts.push(`${markdownlintFixCount} markdownlint fixes`);
  }

  if (promptSizeIgnoreCount > 0) {
    parts.push(`${promptSizeIgnoreCount} oversized-file ignores`);
  }

  if (!parts.length) {
    return undefined;
  }

  return `Included ${parts.join(' and ')}.`;
}

export async function applyAllSafeFixes(provider: TokenLintDiagnosticProvider) {
  const document = await resolveTargetDocument();

  if (!document) {
    vscode.window.showInformationMessage(
      'TokenLint: Open a file in the editor to apply safe fixes.'
    );
    return;
  }

  if (!shouldAnalyzeFile(document.fileName)) {
    vscode.window.showInformationMessage(
      `TokenLint skipped ${getSkipReason(document.fileName)}`
    );
    return;
  }

  const plans = await collectDiagnosticFixPlans(provider, document);
  const safePlans = plans.filter(plan => plan.safeFixes.length > 0);
  const markdownlintPlans = await collectMarkdownlintFixPlans(plans);
  const promptSizeIgnorePlans = collectPromptSizeIgnorePlans(plans);
  const fixedOtherDiagnosticKeys = new Set(markdownlintPlans.flatMap(plan => plan.fixedDiagnosticKeys));
  const otherDiagnosticsSummary = buildOtherDiagnosticsSummary(
    collectOtherDiagnosticSourceCounts(fixedOtherDiagnosticKeys)
  );
  const tokenlintFixCount = safePlans.reduce((total, plan) => total + plan.safeFixes.length, 0);
  const markdownlintFixCount = markdownlintPlans.reduce((total, plan) => total + plan.editCount, 0);
  const promptSizeIgnoreCount = promptSizeIgnorePlans.length;

  if (!tokenlintFixCount && !markdownlintFixCount && !promptSizeIgnoreCount) {
    const remainingSummary = buildRemainingSummary(collectNonFixableTokenLintRuleCounts(plans));

    vscode.window.showInformationMessage([
      'TokenLint: No automatic fixes available.',
      remainingSummary,
      otherDiagnosticsSummary
    ].filter(Boolean).join(' '));
    return;
  }

  const previewPlan = safePlans[0];
  const originalText = previewPlan?.document.getText();
  const previewText = previewPlan
    ? applySafeFixPreview(originalText, previewPlan.safeFixes)
    : undefined;
  const edit = new vscode.WorkspaceEdit();
  const totalFixes = tokenlintFixCount + markdownlintFixCount + promptSizeIgnoreCount;
  const touchedDocumentKeys = new Set<string>([
    ...safePlans.map(plan => getUriKey(plan.document.uri) ?? plan.document.fileName),
    ...markdownlintPlans.map(plan => getUriKey(plan.document.uri) ?? plan.document.fileName),
    ...promptSizeIgnorePlans.map(plan => getUriKey(plan.document.uri) ?? plan.document.fileName)
  ]);
  const appliedBreakdown = buildAppliedBreakdown(markdownlintFixCount, promptSizeIgnoreCount);

  for (const plan of safePlans) {
    for (const fix of plan.safeFixes) {
      const startLine = plan.document.lineAt(fix.loc.startLine);
      const endLineIdx = Math.min(fix.loc.endLine, plan.document.lineCount - 1);

      let range = startLine.rangeIncludingLineBreak;

      if (endLineIdx > fix.loc.startLine) {
        const endLine = plan.document.lineAt(endLineIdx);
        range = range.union(endLine.rangeIncludingLineBreak);
      }

      if (fix.replacement) {
        edit.replace(plan.document.uri, range, fix.replacement + '\n');
      } else {
        edit.delete(plan.document.uri, range);
      }
    }
  }

  for (const markdownlintPlan of markdownlintPlans) {
    markdownlintPlan.apply(edit);
  }

  const needsTextEditApply = tokenlintFixCount > 0 || markdownlintFixCount > 0;
  const success = needsTextEditApply
    ? await vscode.workspace.applyEdit(edit)
    : true;

  if (!success) {
    return;
  }

  const ignoredDocumentKeys = await applyPromptSizeIgnorePlans(promptSizeIgnorePlans);
  const documentsToSave = new Map<string, vscode.TextDocument>();
  const rescannedDocumentKeys = new Set<string>();

  for (const plan of safePlans) {
    rememberDocumentInCache(documentsToSave, plan.document);
  }

  for (const plan of markdownlintPlans) {
    rememberDocumentInCache(documentsToSave, plan.document);
  }

  for (const savedDocument of new Set(documentsToSave.values())) {
    await savedDocument.save();
  }

  for (const plan of safePlans) {
    const documentKey = getUriKey(plan.document.uri) ?? plan.document.fileName;

    rescannedDocumentKeys.add(documentKey);
    provider.scan(plan.document);
  }

  for (const plan of markdownlintPlans) {
    const documentKey = getUriKey(plan.document.uri) ?? plan.document.fileName;

    if (rescannedDocumentKeys.has(documentKey)) {
      continue;
    }

    rescannedDocumentKeys.add(documentKey);
    provider.scan(plan.document);
  }

  for (const plan of promptSizeIgnorePlans) {
    const documentKey = getUriKey(plan.document.uri) ?? plan.document.fileName;

    if (!ignoredDocumentKeys.has(documentKey) || rescannedDocumentKeys.has(documentKey)) {
      continue;
    }

    rescannedDocumentKeys.add(documentKey);
    provider.scan(plan.document);
  }

  const remainingSummary = buildRemainingSummary(
    collectNonFixableTokenLintRuleCounts(plans, ignoredDocumentKeys)
  );

  if (touchedDocumentKeys.size === 1) {
    vscode.window.showInformationMessage([
      `TokenLint applied ${totalFixes} fixes.`,
      appliedBreakdown,
      remainingSummary,
      otherDiagnosticsSummary
    ].filter(Boolean).join(' '));
  } else {
    vscode.window.showInformationMessage([
      `TokenLint applied ${totalFixes} fixes across ${touchedDocumentKeys.size} files.`,
      appliedBreakdown,
      remainingSummary,
      otherDiagnosticsSummary
    ].filter(Boolean).join(' '));
  }

  if (previewPlan && typeof originalText === 'string' && typeof previewText === 'string') {
    showFixGraphPreview({
      fileName: previewPlan.document.fileName,
      beforeText: originalText,
      afterText: previewText,
      beforeResult: previewPlan.result,
      allFixes: previewPlan.fixes,
      safeFixes: previewPlan.safeFixes
    });
  }
}