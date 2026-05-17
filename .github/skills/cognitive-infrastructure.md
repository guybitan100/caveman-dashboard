# TokenLint Cognitive Infrastructure

## Overview

TokenLint is a compiler-style cognitive security linter that treats AI prompts, skills, MCP workflows, and agent configurations as compilable source code. It parses source files into an Intermediate Representation (IR), then runs a pipeline of analysis passes to detect security vulnerabilities, optimization opportunities, and retrieval risks.

## Compiler Architecture

```
Source File (.md/.yaml/.json/.ts/.py/.prompt)
    ↓
Language Detector
    ↓
Parser (text → IR)
    ↓
Intermediate Representation (IR Tree)
    ↓
Analysis Engine (10 sequential passes)
    ├── Optimization Passes (3)
    ├── Retrieval Passes (2)
    ├── Security Passes (4)
    └── Skills Pass (1)
    ↓
Findings Collection
    ↓
Output Layer
    ├── VS Code Diagnostics
    ├── Hover Tooltips
    ├── Quick Fix Actions
    └── Markdown Reports
```

## Intermediate Representation (IR)

The IR is an abstract tree structure modeling the semantic components of AI prompts and skills.

### Node Type Hierarchy

```typescript
IRNode = PromptNode | InstructionNode | PolicyNode | ExampleNode
       | RetrievalNode | MemoryNode | ToolNode | SkillNode
       | SkillTestNode | UnknownNode
```

### Base Node Structure

Every node extends:

| Field      | Type                        | Description                          |
|------------|-----------------------------|--------------------------------------|
| `id`       | `string`                    | Unique identifier (e.g., `instruction_1`) |
| `type`     | `string`                    | Discriminator field                  |
| `raw`      | `string`                    | Original source text                 |
| `tokens`   | `number`                    | GPT token count (via `gpt-tokenizer`) |
| `loc`      | `SourceLocation`            | Line/column source span              |
| `metadata` | `Record<string, unknown>?`  | Optional pass-specific data          |

### Source Location

```typescript
interface SourceLocation {
  startLine: number;    // 0-indexed
  startColumn: number;  // 0-indexed
  endLine: number;
  endColumn: number;
}
```

### Node Types

| Node Type         | Key Fields                                  | Purpose                                  |
|-------------------|---------------------------------------------|------------------------------------------|
| **PromptNode**    | `children: IRNode[]`                        | Root container for all content           |
| **InstructionNode** | `content`, `normalized`                   | System instructions (with normalization) |
| **PolicyNode**    | `content`                                   | Rules, constraints, safety policies      |
| **ExampleNode**   | `content`                                   | Few-shot examples, conversation samples  |
| **RetrievalNode** | `topK?`, `source?`                          | RAG/vector retrieval configurations      |
| **MemoryNode**    | `content`                                   | Conversation history, context modules    |
| **ToolNode**      | `name`, `permissions: string[]`             | Tool definitions with capabilities       |
| **SkillNode**     | `name`, `tools[]`, `instructions[]`, `tests[]` | AI skill definition (container)      |
| **SkillTestNode** | `name`, `content`                           | Skill test cases/scenarios               |
| **UnknownNode**   | `content`                                   | Unclassified content                     |

### IR Factory

The factory module (`src/core/ir/factory.ts`) provides:

- `tokenCount(text)` — GPT token count via `gpt-tokenizer.encode()`
- `loc(line, text)` — Source location from line index
- `instruction(content, line)` — InstructionNode with normalized text
- `policy(content, line)` — PolicyNode
- `example(content, line)` — ExampleNode
- `retrieval(raw, line, topK?, source?)` — RetrievalNode
- `memory(content, line)` — MemoryNode
- `tool(raw, line, name, permissions?)` — ToolNode
- `skill(raw, line, name)` — SkillNode (empty containers)
- `skillTest(raw, line, name)` — SkillTestNode
- `unknown(content, line)` — UnknownNode

## Parser

### Language Detection

| Extension       | Kind         |
|-----------------|--------------|
| `.md`           | `markdown`   |
| `.prompt`       | `prompt`     |
| `.yaml`, `.yml` | `yaml`       |
| `.json`         | `json`       |
| `.ts`, `.tsx`   | `typescript` |
| `.py`           | `python`     |
| Other           | `unknown`    |

### Instruction Normalization

Applied to `InstructionNode.normalized`:

1. `toLowerCase()`
2. Strip markup characters: `` ` " ' * _ # > - ``
3. Strip punctuation: `. , ; : ! ?`
4. Collapse whitespace to single spaces
5. `trim()`

### Instruction Detection Heuristics

A line is classified as an instruction if:

- Starts with: `- `, `* `, `always `, `never `, `do not `, `dont `, `you must `, `you are `
- Contains: `instruction`, `system prompt`
- Minimum length: 8 characters

### Parse Algorithm

For each line in the file:

1. **Skill declaration** — Match `/(?:name|skill)\s*[:=]\s*["']?([a-zA-Z0-9_-]+)/` or `/skill\s+([a-zA-Z0-9_-]+)/i`
2. **Skill test** — Contains `test` AND (`skill` OR `prompt`)
3. **Retrieval** — Contains `top_k`, `retrieval`, `vector`, or `rag`
4. **Memory** — Contains `memory` or `conversation history`
5. **Policy** — Contains `policy`, `constraint`, or `rule`
6. **Example** — Contains `example` or starts with `user:` / `assistant:`
7. **Tool** — Contains `tool`, `permission`, or dotted notation (`a.b`)
8. **Instruction** — Passes `looksLikeInstruction()` check
9. **JSON/YAML fallback** — Treated as instruction
10. **Default** — UnknownNode

## Analysis Engine

### Entry Point

```typescript
analyze(text: string, fileName: string): AnalysisResult
```

### AnalysisResult Structure

```typescript
interface AnalysisResult {
  ir: PromptNode;
  findings: TokenLintFinding[];
  metrics: {
    totalTokens: number;
    findingCount: number;
    errorCount: number;
    warningCount: number;
  };
}
```

### Finding Structure

```typescript
interface TokenLintFinding {
  ruleId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  loc: SourceLocation;
  nodeId?: string;
  fix?: { title: string; replacement?: string };
  metadata?: Record<string, unknown>;
}
```

### Pass Execution Order

| #  | Pass                       | Category     |
|----|----------------------------|--------------|
| 1  | duplicateInstructionPass   | optimization |
| 2  | promptSizePass             | optimization |
| 3  | oversizedExamplePass       | optimization |
| 4  | retrievalRiskPass          | retrieval    |
| 5  | contextAmplificationPass   | retrieval    |
| 6  | promptInjectionPass        | security     |
| 7  | encodedPayloadPass         | security     |
| 8  | externalEndpointPass       | security     |
| 9  | unsafePermissionPass       | security     |
| 10 | maliciousSkillTestPass     | skills       |

All passes are independent and run sequentially on the same IR root.

## Token Counting

Uses the `gpt-tokenizer` package (GPT-3 tokenizer) to compute accurate token counts for each node and the overall prompt. Token counts feed into optimization passes and reporting metrics.

## Design Principles

- **Compiler-inspired**: Parse → IR → Analysis Passes → Findings (like a compiler frontend)
- **Language-agnostic**: Supports MD, YAML, JSON, TS, Python, and `.prompt` files
- **Extensible**: New passes implement the `TokenLintPass` interface and register in the engine
- **Non-destructive**: Analysis is read-only; fixes are suggested, not auto-applied
- **Security-first**: 4 dedicated security passes for cognitive threat detection
