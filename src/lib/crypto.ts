const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const PIN_ITERATIONS = 120_000;
const VERIFIER = 'folio-ok';

export class PinError extends Error {
  constructor(
    message: string,
    readonly code: 'locked' | 'invalid' | 'empty',
  ) {
    super(message);
    this.name = 'PinError';
  }
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function derivePinKey(pin: string, salt: Uint8Array, iterations = PIN_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function importAes(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const encoded = encoder.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoded);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipher)) };
}

export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(iv)) },
    key,
    toArrayBuffer(base64ToBytes(ciphertext)),
  );
  return JSON.parse(decoder.decode(plain)) as T;
}

export async function encryptBytes(key: CryptoKey, value: Uint8Array): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(value));
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipher)) };
}

export async function decryptBytes(key: CryptoKey, iv: string, ciphertext: string): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(iv)) },
    key,
    toArrayBuffer(base64ToBytes(ciphertext)),
  );
  return new Uint8Array(plain);
}

export async function createVerifier(key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  return encryptJson(key, VERIFIER);
}

export async function matchesVerifier(key: CryptoKey, iv: string, ciphertext: string): Promise<boolean> {
  try {
    const value = await decryptJson<string>(key, iv, ciphertext);
    return value === VERIFIER;
  } catch {
    return false;
  }
}
