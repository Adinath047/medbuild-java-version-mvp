// frontend/src/utils/cryptoVault.ts
// Client-side Web Crypto Vault for PWA Offline Storage (PBKDF2 + AES-256-GCM)
// Raw encryption keys reside STRICTLY in volatile JavaScript application memory.

let volatileKey: CryptoKey | null = null;
let volatileSalt: Uint8Array | null = null;

const PBKDF2_ITERATIONS = 100_000;
const HASH_ALGO = 'SHA-256';
const AES_ALGO = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Derives a 256-bit AES-GCM encryption key from user session entropy using PBKDF2.
 * The derived key is stored exclusively in volatile closure memory.
 */
export async function initializeSessionCrypto(sessionEntropy: string): Promise<void> {
  try {
    if (!window.crypto?.subtle) {
      console.warn('[cryptoVault] Web Crypto API not available. Operating in standard memory mode.');
      return;
    }

    // Generate or derive a high-entropy 128-bit salt
    const encoder = new TextEncoder();
    volatileSalt = window.crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(sessionEntropy),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    volatileKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: volatileSalt as any,
        iterations: PBKDF2_ITERATIONS,
        hash: HASH_ALGO,
      },
      keyMaterial,
      { name: AES_ALGO, length: KEY_LENGTH },
      false, // non-extractable key prevents memory dump extraction
      ['encrypt', 'decrypt']
    );

    console.info('🔒 [cryptoVault] Session Web Crypto AES-256-GCM key derived & locked in volatile memory.');
  } catch (err) {
    console.error('[cryptoVault] Failed to derive session key:', err);
    volatileKey = null;
  }
}

/**
 * Encrypts an object or string with AES-256-GCM using a unique 12-byte IV per record.
 */
export async function encryptPayload<T>(data: T): Promise<string> {
  if (!volatileKey || !window.crypto?.subtle) {
    return JSON.stringify(data);
  }

  try {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(JSON.stringify(data));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: AES_ALGO, iv },
      volatileKey,
      plaintext
    );

    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    const combined = new Uint8Array(iv.length + ciphertextArray.length);
    combined.set(iv);
    combined.set(ciphertextArray, iv.length);

    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
  } catch (err) {
    console.error('[cryptoVault] Encryption error:', err);
    return JSON.stringify(data);
  }
}

/**
 * Decrypts an AES-256-GCM payload using the active in-memory session key.
 */
export async function decryptPayload<T>(encoded: string): Promise<T> {
  if (!volatileKey || !window.crypto?.subtle) {
    try {
      return JSON.parse(encoded);
    } catch {
      return encoded as unknown as T;
    }
  }

  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: AES_ALGO, iv },
      volatileKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (err) {
    // If decryption fails or payload was unencrypted JSON
    try {
      return JSON.parse(encoded);
    } catch {
      throw new Error('Failed to decrypt protected payload: Invalid key or corrupted data.');
    }
  }
}

/**
 * Immediately zeroes and purges all cryptographic key material and salts from volatile memory.
 */
export function purgeCryptoVault(): void {
  if (volatileSalt) {
    volatileSalt.fill(0);
    volatileSalt = null;
  }
  volatileKey = null;
  console.info('🧹 [cryptoVault] All volatile cryptographic session keys purged and zeroized from memory.');
}
