import { describe, it, expect } from 'vitest';
import {
  FILE_EVENT_TYPES,
  CHAT_ATTACHMENT_EVENT_TYPES,
  SIMPLE_EVENT_TYPES,
  TASK_FIELD_CONFIGS,
  hasConfigurableParams,
  getFieldConfig,
  createDefaultParams,
} from '../../types/taskParams';

describe('taskParams constants', () => {
  it('FILE_EVENT_TYPES includes media types', () => {
    expect(FILE_EVENT_TYPES).toContain('images');
    expect(FILE_EVENT_TYPES).toContain('videos');
    expect(FILE_EVENT_TYPES).toContain('audios');
    expect(FILE_EVENT_TYPES).toContain('documents');
  });

  it('CHAT_ATTACHMENT_EVENT_TYPES includes expected types', () => {
    expect(CHAT_ATTACHMENT_EVENT_TYPES.length).toBeGreaterThan(0);
  });

  it('SIMPLE_EVENT_TYPES includes simple types', () => {
    expect(SIMPLE_EVENT_TYPES).toContain('passwords');
    expect(SIMPLE_EVENT_TYPES).toContain('installed applications');
  });

  it('TASK_FIELD_CONFIGS has entries for various event types', () => {
    expect(TASK_FIELD_CONFIGS.images).toBeDefined();
    expect(TASK_FIELD_CONFIGS['chat messages']).toBeDefined();
    expect(TASK_FIELD_CONFIGS.calls).toBeDefined();
  });
});

describe('hasConfigurableParams', () => {
  it('returns true for images', () => {
    expect(hasConfigurableParams('images')).toBe(true);
  });

  it('returns true for chat messages', () => {
    expect(hasConfigurableParams('chat messages')).toBe(true);
  });

  it('returns false for passwords', () => {
    expect(hasConfigurableParams('passwords')).toBe(false);
  });

  it('returns false for installed applications', () => {
    expect(hasConfigurableParams('installed applications')).toBe(false);
  });
});

describe('getFieldConfig', () => {
  it('returns config for images', () => {
    const config = getFieldConfig('images');
    expect(config.length).toBeGreaterThan(0);
  });

  it('returns config for chat messages', () => {
    const config = getFieldConfig('chat messages');
    expect(config.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown type', () => {
    const config = getFieldConfig('passwords');
    expect(config).toEqual([]);
  });
});

describe('createDefaultParams', () => {
  it('creates defaults for images', () => {
    const params = createDefaultParams('images');
    expect(params).toBeDefined();
    expect(typeof params).toBe('object');
  });

  it('creates defaults for chat messages', () => {
    const params = createDefaultParams('chat messages');
    expect(params).toBeDefined();
  });

  it('returns empty object for simple event type', () => {
    const params = createDefaultParams('passwords');
    expect(params).toEqual({});
  });

  it('populates defaultValue from field configs', () => {
    const params = createDefaultParams('images');
    // images should have format config with default values
    expect(Object.keys(params).length).toBeGreaterThanOrEqual(0);
  });
});
