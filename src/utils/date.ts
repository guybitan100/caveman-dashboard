type DateInput = string | Date | null | undefined;

/**
 * Format options for different use cases.
 */
const DATE_FORMATS = {
  /** Short date: "Jan 15, 2024" */
  short: {
    month: "short" as const,
    day: "numeric" as const,
    year: "numeric" as const,
  },
  /** Long date with time: "Jan 15, 2024, 2:30 PM" */
  full: {
    month: "short" as const,
    day: "numeric" as const,
    year: "numeric" as const,
    hour: "numeric" as const,
    minute: "2-digit" as const,
  },
  /** Time only: "2:30 PM" */
  time: {
    hour: "numeric" as const,
    minute: "2-digit" as const,
  },
  /** Compact date-time: "Jan 15, 2:30 PM" */
  compact: {
    month: "short" as const,
    day: "numeric" as const,
    hour: "2-digit" as const,
    minute: "2-digit" as const,
  },
};

/**
 * Formats a timestamp for display.
 * Includes date and time in a compact format.
 *
 * @example
 * formatTimestamp("2024-01-15T14:30:00Z") // "Jan 15, 02:30 PM"
 */
export function formatTimestamp(timestamp: DateInput, fallback = ""): string {
  if (!timestamp) return fallback;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleString("en-US", DATE_FORMATS.compact);
  } catch {
    return typeof timestamp === "string" ? timestamp : fallback;
  }
}

/**
 * Formats a date for display (no time).
 *
 * @example
 * formatDate("2024-01-15") // "Jan 15, 2024"
 */
export function formatDate(dateStr: DateInput, fallback = "N/A"): string {
  if (!dateStr) return fallback;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString("en-US", DATE_FORMATS.short);
  } catch {
    return typeof dateStr === "string" ? dateStr : fallback;
  }
}

/**
 * Formats a date with full timestamp (date and time).
 *
 * @example
 * formatFullTimestamp("2024-01-15T14:30:00Z") // "Jan 15, 2024, 2:30 PM"
 */
export function formatFullTimestamp(
  timestamp: DateInput,
  fallback = ""
): string {
  if (!timestamp) return fallback;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleString("en-US", DATE_FORMATS.full);
  } catch {
    return typeof timestamp === "string" ? timestamp : fallback;
  }
}

/**
 * Formats a time for display (hour and minute only).
 *
 * @example
 * formatTime("2024-01-15T14:30:00Z") // "2:30 PM"
 */
export function formatTime(timestamp: DateInput, fallback = ""): string {
  if (!timestamp) return fallback;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleTimeString("en-US", DATE_FORMATS.time);
  } catch {
    return fallback;
  }
}

/**
 * Formats a date range for display.
 *
 * @example
 * formatDateRange("2024-01-15", "2024-01-20") // "Jan 15, 2024 – Jan 20, 2024"
 * formatDateRange(null, null) // "Not set"
 */
export function formatDateRange(
  start: DateInput,
  end: DateInput,
  fallback = "Not set"
): string {
  if (!start || !end) return fallback;

  const startFormatted = formatDate(start, "");
  const endFormatted = formatDate(end, "");

  if (!startFormatted || !endFormatted) return fallback;

  return `${startFormatted} – ${endFormatted}`;
}
