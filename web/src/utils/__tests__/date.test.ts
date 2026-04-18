import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  formatDate,
  formatFullTimestamp,
  formatTime,
  formatDateRange,
} from '../date';

describe('formatTimestamp', () => {
  it('formats a valid ISO string', () => {
    const result = formatTimestamp('2024-01-15T14:30:00Z');
    expect(result).toBeTruthy();
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('returns fallback for null', () => {
    expect(formatTimestamp(null)).toBe('');
  });

  it('returns fallback for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('');
  });

  it('returns custom fallback', () => {
    expect(formatTimestamp(null, 'N/A')).toBe('N/A');
  });

  it('returns fallback for invalid date string', () => {
    expect(formatTimestamp('not-a-date')).toBe('');
  });

  it('formats a Date object', () => {
    const date = new Date('2024-06-20T10:00:00Z');
    const result = formatTimestamp(date);
    expect(result).toBeTruthy();
    expect(result).toContain('Jun');
    expect(result).toContain('20');
  });
});

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('returns default fallback for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('returns custom fallback for undefined', () => {
    expect(formatDate(undefined, 'none')).toBe('none');
  });

  it('returns fallback for invalid date', () => {
    expect(formatDate('xyz')).toBe('N/A');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date('2024-12-25'));
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2024');
  });
});

describe('formatFullTimestamp', () => {
  it('formats with date and time', () => {
    const result = formatFullTimestamp('2024-01-15T14:30:00Z');
    expect(result).toBeTruthy();
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('returns fallback for null', () => {
    expect(formatFullTimestamp(null)).toBe('');
  });

  it('returns fallback for invalid', () => {
    expect(formatFullTimestamp('bad')).toBe('');
  });

  it('returns custom fallback', () => {
    expect(formatFullTimestamp(null, 'unknown')).toBe('unknown');
  });
});

describe('formatTime', () => {
  it('formats time from ISO string', () => {
    const result = formatTime('2024-01-15T14:30:00Z');
    expect(result).toBeTruthy();
  });

  it('returns fallback for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('returns fallback for invalid', () => {
    expect(formatTime('bad')).toBe('');
  });

  it('returns custom fallback', () => {
    expect(formatTime(null, 'N/A')).toBe('N/A');
  });
});

describe('formatDateRange', () => {
  it('formats a valid range', () => {
    const result = formatDateRange('2024-01-15', '2024-01-20');
    expect(result).toContain('Jan 15, 2024');
    expect(result).toContain('Jan 20, 2024');
    expect(result).toContain('–');
  });

  it('returns fallback when start is null', () => {
    expect(formatDateRange(null, '2024-01-20')).toBe('Not set');
  });

  it('returns fallback when end is null', () => {
    expect(formatDateRange('2024-01-15', null)).toBe('Not set');
  });

  it('returns fallback when both are null', () => {
    expect(formatDateRange(null, null)).toBe('Not set');
  });

  it('returns custom fallback', () => {
    expect(formatDateRange(null, null, 'TBD')).toBe('TBD');
  });

  it('returns fallback when start is invalid', () => {
    expect(formatDateRange('bad', '2024-01-20')).toBe('Not set');
  });

  it('returns fallback when end is invalid', () => {
    expect(formatDateRange('2024-01-15', 'bad')).toBe('Not set');
  });
});
