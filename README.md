# TokenLint Cost, Linting, and Runtime Observability

TokenLint is a VS Code extension for prompts, AI skills, agent instructions, MCP workflows, and AI context infrastructure. It combines compiler-style linting, Copilot context-budget analysis, a cost-and-token runtime dashboard, and a local runtime history/diff engine in one workflow.

## Product Positioning

TokenLint is positioned as compiler, runtime observability, and AI FinOps infrastructure for cognitive systems built on GitHub Copilot, agentic workflows, MCP-enabled tooling, and prompt-engineering repositories.

The current runtime surface is centered on a dedicated:

- `TokenLint Cost & Token Tracker`
- AI runtime cost observability inside VS Code
- session-level cost, credits, cache reuse, and workspace spend analysis

## Recent Changes

The current release includes several material product changes.

### Cost dashboard redesign

- Replaced the broader multi-section runtime console with a focused `TokenLint Cost & Token Tracker` dashboard
- Added top-level dashboard tabs for `Latest Session`, `All Sessions`, and `Aggregate`
- Added enterprise-style KPI summary cards for Sessions, Cost, and Credits
- Added `Export Selected View` controls for CSV and JSON
- Added favorites support for runtime sessions, including favorites-only filtering
- Added expandable per-session rows with token, cost, cache, model, retrieval, context-health, and optimization details
- Added cache efficiency indicators with poor / partial / strong cache states

### Runtime command surface

- Renamed the primary dashboard entry to `TokenLint: Open Cost Dashboard`
- Added command-palette shortcuts for:
  - `TokenLint: Show Latest Session`
  - `TokenLint: Show Aggregate View`
  - `TokenLint: Export Cost View as CSV`
  - `TokenLint: Export Cost View as JSON`
- Export commands now follow the active dashboard tab instead of always exporting the same default view

### Sidebar simplification

- Reworked the Activity Bar sidebar so it emphasizes a single `Open Dashboard` entry instead of duplicating internal runtime navigation there
- Kept context-budget, scan/fix, report, and graph utilities in the sidebar

### Fix engine consistency

- Unified fix availability across Problems, Quick Fix, bulk fixes, and the fix graph
- Review-oriented rules that expose assisted fixes now use the same `finding.fix` source of truth as the bulk-fix and visualization pipeline
- This eliminates the previous mismatch where findings appeared in Problems but surfaced as “no fixes available” in sidebar actions

## Core Capabilities

### Static analysis and compiler pipeline

- Parses prompt, skill, agent, and MCP-oriented artifacts into an intermediate representation
- Runs optimization, retrieval, security, and skills-focused passes over that IR
- Surfaces diagnostics, hovers, quick fixes, reports, and before/after fix previews in VS Code
- Uses a shared fixability model across Quick Fix, bulk fix, and fix visualization flows
- Detects duplicate instructions, prompt injection, malicious skill-test behavior, unsafe permissions, encoded payloads, external endpoints, prompt bloat, and retrieval amplification patterns

### Copilot context-budget analysis

- Live status-bar meter for current context pressure
- Sidebar budget card for current file, open files, workspace estimate, retrieval estimate, usage percent, and risk
- Workspace budget report with estimated token totals, amplification, and highest-risk files
- Risk scoring for warning and critical thresholds

### Runtime observability and AI FinOps

- Dedicated `TokenLint Cost & Token Tracker` dashboard built as a VS Code webview panel
- Session analytics for cost, cache efficiency, credits, latency, retrieval amplification, prompt stability, context pressure, and context health
- Latest-session, all-sessions, and aggregate runtime views in one panel
- Deep cost, cache, and retrieval drilldowns rendered in dedicated webview panels
- Runtime status bar that summarizes live Context, Cache, Cost, and Health
- Export of selected dashboard views as CSV or JSON artifacts
- Favorites support and workspace/time-window filtering for runtime sessions

### Runtime history and diff engine

- Local JSON snapshot persistence under `.tokenlint/`
- Manual and automatic runtime snapshot capture
- Baseline pinning, retention-based pruning, and latest-snapshot tracking
- Comparison modes for previous snapshot, 7-day checkpoint, configured baseline, or a specific saved snapshot
- Regression signals, recommendations, and file-level regression/improvement ranking

## What TokenLint Tracks

- Sessions
- Token usage
- Prompt tokens
- Completion tokens
- Cache creation
- Cache reuse
- Runtime cost
- Credits
- Workspace activity
- Retrieval amplification
- Context pressure
- Context health
- Prompt stability
- Model mix and cost distribution
- File-level findings, risk, retrieval pressure, prompt entropy, cache efficiency, and amplification score

## VS Code Surfaces

### Activity Bar Sidebar

TokenLint adds a dedicated Activity Bar entry in VS Code.

The sidebar includes:

- Copilot Context Budget card with current file, open files, workspace estimate, retrieval estimate, usage, and risk
- Cost Dashboard card with `Open Dashboard`
- Scan / Fix... quick action
- Scan Current File
- Scan Workspace
- Analyze Open Files Budget
- Analyze Workspace Budget
- Generate Report
- Show IR
- Apply All Safe Fixes
- Show Before / After Graph

### Status Bars

TokenLint ships two live status experiences.

- Copilot budget examples: `TokenLint: 42.3k / 128k - 33%`, `TokenLint: 91k / 128k - HIGH`, `TokenLint: 122k / 128k - CRITICAL`
- Runtime examples: `TokenLint Cost  Context: 82.0k  Cache: 71%  Cost: $0.18  Health: 72`
- The runtime status bar opens the cost dashboard directly
- Focus changes refresh live budget/runtime state, while scan-driven refreshes can also capture runtime history snapshots

## Runtime Cost Dashboard

TokenLint includes a dedicated `TokenLint Cost & Token Tracker` dashboard rendered in a VS Code webview panel.

### Dashboard layout

The main dashboard is organized as:

- Header with the `TokenLint Cost & Token Tracker` title
- Time-window controls and refresh action
- Top-level tabs for `Latest Session`, `All Sessions`, and `Aggregate`
- KPI summary bar for Sessions, Cost, and Credits
- Session activity table with expandable rows
- Aggregate analytics panels for workspaces, model mix, runtime health, history, and recommendations

### Latest Session view

The Latest Session view is focused on one runtime session and exposes:

- Session summary and pricing reference
- Token breakdown
- Cost breakdown
- Cache breakdown
- Model details
- Files included
- Retrieval amplification details
- Context-health signals
- Optimization suggestions

### All Sessions view

The All Sessions view provides a session activity table with:

- UTC last-active timestamps
- Source badges
- Workspace badges
- Truncated session titles
- Favorite toggles
- Cost and credits columns
- Cache efficiency state indicators
- Expandable detail panels per row

### Aggregate view

The Aggregate view summarizes:

- Workspace spend concentration
- Model cost mix
- Average cache efficiency, retrieval amplification, context health, and estimated waste/savings
- Runtime recommendations
- History controls and snapshot summaries
- Deep-analysis launch points for cost, cache, and retrieval drilldowns

### Dashboard interactions

- Workspace filter with `All workspaces`, current workspace resolution, and favorites-only filtering
- Time-window controls for `Today`, `7 days`, `This month`, `30 days`, and custom windows inside the dashboard
- CSV and JSON export of the selected dashboard view under `.tokenlint/exports/`
- Expandable session drilldowns with prompt, cost, cache, retrieval, and optimization detail
- Favorite session toggling with persisted favorites-only filtering
- Empty-state actions for analyzing the workspace, opening settings, and future telemetry import flow
- Quick diff actions for previous snapshot and baseline comparison
- Dedicated cost, cache, and retrieval analysis panels outside the main dashboard shell

### Current telemetry model

Today the runtime layer is heuristic and local-first.

- Telemetry is synthesized from Copilot budget state, visible files, workspace analysis, previous session state, and prompt-shape heuristics
- Runtime history snapshots are derived from the latest runtime session plus budget/diagnostic context
- Focus-only refreshes update the live dashboard without automatically snapshotting runtime history

## Runtime History and Diff System

The runtime history system is designed to make AI runtime behavior comparable over time inside a normal VS Code workspace, without requiring an external service.

### Storage layout

- `.tokenlint/history/*.json`: saved runtime snapshots
- `.tokenlint/history/baseline.json`: pinned baseline snapshot id
- `.tokenlint/snapshots/latest.json`: rolling pointer to the newest saved snapshot
- `.tokenlint/analytics/`: generated runtime analysis artifacts
- `.tokenlint/exports/`: exported runtime dashboard views
- `.gitignore` is bootstrapped so `.tokenlint/` stays out of source control by default

### Snapshot capture

- Automatic on scan-driven budget refresh when `tokenlint.history.snapshotOnScan` is enabled
- Automatic when opening the cost dashboard when `tokenlint.history.snapshotOnDashboardOpen` is enabled
- Manual via `TokenLint: Save Runtime Snapshot` or the dashboard aggregate/history surface
- Workspace-local only; history is effectively unavailable if TokenLint has no workspace root to store under
- Duplicate snapshots are avoided: if a newly captured snapshot matches the latest snapshot fingerprint within a 10-minute window, TokenLint reuses the existing snapshot instead of writing a duplicate

### What a snapshot contains

Each runtime snapshot stores a summary layer and a file layer.

Summary metrics include:

- Total tokens
- Prompt tokens
- Completion tokens
- Cache tokens
- Cache efficiency
- Retrieval amplification
- Context health
- Prompt stability
- Runtime cost
- Credits
- Model usage distribution

File metrics include:

- Relative path
- Token estimate
- Finding count from TokenLint diagnostics
- Derived risk level
- Retrieval risk
- Prompt entropy
- Cache efficiency estimate
- Amplification score

### Diff modes

- Latest vs previous snapshot
- Latest vs 7 days ago, falling back to the oldest available snapshot older than the cutoff when needed
- Latest vs baseline snapshot
- Latest vs a user-selected saved snapshot

### Diff outputs

The diff engine computes:

- Summary deltas for total tokens, runtime cost, cache efficiency, retrieval amplification, context health, prompt stability, and credits
- Regression signals with `info`, `warning`, or `critical` severity
- Highest file-level regressions
- Highest file-level improvements
- Operator-facing recommendations based on the observed runtime shifts

### Retention and baseline behavior

- Retention is controlled by both age and maximum snapshot count
- The active baseline snapshot is preserved during pruning
- `TokenLint: Clear Old Runtime History` prunes snapshots that fall outside the configured retention policy; it is not a blind delete-all command
- `TokenLint: Show Runtime History` opens the history-focused dashboard state directly
- The diff commands open the diff-focused dashboard state directly and notify the user if there is not enough history yet for the selected comparison mode

## Fix Engine

TokenLint includes a multi-file fix engine centered on non-destructive automatic remediation.

### TokenLint fixes

- Removes exact duplicate instructions automatically
- Applies every automatic fix whose safety is not marked `unsafe`, not just fixes in the currently focused file
- Falls back from an unsupported active editor to a supported diagnostic file when possible, so sidebar-triggered fix runs do not dead-end unnecessarily
- Uses the same fix metadata that powers Quick Fix and the fix graph, so automatic-fix surfaces stay aligned

### Review-oriented automatic helpers

`TokenLint: Apply All Safe Fixes` also handles a few high-value adjacent cleanup flows that commonly block prompt repositories.

- markdownlint fixes for `MD024`, `MD041`, and `MD056` on TokenLint-relevant files
- Supported JSON dashboard syntax repair for missing wrappers, missing `conditional_formats`, trailing commas, and related EOF/property issues
- Automatic `.tokenlintignore` updates when a file's only remaining TokenLint issue is `optimization.promptSize`
- Review-required security and skills findings can now surface assisted fixes consistently across Problems, Quick Fix, and fix-graph flows

### Post-fix behavior

- Saves edited documents
- Rescans touched files immediately so the Problems view updates without waiting for a later save cycle
- Reports remaining non-fixable TokenLint rule ids and other diagnostic sources when applicable
- Opens a before/after fix graph preview for a representative touched document

## Commands

### Scan, diagnostics, and reports

- `TokenLint: Scan / Fix...`
- `TokenLint: Scan Current File`
- `TokenLint: Scan Workspace`
- `TokenLint: Generate Report`
- `TokenLint: Show IR`
- `TokenLint: Apply All Safe Fixes`
- `TokenLint: Show Before / After Graph`

### Copilot budget commands

- `TokenLint: Set Copilot Budget`
- `TokenLint: Analyze Open Files Budget`
- `TokenLint: Show Copilot Budget`
- `TokenLint: Analyze Workspace Budget`

### Runtime dashboard and history commands

- `TokenLint: Open Cost Dashboard`
- `TokenLint: Show Latest Session`
- `TokenLint: Show Aggregate View`
- `TokenLint: Export Cost View as CSV`
- `TokenLint: Export Cost View as JSON`
- `TokenLint: Save Runtime Snapshot`
- `TokenLint: Show Runtime History`
- `TokenLint: Diff Runtime Against Previous Snapshot`
- `TokenLint: Diff Runtime Against 7 Days Ago`
- `TokenLint: Diff Runtime Against Baseline`
- `TokenLint: Clear Old Runtime History`
- `TokenLint: Show Cost Analysis`
- `TokenLint: Analyze Cache Efficiency`
- `TokenLint: Analyze Retrieval Amplification`

## Settings

### Static analysis settings

- `tokenlint.maxPromptTokens`: default `4000` for large-prompt warnings
- `tokenlint.criticalPromptTokens`: default `8000` for critical prompt-size warnings
- `tokenlint.maxTopK`: default `10` for retrieval `top_k` threshold checks
- `tokenlint.enableSecurityScanner`: default `true`

### Copilot budget settings

- `tokenlint.copilotBudget`: default `128000`
- `tokenlint.warningThresholdPercent`: default `70`
- `tokenlint.criticalThresholdPercent`: default `90`
- `tokenlint.includeWorkspaceEstimate`: default `true`
- `tokenlint.includeRetrievalAmplification`: default `true`

### Runtime settings

- `tokenlint.runtimeTimeWindowDays`: default `7`, configuration values `1`, `7`, `30`
- The dashboard itself can also switch to `Today`, `This month`, `30 days`, or a custom time window at runtime without changing the saved setting

### Runtime history settings

- `tokenlint.history.enabled`: default `true`; enables local runtime history and diff analysis
- `tokenlint.history.retentionDays`: default `30`; minimum `1`
- `tokenlint.history.maxSnapshots`: default `500`; minimum `1`
- `tokenlint.history.snapshotOnScan`: default `true`
- `tokenlint.history.snapshotOnDashboardOpen`: default `true`
- `tokenlint.history.baseline`: default `latest`; may also point at a saved snapshot id

## Scan Scope

TokenLint analyzes prompt-adjacent artifacts and skips known generated or irrelevant content.

- Workspace scans consider `.md`, `.prompt`, `.yaml`, `.yml`, `.json`, `.ts`, `.tsx`, and `.py`
- Editor features are registered for Markdown, YAML, JSON, TypeScript, TSX, Python, and `*.prompt`
- Files must also look like skill, agent, prompt, or MCP artifacts based on path or file name, for example `AGENTS.md`, `copilot-instructions.md`, `.github/agents/**`, `skills/**`, or `mcp.json`
- Generated dependency lockfiles are skipped automatically: `bun.lockb`, `package-lock.json`, `pnpm-lock.yaml`, `pnpm-lock.yml`, `yarn.lock`
- Repository-level exclusions are read from `.tokenlintignore`

## Development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to open the Extension Development Host.

## Testing And Coverage

TokenLint uses Vitest with V8 coverage.

```bash
npm test
npm run test:coverage
```

Coverage is enforced at 95% for statements, branches, functions, and lines.

The coverage run targets `src/**/*.ts` and excludes:

- Test files
- Type-only contracts such as IR and fix interfaces
- Test utilities under `src/test-utils/**`

## Architecture

```text
Runtime Path
VS Code Extension
  ↓
Static Compiler Analysis
  ↓
Copilot Budget Controller
  ↓
Telemetry Collector
  ↓
Session Engine
  ↓
Snapshot Manager / History Store
  ↓
Runtime Dashboard / Analysis Panels
  ↓
Diff Engine / Exports

Compiler Path
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

## Runtime Strategy

### Phase 1

Local and heuristic runtime intelligence based on open files, prompt estimation, retrieval estimation, token counting, and budget-derived telemetry.

### Phase 2

SDK-backed integrations for real runtime hooks such as Copilot requests, MCP calls, agent runs, tool executions, and AI SDK traffic.

## Quick Start

### Static analysis flow

Open:

```text
src/test-fixtures/unsafe-skill.yaml
```

Run:

```text
TokenLint: Scan Current File
```

You should see findings for:

- Prompt injection
- Unsafe permissions
- Retrieval amplification
- Malicious skill-test behavior
- External endpoints

You can also run:

```text
TokenLint: Apply All Safe Fixes
```

to apply automatic non-unsafe fixes, rescan the affected files, and preview the before/after graph.

### Runtime history flow

Run:

```text
TokenLint: Open Cost Dashboard
```

Then:

- Switch between `Latest Session`, `All Sessions`, and `Aggregate` as needed
- Save a snapshot from the History section or run `TokenLint: Save Runtime Snapshot`
- Make prompt or retrieval changes and rescan the workspace
- Run `TokenLint: Diff Runtime Against Previous Snapshot`, `TokenLint: Diff Runtime Against 7 Days Ago`, or `TokenLint: Diff Runtime Against Baseline`
- Use the History section to pin a specific baseline or compare any saved snapshot against the latest runtime state
