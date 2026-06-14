# PulseVault — Sui (Move) anchor for Walrus health data

The Sui-stack half of the Pulse project (ETHGlobal NY 2026, Sui **"Best new build
with Walrus & the Sui stack"** track). The iOS app + Walrus storage live in
`../Pulse`; the Canton privacy/consent layer lives in `../canton`.

## What it does

The encrypted 30-day health summary is stored on **Walrus** (decentralized blob
storage). This Move package puts that blob **behind a smart contract**: the patient
owns a `HealthRecordAnchor` Sui object that records which Walrus blob is their
canonical, current record, versioned on-chain. Storing a blob behind a contract is
exactly the "genuine work" the track calls out.

- `anchor(walrus_blob_id, risk_band, window)` — patient mints an owned anchor object.
- `update_blob(...)` — patient re-anchors a fresh monthly summary; `version` bumps.
- Emits an `Anchored` event each time, so indexers/the app can track versions.

## Why this is NOT the same as the Canton contract (the dual-bounty story)

One product, two chains, each doing the job only it can do:

| | **Sui + Walrus** (this) | **Canton / Daml** (`../canton`) |
|---|---|---|
| Job | Decentralized **storage** + on-chain **ownership** of the blob | **Private consent** — who may *read* it |
| Why this chain | Sui is public → great for provable ownership/anchoring; Walrus is the storage | Canton has contract-level privacy → confidential, revocable access list |
| Can the other chain do it? | Canton doesn't give you a public, composable Sui-native asset/Walrus anchor | Sui can't keep the access list or contents private — everything on Sui is public |

So the two are complementary, not duplicative. The bridge between them is the
**Walrus blob ID**: anchored as a Sui object here, and referenced by the Canton
`HealthSummary` consent contract there. For the Sui judges we lead with storage +
ownership; for the Canton judges we lead with privacy + consent.

## Build / test / publish (Sui testnet)

```bash
sui move build                 # compile the Move package
sui move test                  # run health_anchor_tests
sui client publish --gas-budget 100000000   # deploy to testnet
```

Then call it:

```bash
sui client call --package <PKG> --module health_anchor --function anchor \
  --args "4RhCQ1LtslrvThZPt0x1WcF_XlfirSIyIMHD47_TcuE" "preferred" "30-day consolidated" \
  --gas-budget 10000000
```

## Notes / limitations

- The anchor stores the blob **id**, not the bytes (bytes are on Walrus). A
  deeper version could take the Walrus `Blob` object and call
  `walrus::blob::assert_certified_not_expired` to prove on-chain the data is still
  stored — a natural next step.
- The anchor is public (Sui is a public chain): it reveals that *an* owner has *a*
  health record blob and its risk band. Keep anything sensitive off this object —
  confidential disclosure is Canton's job, and the blob contents are encrypted.
