// End-to-end check of the insurance pipeline against LIVE Walrus testnet, using
// the real app modules (constants/crypto, constants/walrus, constants/insurance).
//
//   run: npx tsx scripts/e2e.ts
//
// Flow: patient generates 30 days of data → consolidate → encrypt for the
// insurer's PUBLIC key → upload to Walrus. Then, as the insurer, fetch by the
// PUBLIC blob ID and decrypt with the PRIVATE key. Proves a stranger with the
// blob ID sees nothing, but the insurer can read the consolidated summary.

import { downloadFromWalrus } from '../constants/walrus';
import { bytesToEnvelope, decryptAsRecipient } from '../constants/crypto';
import {
  generateMockHealthHistory,
  syncInsuranceSummary,
  DEMO_INSURER_PUBLIC_KEY,
} from '../constants/insurance';

// Demo insurer PRIVATE key (matches DEMO_INSURER_PUBLIC_KEY). Throwaway / demo only.
const INSURER_SECRET_KEY =
  process.env.INSURER_SECRET_KEY ??
  '07b5bd075ca5e092d0dadbabe2fd7742699c51fe68a4a21eed4fa5d9ba7ea644';

async function main() {
  console.log('① PATIENT: generate 30 days of fitness data, consolidate, encrypt for insurer, upload\n');
  const history = generateMockHealthHistory(30);
  const result = await syncInsuranceSummary(history, DEMO_INSURER_PUBLIC_KEY, {
    windowDays: 30,
    patientRef: 'pulse:demo-patient',
  });
  console.log('   consolidated summary (what the insurer will see):');
  console.log('   ', JSON.stringify(result.summary, null, 2).replace(/\n/g, '\n    '));
  console.log('\n   → uploaded to Walrus. PUBLIC blobId:', result.blobId);
  console.log('     on-chain object:', result.blobObjectId, '| bytes:', result.sizeBytes);

  console.log('\n② STRANGER: fetch the public blob — should be opaque\n');
  const raw = await fetchWithRetry(result.blobId);
  const envelope = bytesToEnvelope(raw);
  console.log('   envelope alg:', envelope.alg);
  console.log('   ciphertext (hex, first 48):', envelope.ct.slice(0, 48), '...(unreadable without the key)');

  console.log('\n③ INSURER: decrypt with the private key\n');
  const decrypted = JSON.parse(decryptAsRecipient(envelope, INSURER_SECRET_KEY));
  console.log('   decrypted risk band:', decrypted.summary.riskBand);
  console.log('   disclosure policy:', decrypted.disclosure);
  console.log('   raw daily values present?:', 'summary' in decrypted && !('days' in decrypted) ? 'NO ✓ (averages only)' : 'YES ✗');

  const ok = decrypted.summary.riskBand === result.summary.riskBand;
  console.log('\n   round-trip matches:', ok ? 'YES ✓' : 'NO ✗');

  // Wrong key must fail.
  try {
    decryptAsRecipient(envelope, '00'.repeat(32));
    console.log('   wrong-key decrypt: UNEXPECTEDLY SUCCEEDED ✗');
  } catch {
    console.log('   wrong-key decrypt: correctly rejected ✓');
  }
}

async function fetchWithRetry(blobId: string, attempts = 12): Promise<Uint8Array> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await downloadFromWalrus(blobId);
    } catch {
      console.log(`   (blob not available yet, retry ${i + 1}/${attempts})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error('blob never became available');
}

main().catch((e) => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
