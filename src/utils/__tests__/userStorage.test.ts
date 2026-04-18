import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStoredUser,
  saveUser,
  removeUser,
  isValidCellebriteEmail,
  isValidEmailFormat,
  deriveNameFromEmail,
  createUserFromEmail,
  getUserDisplayName,
  getUserFullName,
} from '../userStorage';
import { User } from '../../types/user';

describe('userStorage - localStorage operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveUser and getStoredUser', () => {
    it('should save and retrieve a user from localStorage', () => {
      const user: User = {
        email: 'john.doe@cellebrite.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      saveUser(user);
      const retrieved = getStoredUser();

      expect(retrieved).toEqual(user);
    });

    it('should return null when no user is stored', () => {
      const retrieved = getStoredUser();
      expect(retrieved).toBeNull();
    });

    it('should return null and clear corrupted JSON data', () => {
      localStorage.setItem('six_user', 'invalid json{');
      const retrieved = getStoredUser();

      expect(retrieved).toBeNull();
      expect(localStorage.getItem('six_user')).toBeNull();
    });

    it('should return null and clear incomplete user data', () => {
      const incomplete = { email: 'test@test.com' }; // Missing firstName and lastName
      localStorage.setItem('six_user', JSON.stringify(incomplete));

      const retrieved = getStoredUser();

      expect(retrieved).toBeNull();
      expect(localStorage.getItem('six_user')).toBeNull();
    });

    it('should handle multiple save operations correctly', () => {
      const user1: User = {
        email: 'user1@cellebrite.com',
        firstName: 'User',
        lastName: 'One',
      };

      const user2: User = {
        email: 'user2@cellebrite.com',
        firstName: 'User',
        lastName: 'Two',
      };

      saveUser(user1);
      expect(getStoredUser()).toEqual(user1);

      saveUser(user2);
      expect(getStoredUser()).toEqual(user2);
    });

    it('should persist data across multiple retrieval operations', () => {
      const user: User = {
        email: 'test@cellebrite.com',
        firstName: 'Test',
        lastName: 'User',
      };

      saveUser(user);

      expect(getStoredUser()).toEqual(user);
      expect(getStoredUser()).toEqual(user);
      expect(getStoredUser()).toEqual(user);
    });
  });

  describe('removeUser', () => {
    it('should remove user from localStorage', () => {
      const user: User = {
        email: 'test@cellebrite.com',
        firstName: 'Test',
        lastName: 'User',
      };

      saveUser(user);
      expect(getStoredUser()).toEqual(user);

      removeUser();
      expect(getStoredUser()).toBeNull();
    });

    it('should handle removeUser when no user exists', () => {
      expect(() => removeUser()).not.toThrow();
      expect(getStoredUser()).toBeNull();
    });
  });

  describe('data integrity', () => {
    it('should preserve special characters in names', () => {
      const user: User = {
        email: 'test@cellebrite.com',
        firstName: "O'Brien",
        lastName: 'Smith-Jones',
      };

      saveUser(user);
      const retrieved = getStoredUser();

      expect(retrieved).toEqual(user);
      expect(retrieved?.firstName).toBe("O'Brien");
      expect(retrieved?.lastName).toBe('Smith-Jones');
    });

    it('should preserve unicode characters', () => {
      const user: User = {
        email: 'test@cellebrite.com',
        firstName: 'José',
        lastName: 'Müller',
      };

      saveUser(user);
      const retrieved = getStoredUser();

      expect(retrieved).toEqual(user);
      expect(retrieved?.firstName).toBe('José');
      expect(retrieved?.lastName).toBe('Müller');
    });

    it('should handle empty string values correctly', () => {
      const user: User = {
        email: 'test@cellebrite.com',
        firstName: 'Test',
        lastName: '',
      };

      saveUser(user);
      const retrieved = getStoredUser();

      expect(retrieved).toEqual(user);
      expect(retrieved?.lastName).toBe('');
    });
  });
});

describe('userStorage - email validation', () => {
  describe('isValidCellebriteEmail', () => {
    it('should validate correct Cellebrite email addresses', () => {
      expect(isValidCellebriteEmail('john.doe@cellebrite.com')).toBe(true);
      expect(isValidCellebriteEmail('jane_smith@cellebrite.com')).toBe(true);
      expect(isValidCellebriteEmail('test123@cellebrite.com')).toBe(true);
      expect(isValidCellebriteEmail('user+tag@cellebrite.com')).toBe(true);
    });

    it('should reject invalid Cellebrite email addresses', () => {
      expect(isValidCellebriteEmail('test@gmail.com')).toBe(false);
      expect(isValidCellebriteEmail('test@cellebrite.org')).toBe(false);
      expect(isValidCellebriteEmail('test@cellebrite')).toBe(false);
      expect(isValidCellebriteEmail('cellebrite.com')).toBe(false);
      expect(isValidCellebriteEmail('@cellebrite.com')).toBe(false);
      expect(isValidCellebriteEmail('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidCellebriteEmail('TEST@CELLEBRITE.COM')).toBe(true);
      expect(isValidCellebriteEmail('Test@Cellebrite.Com')).toBe(true);
    });
  });

  describe('isValidEmailFormat', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmailFormat('test@example.com')).toBe(true);
      expect(isValidEmailFormat('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmailFormat('test+tag@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmailFormat('invalid')).toBe(false);
      expect(isValidEmailFormat('@example.com')).toBe(false);
      expect(isValidEmailFormat('test@')).toBe(false);
      expect(isValidEmailFormat('test@example')).toBe(false);
      expect(isValidEmailFormat('')).toBe(false);
    });
  });
});

describe('userStorage - name derivation', () => {
  describe('deriveNameFromEmail', () => {
    it('should derive name from standard format', () => {
      const result = deriveNameFromEmail('john.doe@cellebrite.com');
      expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
    });

    it('should handle underscore separators', () => {
      const result = deriveNameFromEmail('bob_jones@cellebrite.com');
      expect(result).toEqual({ firstName: 'Bob', lastName: 'Jones' });
    });

    it('should handle hyphen separators', () => {
      const result = deriveNameFromEmail('mary-anne@cellebrite.com');
      expect(result).toEqual({ firstName: 'Mary', lastName: 'Anne' });
    });

    it('should handle multiple parts in last name', () => {
      const result = deriveNameFromEmail('jane.smith.jr@cellebrite.com');
      expect(result).toEqual({ firstName: 'Jane', lastName: 'Smith Jr' });
    });

    it('should handle single name', () => {
      const result = deriveNameFromEmail('alice@cellebrite.com');
      expect(result).toEqual({ firstName: 'Alice', lastName: '' });
    });

    it('should capitalize correctly', () => {
      const result = deriveNameFromEmail('JOHN.DOE@cellebrite.com');
      expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
    });
  });

  describe('createUserFromEmail', () => {
    it('should create user from email', () => {
      const user = createUserFromEmail('John.Doe@Cellebrite.Com');
      expect(user).toEqual({
        email: 'john.doe@cellebrite.com',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should normalize email to lowercase', () => {
      const user = createUserFromEmail('TEST@CELLEBRITE.COM');
      expect(user.email).toBe('test@cellebrite.com');
    });
  });

  describe('getUserDisplayName', () => {
    it('should create display name with last initial', () => {
      const user: User = {
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      expect(getUserDisplayName(user)).toBe('John D.');
    });

    it('should handle user without last name', () => {
      const user: User = {
        email: 'test@test.com',
        firstName: 'Alice',
        lastName: '',
      };
      expect(getUserDisplayName(user)).toBe('Alice');
    });
  });

  describe('getUserFullName', () => {
    it('should return full name', () => {
      const user: User = {
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      expect(getUserFullName(user)).toBe('John Doe');
    });

    it('should handle user without last name', () => {
      const user: User = {
        email: 'test@test.com',
        firstName: 'Alice',
        lastName: '',
      };
      expect(getUserFullName(user)).toBe('Alice');
    });
  });
});
