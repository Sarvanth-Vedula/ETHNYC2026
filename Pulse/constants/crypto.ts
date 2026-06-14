// Client-side encryption for health data BEFORE it leaves the device.
//
// Why this exists: a Walrus blob ID is PUBLIC. Anyone who learns the blob ID
// can fetch the raw bytes from any aggregator — there is no access control at
// the storage layer. So we must never upload plaintext health data. Each daily
// bundle is encrypted with a fresh AES-256-GCM data key; only the ciphertext is
// uploaded. The key + nonce stay on the device (in the local blob index), so a
// public blob ID reveals nothing but encrypted noise.
//
// Pure-JS (Hermes-safe) via @noble/ciphers — no native module, no WASM.
// Randomness comes from crypto.getRandomValues, which is polyfilled on-device
// by react-native-get-random-values (imported first in index.ts) and is native
// in Node 20+ for our test scripts.

import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export interface EncryptedPayload {
  ciphertext: Uint8Array; // uploaded to Walrus — safe to be public
  keyHex: string;         // AES-256 key, hex — stays on device, never uploaded
  nonceHex: string;       // 96-bit GCM nonce, hex — stored alongside the record
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// Encrypt a UTF-8 string (e.g. a FHIR R4 JSON bundle) under a fresh random key.
export function encryptString(plaintext: string): EncryptedPayload {
  const key = randomBytes(32); // AES-256
  const nonce = randomBytes(12); // 96-bit nonce, the GCM standard size
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return { ciphertext, keyHex: bytesToHex(key), nonceHex: bytesToHex(nonce) };
}

// Decrypt ciphertext fetched from Walrus using the locally-held key + nonce.
// Throws if the key/nonce are wrong or the data was tampered with (GCM auth tag).
export function decryptString(
  ciphertext: Uint8Array,
  keyHex: string,
  nonceHex: string,
): string {
  const plaintext = gcm(hexToBytes(keyHex), hexToBytes(nonceHex)).decrypt(ciphertext);
  return bytesToUtf8(plaintext);
}

// ───────────────────────────────────────────────────────────────────────────
// Recipient encryption — "how can the insurer decrypt?"
//
// The above symmetric scheme only lets the device decrypt its own data. To let
// a SPECIFIC third party (an insurer) decrypt, we encrypt TO their PUBLIC key.
// Only the holder of the matching PRIVATE key can open it. The private key is
// NEVER uploaded or embedded — that would defeat the whole point. The patient
// shares only the insurer-encrypted summary; the insurer needs nothing but the
// public blob ID + their own private key.
//
// Scheme (libsodium "sealed box" style, all @noble, pure-JS / Hermes-safe):
//   ephemeral X25519 keypair  →  ECDH shared secret with recipient pubkey
//   →  HKDF-SHA256  →  AES-256-GCM. The envelope is self-contained and safe to
//   store publicly on Walrus.

const KDF_INFO = utf8ToBytes('pulse/x25519-hkdf-sha256/aes256gcm/v1');

export interface SealedEnvelope {
  v: 1;
  alg: 'x25519-hkdf-sha256+aes256gcm';
  epk: string;   // ephemeral public key (hex)
  nonce: string; // AES-GCM nonce (hex)
  ct: string;    // ciphertext (hex)
}

export interface KeyPair {
  publicKeyHex: string;
  secretKeyHex: string;
}

// Generate an X25519 keypair (e.g. the insurer's identity key).
export function generateKeyPair(): KeyPair {
  const secret = x25519.utils.randomPrivateKey();
  return {
    publicKeyHex: bytesToHex(x25519.getPublicKey(secret)),
    secretKeyHex: bytesToHex(secret),
  };
}

function deriveSharedKey(secret: Uint8Array, peerPublic: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(secret, peerPublic);
  return hkdf(sha256, shared, undefined, KDF_INFO, 32);
}

// Encrypt a string so that ONLY the holder of `recipientPublicKeyHex`'s private
// key can read it. Returns a self-contained envelope safe to publish on Walrus.
export function encryptForRecipient(
  plaintext: string,
  recipientPublicKeyHex: string,
): SealedEnvelope {
  const ephemeralSecret = x25519.utils.randomPrivateKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const key = deriveSharedKey(ephemeralSecret, hexToBytes(recipientPublicKeyHex));

  const nonce = randomBytes(12);
  const ct = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return {
    v: 1,
    alg: 'x25519-hkdf-sha256+aes256gcm',
    epk: bytesToHex(ephemeralPublic),
    nonce: bytesToHex(nonce),
    ct: bytesToHex(ct),
  };
}

// Insurer side: open an envelope with the recipient's private key. Needs nothing
// but the envelope (fetched from Walrus by blob ID) and the private key.
export function decryptAsRecipient(
  envelope: SealedEnvelope,
  recipientSecretKeyHex: string,
): string {
  const key = deriveSharedKey(hexToBytes(recipientSecretKeyHex), hexToBytes(envelope.epk));
  const plaintext = gcm(key, hexToBytes(envelope.nonce)).decrypt(hexToBytes(envelope.ct));
  return bytesToUtf8(plaintext);
}

// Serialize an envelope to bytes for Walrus upload, and back.
export function envelopeToBytes(envelope: SealedEnvelope): Uint8Array {
  return utf8ToBytes(JSON.stringify(envelope));
}
export function bytesToEnvelope(bytes: Uint8Array): SealedEnvelope {
  return JSON.parse(bytesToUtf8(bytes));
}
