// Insurer-side decryptor. Given a PUBLIC Walrus blob ID and the insurer's PRIVATE
// key, fetch the encrypted summary and decrypt it. This is the whole "how does
// the insurer decrypt?" answer — they need nothing but the blob ID + their key.
//
//   run: npx tsx scripts/insurerDecrypt.ts <blobId> [secretKeyHex]
//   or:  INSURER_SECRET_KEY=... npx tsx scripts/insurerDecrypt.ts <blobId>

import { downloadFromWalrus } from '../constants/walrus';
import { bytesToEnvelope, decryptAsRecipient } from '../constants/crypto';

const blobId = process.argv[2];
const secretKeyHex =
  process.argv[3] ??
  process.env.INSURER_SECRET_KEY ??
  '07b5bd075ca5e092d0dadbabe2fd7742699c51fe68a4a21eed4fa5d9ba7ea644'; // demo only

if (!blobId) {
  console.error('usage: npx tsx scripts/insurerDecrypt.ts <blobId> [secretKeyHex]');
  process.exit(1);
}

async function main() {
  const bytes = await downloadFromWalrus(blobId);
  const envelope = bytesToEnvelope(bytes);
  const summary = JSON.parse(decryptAsRecipient(envelope, secretKeyHex));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error('decrypt failed:', e);
  process.exit(1);
});
