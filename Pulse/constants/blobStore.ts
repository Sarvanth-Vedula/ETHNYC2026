// Local index of Walrus blob IDs, keyed by date — persisted with AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

const INDEX_KEY = 'pulse:walrus:index';

export interface BlobRecord {
  date: string;          // "2026-06-09"
  blobId: string;        // public content-addressed ID (used to fetch ciphertext)
  blobObjectId: string;  // on-chain Sui Blob object ID
  endEpoch: number;
  uploadedAt: string;    // ISO timestamp
  sizeBytes: number;
  type: 'daily-bundle';
  // Encryption material — stays on-device only, NEVER uploaded. Without these the
  // public blobId is just opaque ciphertext. (Harden later with expo-secure-store.)
  keyHex: string;
  nonceHex: string;
}

export type BlobIndex = Record<string, BlobRecord>; // date → record

async function readIndex(): Promise<BlobIndex> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeIndex(index: BlobIndex): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function saveBlob(record: BlobRecord): Promise<void> {
  const index = await readIndex();
  index[record.date] = record;
  await writeIndex(index);
}

export async function getBlobByDate(date: string): Promise<BlobRecord | null> {
  const index = await readIndex();
  return index[date] ?? null;
}

export async function getAllBlobs(): Promise<BlobRecord[]> {
  const index = await readIndex();
  return Object.values(index).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getBlobCount(): Promise<number> {
  const index = await readIndex();
  return Object.keys(index).length;
}

// Returns blobs expiring within `withinEpochs` epochs
export async function getExpiringBlobs(currentEpoch: number, withinEpochs = 30): Promise<BlobRecord[]> {
  const blobs = await getAllBlobs();
  return blobs.filter(b => b.endEpoch - currentEpoch <= withinEpochs);
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
