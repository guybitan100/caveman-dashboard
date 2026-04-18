import { describe, it, expect } from 'vitest';
import { PIPELINE_STEPS } from '../../types/pipeline';

describe('PIPELINE_STEPS', () => {
  it('has 7 steps', () => {
    expect(PIPELINE_STEPS).toHaveLength(7);
  });

  it('starts with story-expansion', () => {
    expect(PIPELINE_STEPS[0].key).toBe('story-expansion');
  });

  it('ends with submit-job', () => {
    expect(PIPELINE_STEPS[6].key).toBe('submit-job');
  });

  it('each step has key, label, description, endpoint', () => {
    for (const step of PIPELINE_STEPS) {
      expect(step.key).toBeTruthy();
      expect(step.label).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.endpoint).toBeTruthy();
    }
  });

  it('steps are in correct order', () => {
    const keys = PIPELINE_STEPS.map((s) => s.key);
    expect(keys).toEqual([
      'story-expansion',
      'entity-extraction',
      'social-graph',
      'timeline',
      'phone-selection',
      'story-generation',
      'submit-job',
    ]);
  });

  it('endpoints follow sequential numbering', () => {
    PIPELINE_STEPS.forEach((step, i) => {
      expect(step.endpoint).toContain(`/pipeline/${i + 1}/`);
    });
  });
});
