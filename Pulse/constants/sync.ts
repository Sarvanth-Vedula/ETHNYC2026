// Orchestrates: HealthKit data → FHIR bundle → ENCRYPT → Walrus upload → local index
//
// The encrypt step is essential: Walrus blob IDs are public, so we upload only
// AES-256-GCM ciphertext. The decryption key never leaves the device — it's kept
// in the local blob index next to the blob ID.

import { buildDailyBundle, bundleToBytes } from './fhir';
import { uploadToWalrus } from './walrus';
import { encryptString } from './crypto';
import { saveBlob, getBlobByDate, yesterdayDateString, todayDateString } from './blobStore';
import { getTodaySteps, getLastNightSleep } from './healthkit';

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing'; step: string }
  | { state: 'done'; blobId: string; date: string; sizeBytes: number }
  | { state: 'already_synced'; blobId: string; date: string }
  | { state: 'error'; message: string };

// Wallet address placeholder — replace with the user's real Sui testnet address.
// When this is a valid 0x + 64-hex Sui address, the uploaded Blob object is sent
// to the user (so they own it on-chain); otherwise it stays with the publisher.
const WALLET_ADDRESS = '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';

// Used when no sleep data is available so the bundle still serializes.
const EMPTY_SLEEP = {
  totalMinutes: 0,
  bedtime: '—',
  wakeTime: '—',
  stages: { awake: 0, rem: 0, core: 0, deep: 0 },
};

export async function syncDay(
  onProgress: (status: SyncStatus) => void,
  forceDate?: string
): Promise<SyncStatus> {
  const date = forceDate ?? yesterdayDateString();

  try {
    // Check if already synced
    const existing = await getBlobByDate(date);
    if (existing) {
      const result: SyncStatus = { state: 'already_synced', blobId: existing.blobId, date };
      onProgress(result);
      return result;
    }

    // Step 1: Read health data
    onProgress({ state: 'syncing', step: 'Reading health data...' });
    const [steps, sleep] = await Promise.all([getTodaySteps(), getLastNightSleep()]);

    // Step 2: Serialize to FHIR R4
    onProgress({ state: 'syncing', step: 'Serializing to FHIR R4...' });
    const bundle = buildDailyBundle(date, steps, sleep ?? EMPTY_SLEEP, WALLET_ADDRESS);
    const json = bundleToBytes(bundle);

    // Step 3: Encrypt before it leaves the device (blob IDs are public)
    onProgress({ state: 'syncing', step: 'Encrypting (AES-256-GCM)...' });
    const enc = encryptString(json);

    // Step 4: Upload ciphertext to Walrus
    onProgress({ state: 'syncing', step: 'Uploading to Walrus...' });
    const upload = await uploadToWalrus(enc.ciphertext, { ownerAddress: WALLET_ADDRESS });

    // Step 5: Save to local index (key + nonce stay on-device, never uploaded)
    await saveBlob({
      date,
      blobId: upload.blobId,
      blobObjectId: upload.blobObjectId,
      endEpoch: upload.endEpoch,
      uploadedAt: new Date().toISOString(),
      sizeBytes: upload.sizeBytes,
      type: 'daily-bundle',
      keyHex: enc.keyHex,
      nonceHex: enc.nonceHex,
    });

    const result: SyncStatus = {
      state: 'done',
      blobId: upload.blobId,
      date,
      sizeBytes: upload.sizeBytes,
    };
    onProgress(result);
    return result;
  } catch (err: any) {
    const result: SyncStatus = { state: 'error', message: err?.message ?? 'Unknown error' };
    onProgress(result);
    return result;
  }
}

// Sync today's data (useful for manual sync)
export async function syncToday(onProgress: (status: SyncStatus) => void): Promise<SyncStatus> {
  return syncDay(onProgress, todayDateString());
}
