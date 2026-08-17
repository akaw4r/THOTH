import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Encryption at rest: AES-256-GCM.
 *
 * Binary format:  [1 byte version=1][12 bytes IV][16 bytes auth tag][ciphertext]
 * String format:  "enc:v1:<base64 of the binary above>"
 */

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const STRING_PREFIX = 'enc:v1:';

export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex');
  } else {
    key = Buffer.from(trimmed, 'base64');
  }
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -base64 32)');
  }
  return key;
}

export function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  if (payload.length < 1 + IV_LENGTH + TAG_LENGTH || payload[0] !== VERSION) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = payload.subarray(1, 1 + IV_LENGTH);
  const tag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptString(plaintext: string, key: Buffer): string {
  return STRING_PREFIX + encryptBuffer(Buffer.from(plaintext, 'utf8'), key).toString('base64');
}

export function decryptString(payload: string, key: Buffer): string {
  if (!payload.startsWith(STRING_PREFIX)) {
    throw new Error('Invalid encrypted string');
  }
  return decryptBuffer(Buffer.from(payload.slice(STRING_PREFIX.length), 'base64'), key).toString(
    'utf8',
  );
}

export function isEncryptedString(value: string): boolean {
  return value.startsWith(STRING_PREFIX);
}

/** Constant-time string comparison (CSRF tokens, etc.). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
