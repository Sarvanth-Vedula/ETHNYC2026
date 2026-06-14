// PulseVault — Sui Move anchor (the "blob behind a smart contract" part).
//
// This calls the LIVE `health_anchor::anchor` Move function on Sui testnet,
// creating a patient-owned `HealthRecordAnchor` object that records which Walrus
// blob is the canonical encrypted record + its risk band, versioned on-chain.
// Sui proves public OWNERSHIP of the blob; Canton (the rest of this dApp) keeps
// the access list private. The Walrus blob id is the bridge between them.
//
// The signer is a throwaway, faucet-funded TESTNET keypair — demo only (holds a
// little testnet SUI for gas, no real value, refillable from the faucet). In
// production each user would sign with their own wallet.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Published Move package (Sui testnet) — see ../../sui-anchor/Published.toml.
const PKG = '0x8743caaf8c2f7f9f4b2b64589dfa38d98680700db3d6079cd48f4cc68e1a9565';
// Throwaway testnet gas key (demo only).
const DEMO_SECRET = 'suiprivkey1qzj0mdf57fa9rkmgsyuy94fq08xkz6rg7q37vysnsmf3srlpxjexwrdx9kn';

const keypair = Ed25519Keypair.fromSecretKey(DEMO_SECRET);
export const SUI_SIGNER = keypair.getPublicKey().toSuiAddress();
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

export interface AnchorResult {
  digest: string;
  objectId: string;
  signer: string;
  txUrl: string;
  objectUrl: string;
}

// Anchor a Walrus blob on Sui by calling the Move contract live.
export async function anchorOnSui(
  blobId: string,
  riskBand: string,
  window: string,
  onStep?: (m: string) => void,
): Promise<AnchorResult> {
  onStep?.('① Building Sui Move call → health_anchor::anchor');
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::health_anchor::anchor`,
    arguments: [tx.pure.string(blobId), tx.pure.string(riskBand), tx.pure.string(window)],
  });

  onStep?.('② Signing & submitting to Sui testnet…');
  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (res.effects?.status?.status !== 'success') {
    throw new Error('Sui tx failed: ' + JSON.stringify(res.effects?.status));
  }
  const created = (res.objectChanges ?? []).find(
    (c) => c.type === 'created' && String((c as { objectType?: string }).objectType).includes('HealthRecordAnchor'),
  ) as { objectId?: string } | undefined;
  const objectId = created?.objectId ?? '';

  onStep?.('✓ Anchored on Sui — the blob is now owned behind the Move contract');
  return {
    digest: res.digest,
    objectId,
    signer: SUI_SIGNER,
    txUrl: `https://suiscan.xyz/testnet/tx/${res.digest}`,
    objectUrl: `https://suiscan.xyz/testnet/object/${objectId}`,
  };
}
