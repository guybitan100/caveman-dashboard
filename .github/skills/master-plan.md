# TokenLint Master Plan

## Vision

TokenLint aims to become the industry-standard linter for AI-generated and AI-consumed content — prompts, skills, agents, MCP workflows, and cognitive pipelines. Just as ESLint transformed JavaScript quality and Clippy improved Rust ergonomics, TokenLint brings compile-time analysis to the AI prompt engineering workflow.

## Current State (v0.2.0 — MVP)

### Completed

- **Compiler core**: Parser → IR → Passes → Findings pipeline
- **10 analysis passes** across 4 categories (security, optimization, retrieval, skills)
- **VS Code extension** with diagnostics, hover, quick fixes, workspace scanning, and report generation
- **6 language support**: Markdown, YAML, JSON, TypeScript, Python, `.prompt`
- **Token-aware analysis**: GPT tokenizer integration for accurate cost estimation
- **Quick fix actions**: Auto-remediation for duplicate instructions and high top_k values

### Architecture Strengths

- **Extensible pass system**: New passes implement `TokenLintPass` interface and register in engine
- **Language-agnostic IR**: Same analysis pipeline works across all supported file formats
- **Non-destructive**: Read-only analysis with suggested fixes, never auto-modifies source
- **Cached results**: Diagnostic provider caches analysis results per-document for performance

## Roadmap

### Phase 1: Foundation Hardening

- **Unit test suite**: Tests for parser, normalizer, each pass, and IR factory
- **Integration tests**: End-to-end tests with fixture files
- **CI/CD pipeline**: Automated build, test, lint, and package
- **Configuration expansion**: Per-rule enable/disable, custom thresholds per pass
- **Telemetry**: Anonymous usage metrics for adoption tracking

### Phase 2: Enhanced Detection

- **Additional security passes**:
  - Data poisoning detection (training data manipulation patterns)
  - System prompt leakage detection
  - Indirect prompt injection (via retrieval content)
  - Token smuggling detection
- **Additional optimization passes**:
  - Redundant context detection
  - Instruction ordering optimization
  - Token budget estimation per model
- **Additional retrieval passes**:
  - Chunk overlap analysis
  - Source diversity scoring
  - Retrieval latency estimation

### Phase 3: Multi-Model & MCP Support

- **Model-specific tokenizers**: Support GPT-4, Claude, Gemini, Llama tokenizers
- **MCP workflow analysis**: Parse and analyze MCP server configurations
- **Agent graph analysis**: Multi-agent communication pattern detection
- **Tool chain analysis**: Detect unsafe tool composition across agent boundaries

### Phase 4: Enterprise Features

- **Centralized rule management**: Shared rule configurations across teams
- **Policy-as-code**: Define organization-wide prompt security policies
- **Compliance reporting**: SOC 2, NIST AI RMF, EU AI Act alignment
- **SARIF output**: Standard security finding format for CI/CD integration
- **GitHub/GitLab integration**: PR checks and code review annotations

### Phase 5: Intelligence Layer

- **ML-powered detection**: Fine-tuned models for injection pattern recognition
- **Prompt quality scoring**: Holistic quality metrics beyond individual rules
- **Auto-remediation**: AI-assisted prompt rewriting for detected issues
- **Benchmark suite**: Standard test suite for cognitive security tools

## Architecture Evolution

### Current Architecture

```text
File → Parser → IR → Sequential Passes → Findings → VS Code UI
```

### Target Architecture

```text
File(s) → Parser(s) → IR Forest
                         ↓
               Pass Scheduler (parallel-capable)
                    ↓
            Finding Aggregator
            ↓            ↓            ↓
      VS Code UI    SARIF Export    CI/CD Output
            ↓
     Fix Suggester (AI-assisted)
```

### Key Architectural Goals

1. **Parallel pass execution**: Independent passes run concurrently
2. **Incremental analysis**: Only re-analyze changed files/nodes
3. **Multi-file analysis**: Cross-file skill dependency tracking
4. **Pluggable output**: SARIF, JSON, Markdown, VS Code, CLI
5. **External pass loading**: Third-party pass packages via npm

## Market Positioning

### Target Users

1. **Prompt engineers**: Quality and security in prompt development
2. **AI security teams**: Cognitive security auditing and compliance
3. **Platform teams**: Centralized prompt quality standards
4. **MCP/Agent developers**: Skill and agent workflow validation

### Competitive Differentiation

- **Compiler-based approach**: Structural analysis, not just string matching
- **Token-aware**: Cost implications built into every finding
- **Security-first**: Purpose-built for AI cognitive threats
- **IDE-native**: First-class VS Code integration, not a CLI afterthought
- **Extensible**: Plugin architecture for custom organization rules

## Success Metrics

| Metric                     | MVP Target | 6-Month Target |
|----------------------------|------------|----------------|
| Detection rules            | 10         | 30+            |
| Supported file formats     | 6          | 12+            |
| Quick fix coverage         | 2 rules    | 50%+ of rules  |
| False positive rate        | < 20%      | < 5%           |
| Analysis latency (single)  | < 100ms    | < 50ms         |
| VS Code Marketplace rating | —          | 4.5+           |
