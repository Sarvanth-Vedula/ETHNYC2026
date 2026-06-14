// Walrus decentralized storage client — testnet HTTP API (publisher/aggregator).
//
// On mobile we use the HTTP publisher/aggregator rather than the @mysten/walrus
// SDK: the SDK does erasure coding in WASM, which does not run on Hermes (Expo).
// The HTTP API still produces a real on-chain Sui `Blob` object — and by passing
// `send_object_to` we make the USER own that object, so it can later be
// referenced, tagged, extended, or deleted from a Sui transaction. That on-chain
// blob object (not just the raw bytes) is what makes this "more than an S3 bucket."

const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const DEFAULT_EPOCHS = 5;

export interface WalrusUploadResult {
  blobId: string;        // content-addressed ID (public) — used to read the blob
  blobObjectId: string;  // the on-chain Sui object ID of the Blob
  endEpoch: number;      // storage paid until this epoch
  alreadyExists: boolean;
  sizeBytes: number;     // size of the (encrypted) bytes stored
}

// Upload raw bytes (already-encrypted ciphertext) to Walrus testnet.
// `ownerAddress`, when a valid Sui address, makes the resulting Blob object owned
// by the user instead of the publisher.
export async function uploadToWalrus(
  bytes: Uint8Array,
  options: { epochs?: number; deletable?: boolean; ownerAddress?: string } = {},
): Promise<WalrusUploadResult> {
  const { epochs = DEFAULT_EPOCHS, deletable = true, ownerAddress } = options;

  const params = new URLSearchParams({ epochs: String(epochs), deletable: String(deletable) });
  if (ownerAddress && /^0x[0-9a-fA-F]{64}$/.test(ownerAddress)) {
    params.set('send_object_to', ownerAddress);
  }

  console.log('[Walrus] uploading', bytes.length, 'bytes →', `${PUBLISHER}/v1/blobs?${params}`);
  const response = await fetch(`${PUBLISHER}/v1/blobs?${params}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes as unknown as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walrus upload failed ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Publisher returns either `newlyCreated` (first upload) or `alreadyCertified`
  // (these exact bytes were already stored by someone).
  if (data.newlyCreated) {
    const obj = data.newlyCreated.blobObject;
    console.log('[Walrus] newlyCreated blobId:', obj.blobId, 'object:', obj.id);
    return {
      blobId: obj.blobId,
      blobObjectId: obj.id,
      endEpoch: obj.storage?.endEpoch ?? 0,
      alreadyExists: false,
      sizeBytes: obj.size ?? bytes.length,
    };
  }

  if (data.alreadyCertified) {
    console.log('[Walrus] alreadyCertified blobId:', data.alreadyCertified.blobId);
    return {
      blobId: data.alreadyCertified.blobId,
      blobObjectId: data.alreadyCertified.blobObject ?? '',
      endEpoch: data.alreadyCertified.endEpoch ?? 0,
      alreadyExists: true,
      sizeBytes: bytes.length,
    };
  }

  throw new Error(`Unexpected Walrus response: ${JSON.stringify(data)}`);
}

// Retrieve a blob's raw bytes from Walrus by blobId (still ciphertext — decrypt
// it with the locally-held key). Reads are free and need no wallet.
export async function downloadFromWalrus(blobId: string): Promise<Uint8Array> {
  const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!response.ok) {
    throw new Error(`Walrus download failed ${response.status}: ${blobId}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Check whether a blobId is still available on the network.
export async function checkBlobExists(blobId: string): Promise<boolean> {
  try {
    const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
