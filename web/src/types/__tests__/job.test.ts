import { describe, it, expect } from 'vitest';
import { JOB_STATUS_CONFIG, createJobStatusConfig, type JobStatus } from '../../types/job';

describe('JOB_STATUS_CONFIG', () => {
  const allStatuses: JobStatus[] = [
    'Draft',
    'Pending',
    'Generating',
    'Converting',
    'Finalizing',
    'Done',
    'Cancelled',
    'Failed',
    'Deleted',
  ];

  it('has config for all statuses', () => {
    for (const status of allStatuses) {
      expect(JOB_STATUS_CONFIG[status]).toBeDefined();
      expect(JOB_STATUS_CONFIG[status].label).toBe(status);
      expect(JOB_STATUS_CONFIG[status].color).toBeTruthy();
      expect(JOB_STATUS_CONFIG[status].backgroundColor).toBeTruthy();
      expect(JOB_STATUS_CONFIG[status].icon).toBeTruthy();
    }
  });

  it('marks Generating as animated', () => {
    expect(JOB_STATUS_CONFIG.Generating.animated).toBe(true);
  });

  it('marks Converting as animated', () => {
    expect(JOB_STATUS_CONFIG.Converting.animated).toBe(true);
  });

  it('marks Finalizing as animated', () => {
    expect(JOB_STATUS_CONFIG.Finalizing.animated).toBe(true);
  });

  it('does not mark Done as animated', () => {
    expect(JOB_STATUS_CONFIG.Done.animated).toBeFalsy();
  });
});

describe('createJobStatusConfig', () => {
  it('creates config from a theme object', () => {
    const mockTheme = {
      custom: {
        status: {
          draft: { main: '#aaa', background: '#bbb' },
          warning: { background: '#ccc' },
          info: { background: '#ddd' },
          converting: { main: '#eee', background: '#fff' },
          finalizing: { main: '#111', background: '#222' },
          success: { background: '#333' },
          cancelled: { main: '#444', background: '#555' },
          error: { background: '#666' },
          deleted: { main: '#777', background: '#888' },
        },
      },
      palette: {
        warning: { main: '#w1' },
        info: { main: '#i1' },
        success: { dark: '#s1' },
        error: { dark: '#e1' },
      },
    } as any;

    const config = createJobStatusConfig(mockTheme);

    expect(config.Draft.label).toBe('Draft');
    expect(config.Draft.color).toBe('#aaa');
    expect(config.Pending.color).toBe('#w1');
    expect(config.Generating.color).toBe('#i1');
    expect(config.Generating.animated).toBe(true);
    expect(config.Done.color).toBe('#s1');
    expect(config.Failed.color).toBe('#e1');
    expect(config.Converting.color).toBe('#eee');
    expect(config.Finalizing.color).toBe('#111');
    expect(config.Cancelled.color).toBe('#444');
    expect(config.Deleted.color).toBe('#777');
  });
});
