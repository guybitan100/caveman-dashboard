import { describe, it, expect } from 'vitest';
import {
  isTerminalTaskStatus,
  getAggregateStatus,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS_PRIORITY,
  TASK_STATUS_CONFIG,
} from '../../types/taskProgress';

describe('isTerminalTaskStatus', () => {
  it('returns true for Done', () => {
    expect(isTerminalTaskStatus('Done')).toBe(true);
  });

  it('returns true for Failed', () => {
    expect(isTerminalTaskStatus('Failed')).toBe(true);
  });

  it('returns true for Cancelled', () => {
    expect(isTerminalTaskStatus('Cancelled')).toBe(true);
  });

  it('returns true for Partial', () => {
    expect(isTerminalTaskStatus('Partial')).toBe(true);
  });

  it('returns false for Pending', () => {
    expect(isTerminalTaskStatus('Pending')).toBe(false);
  });

  it('returns false for Generating', () => {
    expect(isTerminalTaskStatus('Generating')).toBe(false);
  });
});

describe('getAggregateStatus', () => {
  it('returns Pending for empty array', () => {
    expect(getAggregateStatus([])).toBe('Pending');
  });

  it('returns Done when all Done', () => {
    expect(getAggregateStatus(['Done', 'Done', 'Done'])).toBe('Done');
  });

  it('returns Failed when any Failed', () => {
    expect(getAggregateStatus(['Done', 'Failed', 'Generating'])).toBe(
      'Failed'
    );
  });

  it('returns Cancelled when Cancelled is worst', () => {
    expect(getAggregateStatus(['Done', 'Cancelled', 'Done'])).toBe(
      'Cancelled'
    );
  });

  it('returns Generating when mixed with Pending and Done', () => {
    expect(getAggregateStatus(['Done', 'Generating', 'Pending'])).toBe(
      'Generating'
    );
  });

  it('returns single status for single-element array', () => {
    expect(getAggregateStatus(['Pending'])).toBe('Pending');
  });

  it('prioritizes Failed over Cancelled', () => {
    expect(getAggregateStatus(['Failed', 'Cancelled'])).toBe('Failed');
  });
});

describe('TERMINAL_TASK_STATUSES', () => {
  it('contains expected statuses', () => {
    expect(TERMINAL_TASK_STATUSES).toContain('Done');
    expect(TERMINAL_TASK_STATUSES).toContain('Failed');
    expect(TERMINAL_TASK_STATUSES).toContain('Cancelled');
    expect(TERMINAL_TASK_STATUSES).toContain('Partial');
    expect(TERMINAL_TASK_STATUSES).not.toContain('Pending');
    expect(TERMINAL_TASK_STATUSES).not.toContain('Generating');
  });
});

describe('TASK_STATUS_PRIORITY', () => {
  it('has lower number for higher priority', () => {
    expect(TASK_STATUS_PRIORITY.Failed).toBeLessThan(
      TASK_STATUS_PRIORITY.Done
    );
    expect(TASK_STATUS_PRIORITY.Cancelled).toBeLessThan(
      TASK_STATUS_PRIORITY.Done
    );
    expect(TASK_STATUS_PRIORITY.Generating).toBeLessThan(
      TASK_STATUS_PRIORITY.Done
    );
  });
});

describe('TASK_STATUS_CONFIG', () => {
  it('has config for all statuses', () => {
    const statuses = [
      'Pending',
      'Generating',
      'Done',
      'Cancelled',
      'Failed',
      'Partial',
    ] as const;
    for (const s of statuses) {
      expect(TASK_STATUS_CONFIG[s]).toBeDefined();
      expect(TASK_STATUS_CONFIG[s].label).toBeTruthy();
      expect(TASK_STATUS_CONFIG[s].color).toBeTruthy();
      expect(TASK_STATUS_CONFIG[s].backgroundColor).toBeTruthy();
    }
  });

  it('marks Generating as animated', () => {
    expect(TASK_STATUS_CONFIG.Generating.animated).toBe(true);
  });
});
