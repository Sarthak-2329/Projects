/**
 * Unit tests for frontend/src/lib/crypto.js
 *
 * Uses Vitest with happy-dom which provides a complete SubtleCrypto implementation.
 * Run with: cd frontend && npx vitest run src/lib/crypto.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  loadOrGenerateKeyPair,
  getMyPrivateKey,
} from './crypto.js';

// ---------------------------------------------------------------------------
// In-memory IndexedDB mock for Node.js test environment
// ---------------------------------------------------------------------------
if (typeof globalThis.indexedDB === 'undefined') {
  const memoryStores = new Map();
  globalThis.indexedDB = {
    open: (name) => {
      if (!memoryStores.has(name)) memoryStores.set(name, new Map());
      const storeMap = memoryStores.get(name);
      const db = {
        createObjectStore: () => {},
        transaction: () => ({
          objectStore: () => ({
            get: (k) => {
              const req = { result: storeMap.get(k) ?? null };
              setTimeout(() => req.onsuccess?.({ target: req }), 0);
              return req;
            },
            put: (v, k) => {
              storeMap.set(k, v);
              const req = {};
              setTimeout(() => req.onsuccess?.({ target: req }), 0);
              return req;
            },
          }),
        }),
      };
      const req = { result: db };
      setTimeout(() => {
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      }, 0);
      return req;
    },
  };
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

describe('generateKeyPair', () => {
  it('returns a CryptoKeyPair with privateKey and publicKey', async () => {
    const kp = await generateKeyPair();
    expect(kp).toHaveProperty('privateKey');
    expect(kp).toHaveProperty('publicKey');
    expect(kp.privateKey.type).toBe('private');
    expect(kp.publicKey.type).toBe('public');
    expect(kp.privateKey.algorithm.name).toBe('X25519');
  });

  it('private key is non-extractable', async () => {
    const kp = await generateKeyPair();
    expect(kp.privateKey.extractable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Public key export / import round-trip
// ---------------------------------------------------------------------------

describe('exportPublicKey / importPublicKey', () => {
  it('round-trips a public key to base64 and back', async () => {
    const kp      = await generateKeyPair();
    const b64     = await exportPublicKey(kp.publicKey);

    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);

    const imported = await importPublicKey(b64);
    expect(imported.type).toBe('public');
    expect(imported.algorithm.name).toBe('X25519');

    // The re-exported bytes should be identical
    const b64Again = await exportPublicKey(imported);
    expect(b64Again).toBe(b64);
  });
});

// ---------------------------------------------------------------------------
// Encrypt / Decrypt round-trip
// ---------------------------------------------------------------------------

describe('encryptMessage / decryptMessage', () => {
  let sharedKey;

  beforeAll(async () => {
    // Simulate Alice and Bob deriving the same shared key
    const alice = await generateKeyPair();
    const bob   = await generateKeyPair();

    const alicePubB64 = await exportPublicKey(alice.publicKey);
    const bobPubB64   = await exportPublicKey(bob.publicKey);

    const alicePub = await importPublicKey(alicePubB64);
    const bobPub   = await importPublicKey(bobPubB64);

    // Both sides derive a symmetric key; they must be equivalent
    sharedKey = await deriveSharedKey(alice.privateKey, bobPub);

    // Verify bob's side derives the same key (by testing encrypt/decrypt)
    const bobShared = await deriveSharedKey(bob.privateKey, alicePub);

    // Smoke-test both are functional for encrypt/decrypt
    const { ciphertext, iv } = await encryptMessage(sharedKey, 'test');
    const plain = await decryptMessage(bobShared, ciphertext, iv);
    expect(plain).toBe('test'); // proves both keys are equivalent
  });

  it('encrypts and decrypts a message round-trip', async () => {
    const plaintext           = 'Hello, E2EE world! 🔒';
    const { ciphertext, iv } = await encryptMessage(sharedKey, plaintext);

    expect(typeof ciphertext).toBe('string');
    expect(typeof iv).toBe('string');
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await decryptMessage(sharedKey, ciphertext, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('produces a unique IV on every encrypt call', async () => {
    const r1 = await encryptMessage(sharedKey, 'hello');
    const r2 = await encryptMessage(sharedKey, 'hello');
    expect(r1.iv).not.toBe(r2.iv);
  });

  it('returns null when decrypting with the wrong shared key', async () => {
    const wrongPair  = await generateKeyPair();
    const wrongPub   = await importPublicKey(await exportPublicKey(wrongPair.publicKey));
    // Derive a DIFFERENT key pair to create a mismatched shared key
    const otherPair  = await generateKeyPair();
    const wrongShared = await deriveSharedKey(otherPair.privateKey, wrongPub);

    const { ciphertext, iv } = await encryptMessage(sharedKey, 'secret');
    const result = await decryptMessage(wrongShared, ciphertext, iv);
    expect(result).toBeNull();
  });

  it('returns null for tampered ciphertext', async () => {
    const { ciphertext, iv } = await encryptMessage(sharedKey, 'safe message');
    // Flip a character to tamper
    const tampered = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'A' ? 'B' : 'A');
    const result = await decryptMessage(sharedKey, tampered, iv);
    expect(result).toBeNull();
  });

  it('handles unicode / emoji in plaintext correctly', async () => {
    const emoji = '🔒 こんにちは 안녕하세요';
    const { ciphertext, iv } = await encryptMessage(sharedKey, emoji);
    const decrypted = await decryptMessage(sharedKey, ciphertext, iv);
    expect(decrypted).toBe(emoji);
  });
});

// ---------------------------------------------------------------------------
// loadOrGenerateKeyPair
// ---------------------------------------------------------------------------

describe('loadOrGenerateKeyPair', () => {
  const testUserId = `test-user-${Date.now()}`;

  it('generates a fresh keypair and sets isNew=true on first call', async () => {
    const result = await loadOrGenerateKeyPair(testUserId);
    expect(result.isNew).toBe(true);
    expect(typeof result.publicKeyBase64).toBe('string');
    expect(result.publicKeyBase64.length).toBeGreaterThan(0);
    expect(result.privateKey).toBeDefined();
  });

  it('loads the same key on the second call (isNew=false)', async () => {
    const first  = await loadOrGenerateKeyPair(testUserId);
    const second = await loadOrGenerateKeyPair(testUserId);
    expect(second.isNew).toBe(false);
    expect(second.publicKeyBase64).toBe(first.publicKeyBase64);
  });

  it('populates the in-memory cache so getMyPrivateKey() returns a CryptoKey', async () => {
    await loadOrGenerateKeyPair(testUserId);
    const key = getMyPrivateKey();
    expect(key).not.toBeNull();
    expect(key.type).toBe('private');
  });
});
