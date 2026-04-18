/**
 * User object structure for SiX authentication
 */
export interface User {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Storage key for user data in localStorage
 */
export const USER_STORAGE_KEY = "six_user";
