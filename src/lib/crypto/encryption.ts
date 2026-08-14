import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const TAG_LENGTH = 16; // Standard 128 bits tag
const DEFAULT_KEY_VERSION = 1;

/**
 * Derives a 32-byte encryption key from the environment secret.
 * Falls back to a deterministic development key if not configured.
 */
function getKeyBuffer(keyHexOrSecret?: string): Buffer {
  const secret = keyHexOrSecret || process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || 'brikdrive_default_insecure_development_secret_key_32bytes!';
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM envelope format:
 * `v<version>:<hex_iv>:<hex_tag>:<hex_ciphertext>`
 */
export function encryptString(plaintext: string, keySecret?: string, version = DEFAULT_KEY_VERSION): string {
  const key = getKeyBuffer(keySecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `v${version}:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts a string encrypted with encryptString
 */
export function decryptString(payload: string, keySecret?: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format');
  }

  const [versionStr, ivHex, tagHex, ciphertextHex] = parts;
  const version = parseInt(versionStr.replace('v', ''), 10);
  if (isNaN(version) || version < 1) {
    throw new Error(`Unsupported token key version: ${versionStr}`);
  }

  const key = getKeyBuffer(keySecret);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Computes a SHA-256 hash of a public share token.
 * Tokens are never stored in raw form in the database.
 */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generates a high-entropy URL-safe random token.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Timing-safe string comparison to prevent timing attacks on token hashes.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
