# TokenLint VS Code Compiler MVP

TokenLint is a compiler-style VS Code extension for prompts, AI skills, MCP workflows, and cognitive security.

## What This MVP Includes

- Real VS Code extension entrypoint
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

## Activity Bar Sidebar

TokenLint now adds a dedicated Activity Bar icon in VS Code.

The sidebar includes:

- Scan Current File
- Scan Workspace
- Generate Report
- Show IR
- Apply All Safe Fixes

## Fix Engine

TokenLint includes a safe fix engine.

### Safe automatic fixes

- Remove exact duplicate instructions

### Review-required fixes

- Reduce `top_k`
- Neutralize suspicious prompt-injection phrases
- Comment external endpoints for review
- Disable suspicious skill tests
- Replace suspicious encoded payloads with a review marker

## Commands

- `TokenLint: Scan Current File`
- `TokenLint: Scan Workspace`
- `TokenLint: Generate Report`
- `TokenLint: Show IR`
- `TokenLint: Apply All Safe Fixes`

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
