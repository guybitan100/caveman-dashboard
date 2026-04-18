import { describe, it, expect } from 'vitest';
import { getEntityDisplayName, getEntityInitials } from '../entity';

describe('getEntityDisplayName', () => {
  it('returns full name when both names present', () => {
    expect(
      getEntityDisplayName({ first_name: 'John', last_name: 'Doe' })
    ).toBe('John Doe');
  });

  it('returns first name only', () => {
    expect(getEntityDisplayName({ first_name: 'John' })).toBe('John');
  });

  it('returns last name only', () => {
    expect(getEntityDisplayName({ last_name: 'Doe' })).toBe('Doe');
  });

  it('falls back to phone', () => {
    expect(getEntityDisplayName({ phone: '+1234567890' })).toBe('+1234567890');
  });

  it('falls back to email', () => {
    expect(getEntityDisplayName({ email: 'john@example.com' })).toBe(
      'john@example.com'
    );
  });

  it('falls back to uid', () => {
    expect(getEntityDisplayName({ uid: 'uid-123' })).toBe('uid-123');
  });

  it('returns Unknown when nothing available', () => {
    expect(getEntityDisplayName({})).toBe('Unknown');
  });

  it('ignores null names', () => {
    expect(
      getEntityDisplayName({
        first_name: null,
        last_name: null,
        phone: '+999',
      })
    ).toBe('+999');
  });

  it('handles Entity type with is_owner', () => {
    expect(
      getEntityDisplayName({
        uid: 'u1',
        is_owner: true,
        first_name: 'Alice',
        last_name: 'Smith',
        phone: null,
        email: null,
        is_male: false,
      })
    ).toBe('Alice Smith');
  });
});

describe('getEntityInitials', () => {
  it('returns both initials when both names present', () => {
    expect(
      getEntityInitials({ first_name: 'John', last_name: 'Doe' })
    ).toBe('JD');
  });

  it('returns first initial only', () => {
    expect(getEntityInitials({ first_name: 'John' })).toBe('J');
  });

  it('returns last initial only', () => {
    expect(getEntityInitials({ last_name: 'Doe' })).toBe('D');
  });

  it('returns ? when no names', () => {
    expect(getEntityInitials({})).toBe('?');
  });

  it('uppercases initials', () => {
    expect(
      getEntityInitials({ first_name: 'john', last_name: 'doe' })
    ).toBe('JD');
  });

  it('handles null names', () => {
    expect(
      getEntityInitials({ first_name: null, last_name: null })
    ).toBe('?');
  });
});
