/**
 * Security utilities for the WhatsApp Campaign App
 * --------------------------------------------------
 * Centralised module providing input sanitisation, file validation,
 * webhook URL hardening, rate-limiting, and encrypted localStorage.
 */

// ── Input Sanitisation ────────────────────────────────────────────

/**
 * Strips HTML tags and dangerous characters from user input.
 * Keeps the text content intact — only removes potential script vectors.
 */
export function sanitizeInput(raw: string): string {
  if (!raw) return '';

  return raw
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: protocol patterns
    .replace(/javascript\s*:/gi, '')
    // Remove on* event handlers (onerror, onclick, etc.)
    .replace(/\bon\w+\s*=/gi, '')
    // Trim control characters (except newlines for multiline messages)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitises a cell value from an uploaded file.
 * Prevents CSV formula injection (DDE attacks) where cells starting with
 * =, +, -, @, \t, \r can trigger formulas in spreadsheet apps.
 */
export function sanitizeCellValue(value: string): string {
  if (!value) return '';

  const dangerous = ['=', '+', '-', '@', '\t', '\r', '|'];
  let cleaned = value.trim();

  // If the cell starts with a dangerous character, prefix with a single quote
  if (dangerous.some(ch => cleaned.startsWith(ch))) {
    cleaned = "'" + cleaned;
  }

  return cleaned;
}

// ── Webhook URL Validation ────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a webhook URL — only HTTPS to public endpoints is allowed.
 */
export function validateWebhookUrl(url: string): UrlValidationResult {
  if (!url.trim()) return { valid: true }; // empty is ok (user hasn't configured yet)

  // Must start with https://
  if (!url.startsWith('https://')) {
    return { valid: false, error: 'Only HTTPS URLs are allowed. Please use https:// for security.' };
  }

  // Block private / loopback IPs
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(url)) {
      return { valid: false, error: 'Private / localhost URLs are not allowed for security reasons.' };
    }
  }

  // Basic URL format check
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'This does not appear to be a valid URL.' };
  }

  return { valid: true };
}

// ── File Upload Validation ────────────────────────────────────────

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_ROW_COUNT = 50_000;

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers send this for .csv
  '',                          // some browsers don't set MIME at all
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  const name = file.name.toLowerCase();

  // Extension check
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!hasValidExt) {
    return { valid: false, error: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(', ')} files are accepted.` };
  }

  // MIME type check (lenient because browsers are inconsistent)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Suspicious file type detected (${file.type}). Please upload a genuine CSV or Excel file.` };
  }

  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.` };
  }

  // Empty file check
  if (file.size === 0) {
    return { valid: false, error: 'The file is empty.' };
  }

  return { valid: true };
}

export function validateRowCount(rowCount: number): FileValidationResult {
  if (rowCount > MAX_ROW_COUNT) {
    return {
      valid: false,
      error: `File has ${rowCount.toLocaleString()} rows which exceeds the ${MAX_ROW_COUNT.toLocaleString()} row limit. Please split the file into smaller batches.`,
    };
  }
  return { valid: true };
}

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Validates an image file chosen for campaign dispatch attachment.
 */
export function validateImageFile(file: File): FileValidationResult {
  if (file.size === 0) return { valid: false, error: 'The image file is empty.' };

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMAGE_SIZE_MB} MB.`,
    };
  }

  const name = file.name.toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!hasValidExt) {
    return { valid: false, error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}.` };
  }

  if (file.type && !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Suspicious file type (${file.type}). Please upload a real image.` };
  }

  return { valid: true };
}

// ── Rate Limiting ─────────────────────────────────────────────────

const rateLimitMap = new Map<string, number>();

/**
 * Returns true if the action is currently rate-limited.
 * Default cooldown is 30 seconds.
 */
export function isRateLimited(key: string, cooldownMs: number = 30_000): { limited: boolean; remainingSeconds: number } {
  const now = Date.now();
  const lastAction = rateLimitMap.get(key) ?? 0;
  const elapsed = now - lastAction;

  if (elapsed < cooldownMs) {
    return { limited: true, remainingSeconds: Math.ceil((cooldownMs - elapsed) / 1000) };
  }

  return { limited: false, remainingSeconds: 0 };
}

/** Mark an action as just performed, starting the cooldown. */
export function markAction(key: string) {
  rateLimitMap.set(key, Date.now());
}

// ── Secure Storage Wrapper ────────────────────────────────────────

const STORAGE_PREFIX = '__sc_'; // prefix to namespace our keys

/**
 * Unicode-safe Base64 encode.
 * btoa() only handles Latin1. By first running encodeURIComponent (which
 * percent-encodes high codepoints into Latin1-safe byte sequences) and
 * then encoding that with btoa, we support the full Unicode range.
 */
function toBase64(str: string): string {
  return btoa(encodeURIComponent(str));
}

/**
 * Unicode-safe Base64 decode — inverse of toBase64.
 */
function fromBase64(b64: string): string {
  return decodeURIComponent(atob(b64));
}

/**
 * Simple obfuscation layer over localStorage.
 * Uses Unicode-safe Base64 encoding + key prefixing so that data isn't in
 * readable plain text. This is NOT encryption — it's a deterrent against
 * casual snooping via DevTools or browser extensions.
 *
 * For true encryption you'd need a server-side key management approach
 * which is out of scope for a client-side SPA.
 */
export const secureStorage = {
  getItem(key: string): string | null {
    // Try reading the encoded version first
    const encoded = localStorage.getItem(STORAGE_PREFIX + key);
    if (encoded !== null) {
      try {
        return fromBase64(encoded);
      } catch {
        // Stored value isn't valid Base64 — return as-is (shouldn't happen)
        return encoded;
      }
    }

    // Backward compat: read unencoded legacy data and migrate it
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      // Migrate: write encoded version, remove raw version
      secureStorage.setItem(key, legacy);
      localStorage.removeItem(key);
      return legacy;
    }

    return null;
  },

  setItem(key: string, value: string): void {
    localStorage.setItem(STORAGE_PREFIX + key, toBase64(value));
  },

  removeItem(key: string): void {
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(key); // also remove any legacy key
  },
};
