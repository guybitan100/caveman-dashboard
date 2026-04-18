import { Entity } from "../types/cart";

/**
 * Entity-like type for functions that work with partial entity data.
 * Useful for form data that doesn't have all entity fields.
 */
interface EntityLike {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  uid?: string;
}

/**
 * Generates a display name for an entity.
 * Falls back to phone, email, or uid if no name is available.
 *
 * @example
 * getEntityDisplayName({ first_name: 'John', last_name: 'Doe' }) // 'John Doe'
 * getEntityDisplayName({ phone: '+1234567890' }) // '+1234567890'
 * getEntityDisplayName({}) // 'Unknown'
 */
export function getEntityDisplayName(entity: EntityLike | Entity): string {
  if (entity.first_name || entity.last_name) {
    return [entity.first_name, entity.last_name].filter(Boolean).join(" ");
  }
  return entity.phone || entity.email || entity.uid || "Unknown";
}

/**
 * Generates initials for an entity avatar.
 * Uses first letters of first and last name, or single letter if only one name.
 *
 * @example
 * getEntityInitials({ first_name: 'John', last_name: 'Doe' }) // 'JD'
 * getEntityInitials({ first_name: 'John' }) // 'J'
 * getEntityInitials({}) // '?'
 */
export function getEntityInitials(entity: EntityLike | Entity): string {
  if (entity.first_name && entity.last_name) {
    return `${entity.first_name[0]}${entity.last_name[0]}`.toUpperCase();
  }
  if (entity.first_name) {
    return entity.first_name[0].toUpperCase();
  }
  if (entity.last_name) {
    return entity.last_name[0].toUpperCase();
  }
  return "?";
}
