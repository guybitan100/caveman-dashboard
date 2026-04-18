/**
 * User object structure for Titan authentication
 */
export interface User {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Storage key for user data in localStorage
 */
export const USER_STORAGE_KEY = "titan_user";
