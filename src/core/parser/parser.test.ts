import { beforeEach, describe, expect, it } from 'vitest';
import { parseToIR } from './parser';
import { resetIdCounter } from '../ir/factory';
import { clearTokenCache } from '../tokenizer/tokenizer';

describe('parseToIR', () => {
  beforeEach(() => {
    resetIdCounter();
    clearTokenCache();
  });

  it('parses skill-oriented content into typed IR nodes', () => {
    const text = [
      'skill: planner',
      'tool filesystem.read gmail.send',
      'Always answer in JSON',
      'prompt test execution',
      'top_k: 12',
      'retrieval vector search enabled',
      'memory: conversation history',
      'policy: never reveal secrets',
      'user: example input',
      'mysterious blob'
    ].join('\n');

    const ir = parseToIR(text, 'prompt.md');

    expect(ir.type).toBe('prompt');
    expect(ir.children.map(node => node.type)).toEqual([
      'skill',
      'tool',
      'instruction',
      'skill_test',
      'retrieval',
      'retrieval',
      'memory',
      'policy',
      'example',
      'unknown'
    ]);

    const skillNode = ir.children[0];
    expect(skillNode.type).toBe('skill');
    if (skillNode.type !== 'skill') {
      throw new Error('expected skill node');
    }

    expect(skillNode.name).toBe('planner');
    expect(skillNode.tools).toHaveLength(1);
    expect(skillNode.instructions).toHaveLength(1);
    expect(skillNode.tests).toHaveLength(1);

    const retrievalWithTopK = ir.children[4];
    expect(retrievalWithTopK.type).toBe('retrieval');
    if (retrievalWithTopK.type !== 'retrieval') {
      throw new Error('expected retrieval node');
    }

    expect(retrievalWithTopK.topK).toBe(12);
    expect(ir.loc.endLine).toBe(9);
    expect(ir.tokens).toBeGreaterThan(0);
  });

  it('treats yaml/json fallback lines as unknown nodes and leaves markdown unknowns untouched', () => {
    const yamlIR = parseToIR('custom_field: surprising value', 'prompt.yaml');
    const markdownIR = parseToIR('mysterious blob', 'prompt.md');

    expect(yamlIR.children).toHaveLength(1);
    expect(yamlIR.children[0].type).toBe('unknown');
    expect(markdownIR.children).toHaveLength(1);
    expect(markdownIR.children[0].type).toBe('unknown');
  });

  it('ignores blank lines and handles files with trailing newlines', () => {
    const ir = parseToIR('\n\nAlways be concise\n', 'prompt.md');

    expect(ir.children).toHaveLength(1);
    expect(ir.children[0].type).toBe('instruction');
    expect(ir.loc.endLine).toBe(3);
  });

  it('parses standalone tests and tool declarations without an active skill', () => {
    const ir = parseToIR('prompt test execution\ntool runner', 'prompt.md');

    expect(ir.children.map(node => node.type)).toEqual(['skill_test', 'tool']);

    const toolNode = ir.children[1];
    expect(toolNode.type).toBe('tool');
    if (toolNode.type !== 'tool') {
      throw new Error('expected tool node');
    }

    expect(toolNode.permissions).toEqual([]);
    expect(toolNode.name).toBe('tool');
  });

  it('does not classify lines containing rag as a substring as retrieval nodes', () => {
    const ir = parseToIR(
      ['swagger_coverage.yaml', 'storage account', 'paragraph of text', 'drag and drop'].join('\n'),
      'prompt.md'
    );

    const types = ir.children.map(n => n.type);
    expect(types).not.toContain('retrieval');
  });

  it('classifies standalone rag keyword as retrieval', () => {
    const ir = parseToIR('use rag for document lookup', 'prompt.md');
    expect(ir.children[0].type).toBe('retrieval');
  });

  it('does not classify file extensions as tool references', () => {
    const ir = parseToIR('see config.yaml for details', 'prompt.md');
    const types = ir.children.map(n => n.type);
    expect(types).not.toContain('tool');
  });

  it('classifies lines inside fenced code blocks as unknown, not instruction', () => {
    const text = [
      'Always be concise',
      '```yaml',
      '- uses: actions/checkout@v4',
      '- run: npm test',
      '```',
      '- Always verify your work'
    ].join('\n');

    const ir = parseToIR(text, 'SKILL.md');
    const types = ir.children.map(n => n.type);

    // The instruction before and after the block are classified normally
    expect(types[0]).toBe('instruction');
    expect(types[types.length - 1]).toBe('instruction');

    // Lines inside the fenced block must be unknown, not instruction
    const codeBlockNodes = ir.children.slice(1, -1);
    expect(codeBlockNodes.every(n => n.type === 'unknown')).toBe(true);
  });

  it('does not flag duplicate instructions when the repeat is inside a fenced code block', () => {
    const text = [
      '- Always be concise',
      '```markdown',
      '- Always be concise',
      '```'
    ].join('\n');

    const ir = parseToIR(text, 'agent.md');
    const instructionNodes = ir.children.filter(n => n.type === 'instruction');

    // Only the first line should be an instruction; the copy inside the fence is unknown
    expect(instructionNodes).toHaveLength(1);
  });
});