import { describe, it, expect } from 'vitest';
import {
  DELETED_STATE_OPTIONS,
  LOCATION_CATEGORY_OPTIONS,
  MESSAGE_STATUS_OPTIONS,
  CALL_DIRECTION_OPTIONS,
  CALL_TYPE_OPTIONS,
  EMAIL_FOLDER_OPTIONS,
  POWERING_EVENT_TYPE_OPTIONS,
  FILE_STORY_TYPES,
  GROUP_STORY_TYPES,
  getStoryFieldConfig,
  createDefaultStoryParams,
  isFileStoryType,
  isGroupStoryType,
} from '../../types/storyParams';

describe('storyParams constants', () => {
  it('DELETED_STATE_OPTIONS has 3 options', () => {
    expect(DELETED_STATE_OPTIONS).toHaveLength(3);
    expect(DELETED_STATE_OPTIONS).toContain('Deleted');
    expect(DELETED_STATE_OPTIONS).toContain('Intact');
    expect(DELETED_STATE_OPTIONS).toContain('Unknown');
  });

  it('LOCATION_CATEGORY_OPTIONS has entries', () => {
    expect(LOCATION_CATEGORY_OPTIONS.length).toBeGreaterThan(0);
    expect(LOCATION_CATEGORY_OPTIONS).toContain('Mentioned');
    expect(LOCATION_CATEGORY_OPTIONS).toContain('GpsFix');
  });

  it('MESSAGE_STATUS_OPTIONS has 2 options', () => {
    expect(MESSAGE_STATUS_OPTIONS).toEqual(['Sent', 'Read']);
  });

  it('CALL_DIRECTION_OPTIONS has 3 options', () => {
    expect(CALL_DIRECTION_OPTIONS).toEqual(['Incoming', 'Outgoing', 'Unknown']);
  });

  it('CALL_TYPE_OPTIONS has 6 options', () => {
    expect(CALL_TYPE_OPTIONS).toHaveLength(6);
  });

  it('EMAIL_FOLDER_OPTIONS has 2 options', () => {
    expect(EMAIL_FOLDER_OPTIONS).toEqual(['Inbox', 'Sent Items']);
  });

  it('POWERING_EVENT_TYPE_OPTIONS has 6 options', () => {
    expect(POWERING_EVENT_TYPE_OPTIONS).toHaveLength(6);
  });

  it('FILE_STORY_TYPES includes media types', () => {
    expect(FILE_STORY_TYPES).toContain('image');
    expect(FILE_STORY_TYPES).toContain('video');
    expect(FILE_STORY_TYPES).toContain('audio');
    expect(FILE_STORY_TYPES).toContain('document');
  });

  it('GROUP_STORY_TYPES includes chat and route', () => {
    expect(GROUP_STORY_TYPES).toEqual(['chat', 'route']);
  });
});

describe('getStoryFieldConfig', () => {
  it('returns config for location', () => {
    const config = getStoryFieldConfig('location');
    expect(config.length).toBeGreaterThan(0);
    expect(config.some((f) => f.name === 'coordinate')).toBe(true);
  });

  it('returns config for call', () => {
    const config = getStoryFieldConfig('call');
    expect(config.length).toBeGreaterThan(0);
    expect(config.some((f) => f.name === 'participant')).toBe(true);
  });

  it('returns config for sms/mms', () => {
    const config = getStoryFieldConfig('sms/mms');
    expect(config.length).toBeGreaterThan(0);
  });

  it('returns config for email', () => {
    const config = getStoryFieldConfig('email');
    expect(config.length).toBeGreaterThan(0);
  });

  it('returns config for image', () => {
    const config = getStoryFieldConfig('image');
    expect(config.length).toBeGreaterThan(0);
    expect(config.some((f) => f.name === 'deleted_state')).toBe(true);
  });

  it('returns config for chat message', () => {
    const config = getStoryFieldConfig('chat message');
    expect(config.length).toBeGreaterThan(0);
  });

  it('returns empty array for unrecognized type', () => {
    const config = getStoryFieldConfig('nonexistent_type' as any);
    expect(config).toEqual([]);
  });
});

describe('createDefaultStoryParams', () => {
  it('creates defaults for location', () => {
    const params = createDefaultStoryParams('location');
    expect(params.coordinate).toEqual({ latitude: 0, longitude: 0 });
    expect(params).toHaveProperty('category');
  });

  it('creates defaults for contact', () => {
    const params = createDefaultStoryParams('contact');
    expect(params.contact).toEqual({
      first_name: null,
      last_name: null,
      phones: [],
      emails: [],
    });
  });

  it('creates defaults for app', () => {
    const params = createDefaultStoryParams('app');
    expect(params.app).toEqual({ app_id: '', name: null });
  });

  it('creates defaults for call', () => {
    const params = createDefaultStoryParams('call');
    expect(typeof params).toBe('object');
  });

  it('creates defaults for image', () => {
    const params = createDefaultStoryParams('image');
    expect(params.deleted_state).toBe('Intact');
  });

  it('creates params for chat message', () => {
    const params = createDefaultStoryParams('chat message');
    expect(typeof params).toBe('object');
  });

  it('returns empty object for type with no config', () => {
    const params = createDefaultStoryParams('nonexistent_type' as any);
    expect(params).toEqual({});
  });
});

describe('isFileStoryType', () => {
  it('returns true for image', () => {
    expect(isFileStoryType('image')).toBe(true);
  });

  it('returns true for video', () => {
    expect(isFileStoryType('video')).toBe(true);
  });

  it('returns false for location', () => {
    expect(isFileStoryType('location')).toBe(false);
  });

  it('returns false for call', () => {
    expect(isFileStoryType('call')).toBe(false);
  });
});

describe('isGroupStoryType', () => {
  it('returns true for chat', () => {
    expect(isGroupStoryType('chat')).toBe(true);
  });

  it('returns true for route', () => {
    expect(isGroupStoryType('route')).toBe(true);
  });

  it('returns false for image', () => {
    expect(isGroupStoryType('image')).toBe(false);
  });
});
