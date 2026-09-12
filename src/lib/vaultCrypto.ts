/**
 * DivideIt Vault — end-to-end encryption for group service credentials.
 *
 * Model
 *  - Each user owns an ECDH P-256 key pair (Web Crypto, no external libs).
 *  - Each group owns a random AES-256-GCM "VaultKey" that encrypts the credentials.
 *  - The VaultKey is wrapped once per member using ECDH(ephemeral, recipient public).
 *  - The private key is wrapped with a PBKDF2 key derived from a recovery code
 *    (and optionally from the account password) before it ever leaves the browser.
 *
 * The server only ever stores opaque base64 strings.
 */

const KDF_ITERATIONS = 310_000;
const IDB_NAME = "divideit-vault";
const IDB_STORE = "keys";

// ---------------------------------------------------------------- encoding
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(iv: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  return out;
}

function split(buf: Uint8Array): { iv: Uint8Array; data: Uint8Array } {
  return { iv: buf.subarray(0, 12), data: buf.subarray(12) };
}

// ---------------------------------------------------------------- recovery code
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += ALPHABET[bytes[i] % ALPHABET.length];
  return raw.match(/.{1,6}/g)!.join("-"); // XXXXXX-XXXXXX-XXXXXX-XXXXXX
}

export function normalizeSecret(secret: string): string {
  return secret.trim().replace(/\s+/g, "");
}

// ---------------------------------------------------------------- PBKDF2
async function deriveKek(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(normalizeSecret(secret)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------- key pair
export interface WrappedPrivate {
  wrapped: string; // base64(iv|ciphertext)
  salt: string; // base64
  iterations: number;
}

export interface GeneratedIdentity {
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey; // non-extractable clone for local use
  pkcs8: ArrayBuffer; // raw material, used to build extra wraps
}

export async function generateIdentity(): Promise<GeneratedIdentity> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicKeyJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const privateKey = await importPrivateKey(pkcs8);
  return { publicKeyJwk, privateKey, pkcs8 };
}

async function importPrivateKey(pkcs8: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8 as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false, // non-extractable once it lives in the browser
    ["deriveKey"],
  );
}

export async function wrapPrivateKey(pkcs8: ArrayBuffer, secret: string): Promise<WrappedPrivate> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKek(secret, salt, KDF_ITERATIONS);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, kek, pkcs8),
  );
  return { wrapped: toB64(concat(iv, ct)), salt: toB64(salt), iterations: KDF_ITERATIONS };
}

export async function unwrapPrivateKey(w: WrappedPrivate, secret: string): Promise<CryptoKey> {
  const kek = await deriveKek(secret, fromB64(w.salt), w.iterations || KDF_ITERATIONS);
  const { iv, data } = split(fromB64(w.wrapped));
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, kek, data as BufferSource);
  return importPrivateKey(pkcs8);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

// ---------------------------------------------------------------- vault key
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

export async function encryptWithVaultKey(vaultKey: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, vaultKey, enc.encode(plaintext)),
  );
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

export async function decryptWithVaultKey(vaultKey: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(payload.iv) as BufferSource },
    vaultKey,
    fromB64(payload.ciphertext) as BufferSource,
  );
  return dec.decode(plain);
}

// ---------------------------------------------------------------- ECDH wrapping
export interface WrappedVaultKey {
  wrapped: string; // base64(iv|ciphertext)
  ephemeralPublicJwk: JsonWebKey;
}

async function ecdhSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Wrap the vault key for a recipient using an ephemeral ECDH key pair. */
export async function wrapVaultKeyFor(recipientPublicJwk: JsonWebKey, vaultKey: CryptoKey): Promise<WrappedVaultKey> {
  const recipient = await importPublicKey(recipientPublicJwk);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const kek = await ecdhSecret(ephemeral.privateKey, recipient);
  const raw = await crypto.subtle.exportKey("raw", vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, kek, raw));
  return {
    wrapped: toB64(concat(iv, ct)),
    ephemeralPublicJwk: (await crypto.subtle.exportKey("jwk", ephemeral.publicKey)) as JsonWebKey,
  };
}

/** Unwrap a vault key addressed to us with our private key. */
export async function unwrapVaultKey(privateKey: CryptoKey, w: WrappedVaultKey): Promise<CryptoKey> {
  const ephemeral = await importPublicKey(w.ephemeralPublicJwk);
  const kek = await ecdhSecret(privateKey, ephemeral);
  const { iv, data } = split(fromB64(w.wrapped));
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, kek, data as BufferSource);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------- IndexedDB
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const out = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result ?? null) as T | null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const privKeyId = (userId: string) => `private-key:${userId}`;

export async function cachePrivateKey(userId: string, key: CryptoKey): Promise<void> {
  try {
    await idbSet(privKeyId(userId), key);
  } catch {
    /* private browsing: the key simply won't persist */
  }
}

export async function loadCachedPrivateKey(userId: string): Promise<CryptoKey | null> {
  try {
    return await idbGet<CryptoKey>(privKeyId(userId));
  } catch {
    return null;
  }
}

export async function forgetPrivateKey(userId: string): Promise<void> {
  try {
    await idbDelete(privKeyId(userId));
  } catch {
    /* ignore */
  }
}

export const isVaultSupported = () =>
  typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
