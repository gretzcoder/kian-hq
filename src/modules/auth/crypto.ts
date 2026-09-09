/**
 * Cryptographic helpers for password hashing and salting.
 * Uses native Web Crypto API, fully compatible with Cloudflare Workers/Pages.
 */

/**
 * Generates a random salt string.
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a password using SHA-256 combined with a unique salt.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'kian-hq-stateless-session-secret-key-2026';

let cachedHmacKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (cachedHmacKey) return cachedHmacKey;
  const encoder = new TextEncoder();
  cachedHmacKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return cachedHmacKey;
}

function toBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 * Stateless, fast (0ms D1/KV overhead), and immune to Cloudflare KV write limits.
 */
export async function createSignedSessionToken(payload: any): Promise<string> {
  const encoder = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = toBase64Url(encoder.encode(jsonStr));
  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  const signatureBase64 = toBase64Url(new Uint8Array(signatureBuffer));
  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session token.
 * Returns the decoded payload if valid and untampered, or null otherwise.
 */
export async function verifySignedSessionToken<T = any>(token: string): Promise<T | null> {
  try {
    if (!token || !token.includes('.')) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, signatureBase64] = parts;
    if (!payloadBase64 || !signatureBase64) return null;

    const key = await getHmacKey();
    const encoder = new TextEncoder();
    const signatureBytes = fromBase64Url(signatureBase64);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      encoder.encode(payloadBase64)
    );

    if (!isValid) return null;

    const payloadBytes = fromBase64Url(payloadBase64);
    const jsonStr = new TextDecoder().decode(payloadBytes);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    return null;
  }
}

