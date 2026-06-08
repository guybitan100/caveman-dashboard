# TokenLint AI Runtime Observability Platform

TokenLint is a VS Code extension for prompts, AI skills, MCP workflows, and cognitive security that now combines compiler-style linting with runtime observability for AI context usage.

## Product Positioning

AI Runtime Observability Platform for GitHub Copilot, agentic workflows, and cognitive systems.

## What This MVP Includes

- Real VS Code extension entrypoint
- Runtime observability dashboard
- Simulated AI session telemetry
- Cost, cache, retrieval, and context-pressure analysis
- Compiler-style IR
- Parser from prompt/skill files into IR
- Optimization passes
- Retrieval passes
- Security passes
- Malicious skill test detection
- Prompt injection detection
- Encoded payload detection
- Unsafe permission detection
- External endpoint detection
- Diagnostics
- Hover provider
- Quick fixes
- Workspace scanner
- Markdown report generator
- Show IR command
- Before / after fix graph preview

## Activity Bar Sidebar

TokenLint now adds a dedicated Activity Bar icon in VS Code.

The sidebar includes:

- Copilot Context Budget card with current file, open files, workspace estimate, usage, and risk
- Open Runtime Dashboard
- Show Cost Analysis
- Analyze Cache Efficiency
- Analyze Retrieval Amplification
- Scan / Fix... quick action
- Scan Current File
- Scan Workspace
- Analyze Open Files Budget
- Analyze Workspace Budget
- Generate Report
- Show IR
- Apply All Safe Fixes
- Show Before / After Graph

## Copilot Budget Meter

TokenLint includes a real-time Copilot budget meter in the status bar and sidebar.

- Status bar examples: `TokenLint: 42.3k / 128k - 33%`, `TokenLint: 91k / 128k - HIGH`, `TokenLint: 122k / 128k - CRITICAL`
- Sidebar budget card shows the current file tokens, open file tokens, workspace estimate, retrieval estimate, configured budget, usage percent, and risk level
- Workspace budget analysis opens a markdown report with estimated token totals, runtime amplification, and highest-risk files

## Runtime Observability Dashboard

TokenLint now includes a dedicated runtime dashboard built with a VS Code webview panel.

- Latest session view with model, cost, credits, tokens, cache reuse, retrieval amplification, context pressure, and prompt stability
- All sessions view with workspace filters, time-window filters, and CSV or JSON export
- Aggregate analytics view for cache efficiency, retrieval amplification, context pressure, and prompt volatility
- Markdown drill-down commands for cost analysis, cache efficiency analysis, and retrieval amplification analysis
- Phase 1 simulated telemetry derived from Copilot budget state, visible files, workspace analysis, and prompt-shape heuristics

## Fix Engine

TokenLint includes a safe fix engine.

### Safe automatic fixes

- Remove exact duplicate instructions

`TokenLint: Apply All Safe Fixes` rescans the current editor before applying fixes and, when the sidebar runs without any visible text editor, falls back to a TokenLint problem file that actually has safe fixes if one is available.

### Review-required fixes

- Reduce `top_k`
- Neutralize suspicious prompt-injection phrases
- Comment external endpoints for review
- Disable suspicious skill tests
- Replace suspicious encoded payloads with a review marker

## Commands

- `TokenLint: Scan / Fix...`
- `TokenLint: Scan Current File`
- `TokenLint: Scan Workspace`
- `TokenLint: Set Copilot Budget`
- `TokenLint: Analyze Open Files Budget`
- `TokenLint: Show Copilot Budget`
- `TokenLint: Open Runtime Dashboard`
- `TokenLint: Show Cost Analysis`
- `TokenLint: Analyze Cache Efficiency`
- `TokenLint: Analyze Retrieval Amplification`
- `TokenLint: Analyze Workspace Budget`
- `TokenLint: Generate Report`
- `TokenLint: Show IR`
- `TokenLint: Apply All Safe Fixes`
- `TokenLint: Show Before / After Graph`

## Settings

- `tokenlint.copilotBudget`: default `128000`
- `tokenlint.warningThresholdPercent`: default `70`
- `tokenlint.criticalThresholdPercent`: default `90`
- `tokenlint.includeWorkspaceEstimate`: default `true`
- `tokenlint.includeRetrievalAmplification`: default `true`
- `tokenlint.runtimeTimeWindowDays`: default `7`, allowed values `1`, `7`, `30`

## Scan Scope

TokenLint analyzes prompt artifacts and skips known generated or ignored content.

- Workspace scans consider `.md`, `.prompt`, `.yaml`, `.yml`, `.json`, `.ts`, `.tsx`, and `.py`
- Files must also look like skill, agent, prompt, or MCP artifacts based on their path or file name, for example `AGENTS.md`, `copilot-instructions.md`, `.github/agents/**`, `skills/**`, or `mcp.json`
- Generated dependency lockfiles are skipped automatically: `bun.lockb`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-lock.yml`, `yarn.lock`
- Workspace exclusions are read from `.tokenlintignore`

## Testing And Coverage

TokenLint uses Vitest with V8 coverage.

```bash
npm test
npm run test:coverage
```

Coverage is enforced at 95% for statements, branches, functions, and lines.

The coverage run targets `src/**/*.ts` and excludes:

- test files
- type-only contracts such as IR and fix interfaces
- test utilities under `src/test-utils/**`

## Development

```bash
npm install
npm run compile
```

Then press F5 in VS Code to open the Extension Development Host.

## Architecture

```text
Source Files
  ↓
Parser
  ↓
IR - Intermediate Representation
  ↓
Optimization Passes
  ↓
Retrieval Passes
  ↓
Security Passes
  ↓
Diagnostics / Hover / Quick Fixes / Reports
```

## Test Fixture

Open:

```text
src/test-fixtures/unsafe-skill.yaml
```

Run:

```text
TokenLint: Scan Current File
```

You should see findings for:

- prompt injection
- unsafe permissions
- retrieval amplification
- malicious skill test behavior
- external endpoint

You can also run:

```text
TokenLint: Apply All Safe Fixes
```

to automatically remove exact duplicate instructions after the file is rescanned.

Or run:

```text
TokenLint: Show Before / After Graph
```

to open a visual preview of the current scan state, the safe automatic changes, and the findings that still need manual review.
