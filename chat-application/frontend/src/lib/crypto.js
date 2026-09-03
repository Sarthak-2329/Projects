/**
 * E2EE Crypto Utilities — Web Crypto API wrapper
 *
 * Scheme: X25519 ECDH key exchange → per-conversation AES-256-GCM symmetric key
 *         → per-message random 12-byte IV.
 *
 * Key storage:
 *   - Private key  → IndexedDB (DB: "e2e-keystore", store: "keys"), scoped per userId.
 *                    Stored as a non-extractable CryptoKey handle — IndexedDB can hold
 *                    CryptoKey objects opaquely without exposing raw bytes.
 *   - Public key   → Sent to the server as base64; also cached in IndexedDB so we can
 *                    compare against the server record without re-generating.
 *
 * Known limitations (documented, not bugs):
 *   - Image messages are NOT encrypted.
 *   - Group messages are NOT encrypted.
 *   - Single-device only: clearing IndexedDB loses access to old messages — expected E2EE behaviour.
 *   - Static per-conversation keys — no forward secrecy / double-ratchet.
 */

const DB_NAME = "e2e-keystore";
const STORE_NAME = "keys";
const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generates an X25519 ECDH keypair.
 * By default the private key is non-extractable for security.
 * @param {boolean} [extractable=false]
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateKeyPair(extractable = false) {
  return crypto.subtle.generateKey(
    { name: "X25519" },
    extractable,
    ["deriveKey"]
  );
}

// ---------------------------------------------------------------------------
// Public key export / import
// ---------------------------------------------------------------------------

/**
 * Exports a public CryptoKey to a base64 string for transmission to the server.
 * Per the WebCrypto spec the public half of any keypair is always exportable.
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>} base64-encoded raw X25519 public key (44 chars)
 */
export async function exportPublicKey(publicKey) {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/**
 * Imports a base64-encoded raw X25519 public key back into a CryptoKey.
 * @param {string} base64
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(base64) {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "X25519" },
    true,
    [] // public keys have no key usages in WebCrypto
  );
}

// ---------------------------------------------------------------------------
// Shared key derivation (ECDH)
// ---------------------------------------------------------------------------

/**
 * Derives a shared AES-256-GCM key from our private X25519 key and the
 * peer's public X25519 key via ECDH. Both sides derive the same symmetric key.
 * @param {CryptoKey} myPrivateKey
 * @param {CryptoKey} theirPublicKey
 * @returns {Promise<CryptoKey>} non-extractable AES-GCM-256 key
 */
export async function deriveSharedKey(myPrivateKey, theirPublicKey) {
  return crypto.subtle.deriveKey(
    { name: "X25519", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false, // derived key is not extractable
    ["encrypt", "decrypt"]
  );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string with AES-256-GCM using a fresh 12-byte random IV.
 * A new IV is generated per-message so IV reuse is impossible.
 * @param {CryptoKey} sharedKey  result of deriveSharedKey()
 * @param {string}    plaintext
 * @returns {Promise<{ ciphertext: string, iv: string }>} both values are base64
 */
export async function encryptMessage(sharedKey, plaintext) {
  const ivBytes   = crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(plaintext);
  const ciphBuf   = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    sharedKey,
    encoded
  );
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { ciphertext: toB64(ciphBuf), iv: toB64(ivBytes) };
}

/**
 * Decrypts a base64 AES-256-GCM ciphertext.
 * Returns null instead of throwing on any failure (wrong key, data corruption,
 * old plaintext-only message that has no ciphertext).
 * @param {CryptoKey} sharedKey
 * @param {string}    ciphertext  base64
 * @param {string}    iv          base64
 * @returns {Promise<string|null>}
 */
export async function decryptMessage(sharedKey, ciphertext, iv) {
  try {
    const fromB64  = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(iv) },
      sharedKey,
      fromB64(ciphertext)
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB key persistence
// ---------------------------------------------------------------------------

/**
 * Persists a private CryptoKey in IndexedDB.
 * IndexedDB stores CryptoKey objects as structured-clone handles —
 * the raw key bytes are never serialised to a string.
 * @param {string}    userId
 * @param {CryptoKey} privateKey
 */
export async function storePrivateKey(userId, privateKey) {
  await idbSet(`privkey:${userId}`, privateKey);
}

/**
 * Loads a private CryptoKey from IndexedDB. Returns null if not found.
 * @param {string} userId
 * @returns {Promise<CryptoKey|null>}
 */
export async function loadPrivateKey(userId) {
  return idbGet(`privkey:${userId}`);
}

/**
 * Caches the base64 public key alongside its private counterpart so we can
 * compare against the server record without re-exporting every time.
 */
export async function storePublicKeyBase64(userId, base64) {
  await idbSet(`pubkey:${userId}`, base64);
}

export async function loadPublicKeyBase64(userId) {
  return idbGet(`pubkey:${userId}`);
}

// ---------------------------------------------------------------------------
// Module-level in-memory cache (avoids IndexedDB round-trips per message)
// ---------------------------------------------------------------------------

let _privateKey = null;

/** Returns the in-memory cached private CryptoKey for the current session. */
export function getMyPrivateKey() {
  return _privateKey;
}

// ---------------------------------------------------------------------------
// High-level: initialise keys for a logged-in user
// ---------------------------------------------------------------------------

/**
 * Loads the existing keypair for `userId` from IndexedDB, or generates a fresh
 * one if none exists. Updates the in-memory cache.
 *
 * Returns:
 *   { privateKey: CryptoKey, publicKeyBase64: string, isNew: boolean }
 *
 * `isNew` is true when a keypair was just generated — the caller should publish
 * the public key to the server.
 *
 * @param {string} userId
 */
export async function loadOrGenerateKeyPair(userId) {
  const existingPriv   = await loadPrivateKey(userId);
  const existingPubB64 = await loadPublicKeyBase64(userId);

  if (existingPriv && existingPubB64) {
    // Already initialised on this device
    _privateKey = existingPriv;
    return { privateKey: existingPriv, publicKeyBase64: existingPubB64, isNew: false };
  }

  // Generate a fresh keypair.
  // The public key of any ECDH keypair is always exportable in WebCrypto regardless
  // of the extractable flag — only the private key respects that flag.
  const keyPair = await crypto.subtle.generateKey(
    { name: "X25519" },
    false, // private key: non-extractable
    ["deriveKey"]
  );

  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

  await storePrivateKey(userId, keyPair.privateKey);
  await storePublicKeyBase64(userId, publicKeyBase64);

  _privateKey = keyPair.privateKey;
  return { privateKey: keyPair.privateKey, publicKeyBase64, isNew: true };
}
