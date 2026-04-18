import { User, USER_STORAGE_KEY } from "../types/user";

/**
 * Check for existing user in localStorage
 */
export function getStoredUser(): User | null {
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    // Validate that the parsed object has the required fields
    if (
      typeof parsed.email === "string" &&
      typeof parsed.firstName === "string" &&
      typeof parsed.lastName === "string"
    ) {
      return parsed as User;
    }
    // Corrupted data - clear it
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  } catch {
    // Corrupted data - clear it
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

/**
 * Save user to localStorage
 */
export function saveUser(user: User): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Remove user from localStorage (logout)
 */
export function removeUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Validate that an email is a valid Cellebrite email address
 */
export function isValidCellebriteEmail(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@cellebrite\.com$/i;
  return pattern.test(email);
}

/**
 * Validate basic email format
 */
export function isValidEmailFormat(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  return pattern.test(email);
}

/**
 * Derive first name and last name from a Cellebrite email address
 *
 * Examples:
 * - "john.doe@cellebrite.com" → { firstName: "John", lastName: "Doe" }
 * - "jane.smith.jr@cellebrite.com" → { firstName: "Jane", lastName: "Smith Jr" }
 * - "bob_jones@cellebrite.com" → { firstName: "Bob", lastName: "Jones" }
 * - "alice@cellebrite.com" → { firstName: "Alice", lastName: "" }
 */
export function deriveNameFromEmail(email: string): {
  firstName: string;
  lastName: string;
} {
  const localPart = email.split("@")[0]; // "john.doe"
  const parts = localPart.split(/[._-]/); // ["john", "doe"]

  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  if (parts.length === 1) {
    // Single name: "john@cellebrite.com" → John (no last name)
    return {
      firstName: capitalize(parts[0]),
      lastName: "",
    };
  }

  // Multiple parts: first is firstName, rest joined as lastName
  return {
    firstName: capitalize(parts[0]),
    lastName: parts.slice(1).map(capitalize).join(" "),
  };
}

/**
 * Create a User object from a valid Cellebrite email
 */
export function createUserFromEmail(email: string): User {
  const { firstName, lastName } = deriveNameFromEmail(email);
  return {
    email: email.toLowerCase(),
    firstName,
    lastName,
  };
}

/**
 * Get display name for user (e.g., "John D." or "John")
 */
export function getUserDisplayName(user: User): string {
  if (user.lastName) {
    return `${user.firstName} ${user.lastName.charAt(0)}.`;
  }
  return user.firstName;
}

/**
 * Get full name for user
 */
export function getUserFullName(user: User): string {
  if (user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.firstName;
}
