// Fetch the encrypted blob from Walrus (by the blob id stored on Canton) and
// decrypt it as the insurer. Canton gives the pointer, Walrus gives the encrypted
// bytes, the insurer's key opens it. Split into fetch + decrypt so the UI can show
// each step happening live.
//
// The blob is a "sealed box" (x25519 + HKDF-SHA256 + AES-256-GCM) encrypted to the
// insurer's public key (see Pulse/constants/crypto.ts). The matching demo private
// key lives here (throwaway demo key only).

import { gcm } from '@noble/ciphers/aes';
import { hexToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

const KDF_INFO = new TextEncoder().encode('pulse/x25519-hkdf-sha256/aes256gcm/v1');
const DEMO_INSURER_SECRET = '07b5bd075ca5e092d0dadbabe2fd7742699c51fe68a4a21eed4fa5d9ba7ea644';

export interface Envelope { v: number; alg: string; epk: string; nonce: string; ct: string; }

export interface InsuranceSummary {
  windowDays: number;
  fromDate: string;
  toDate: string;
  avgRestingHeartRate: number;
  avgHrvMs: number;
  avgVo2max: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgSleepHours: number;
  avgDailySteps: number;
  avgBmi: number;
  avgSpo2: number;
  pctDaysActive: number;
  pctNightsHealthySleep: number;
  pctDaysNormalBp: number;
  riskBand: string;
  riskNotes: string[];
}

// Step 1: pull the raw (encrypted) blob from the Walrus aggregator.
export async function fetchEnvelope(blobId: string): Promise<Envelope> {
  const res = await fetch(`/walrus/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus fetch failed (${res.status})`);
  return JSON.parse(await res.text());
}

// Step 2: decrypt the sealed box with the insurer's private key.
export function decryptEnvelope(envelope: Envelope): InsuranceSummary {
  const shared = x25519.getSharedSecret(hexToBytes(DEMO_INSURER_SECRET), hexToBytes(envelope.epk));
  const key = hkdf(sha256, shared, undefined, KDF_INFO, 32);
  const plaintext = gcm(key, hexToBytes(envelope.nonce)).decrypt(hexToBytes(envelope.ct));
  return (JSON.parse(bytesToUtf8(plaintext)).summary) as InsuranceSummary;
}
