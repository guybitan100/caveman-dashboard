import { describe, it, expect } from 'vitest';
import { fixesFromFindings } from './fixEngine';
import { TokenLintFinding } from '../engine/finding';

describe('fixesFromFindings', () => {
  it('returns empty array when no findings have fixes', () => {
    const findings: TokenLintFinding[] = [{
      ruleId: 'test.noFix',
      title: 'No fix available',
      message: 'This has no fix',
      severity: 'warning',
      loc: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 10 }
    }];
    expect(fixesFromFindings(findings)).toHaveLength(0);
  });

  it('extracts fixes from findings that have them', () => {
    const findings: TokenLintFinding[] = [{
      ruleId: 'optimization.duplicateInstruction',
      title: 'Duplicate',
      message: 'Dup found',
      severity: 'warning',
      loc: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 20 },
      fix: { title: 'Remove duplicate', replacement: '' }
    }];
    const fixes = fixesFromFindings(findings);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].safety).toBe('safe');
    expect(fixes[0].replacement).toBe('');
  });

  it('marks duplicateInstruction fixes as safe', () => {
    const findings: TokenLintFinding[] = [{
      ruleId: 'optimization.duplicateInstruction',
      title: 'Dup',
      message: 'Dup',
      severity: 'warning',
      loc: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 10 },
      fix: { title: 'Remove', replacement: '' }
    }];
    expect(fixesFromFindings(findings)[0].safety).toBe('safe');
  });

  it('marks security fixes as review_required', () => {
    const findings: TokenLintFinding[] = [{
      ruleId: 'security.promptInjection',
      title: 'Injection',
      message: 'Bad',
      severity: 'error',
      loc: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 10 },
      fix: { title: 'Neutralize', replacement: '[REMOVED]' }
    }];
    expect(fixesFromFindings(findings)[0].safety).toBe('review_required');
  });

  it('generates correct fix id from ruleId and line', () => {
    const findings: TokenLintFinding[] = [{
      ruleId: 'test.rule',
      title: 'T',
      message: 'M',
      severity: 'warning',
      loc: { startLine: 7, startColumn: 0, endLine: 7, endColumn: 10 },
      fix: { title: 'Fix it', replacement: 'fixed' }
    }];
    expect(fixesFromFindings(findings)[0].id).toBe('test.rule:7');
  });
});
