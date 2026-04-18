import { describe, it, expect } from 'vitest';
import { getStoryIcon, getStoryTypeName } from '../storyIcons';

describe('getStoryTypeName', () => {
  it('capitalizes first letter', () => {
    expect(getStoryTypeName('location')).toBe('Location');
    expect(getStoryTypeName('image')).toBe('Image');
    expect(getStoryTypeName('audio')).toBe('Audio');
    expect(getStoryTypeName('video')).toBe('Video');
    expect(getStoryTypeName('document')).toBe('Document');
    expect(getStoryTypeName('chat')).toBe('Chat');
    expect(getStoryTypeName('route')).toBe('Route');
    expect(getStoryTypeName('app')).toBe('App');
    expect(getStoryTypeName('contact')).toBe('Contact');
  });

  it('preserves rest of the string', () => {
    expect(getStoryTypeName('sms/mms')).toBe('Sms/mms');
    expect(getStoryTypeName('web history')).toBe('Web history');
  });
});

describe('getStoryIcon', () => {
  it('returns an element for known types', () => {
    expect(getStoryIcon('location')).toBeDefined();
    expect(getStoryIcon('image')).toBeDefined();
    expect(getStoryIcon('audio')).toBeDefined();
    expect(getStoryIcon('video')).toBeDefined();
    expect(getStoryIcon('document')).toBeDefined();
    expect(getStoryIcon('chat')).toBeDefined();
    expect(getStoryIcon('route')).toBeDefined();
    expect(getStoryIcon('app')).toBeDefined();
    expect(getStoryIcon('contact')).toBeDefined();
  });

  it('returns undefined for unknown type', () => {
    expect(getStoryIcon('sms/mms')).toBeUndefined();
    expect(getStoryIcon('email')).toBeUndefined();
    expect(getStoryIcon('web history')).toBeUndefined();
  });

  it('accepts fontSize parameter', () => {
    const el = getStoryIcon('location', 'large');
    expect(el).toBeDefined();
  });
});
