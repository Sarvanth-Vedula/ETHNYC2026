# Proof: data is really stored on Walrus (+ the acknowledgement)

## How the proof works
When the app uploads to Walrus, Walrus sends back an **acknowledgement**: a **blob ID**
(your receipt) + an **on-chain Blob object** + size + storage duration. Then **anyone**
can re-fetch that blob from **any** Walrus aggregator by the blob ID — and getting the
bytes back is the proof it's truly on the decentralized network, not faked locally.

## The acknowledgement Walrus gives back (verified live)
Stored a test blob → Walrus returned:
```
blob ID (receipt):     O1_jFtwzZWDetc7tgf-6c8B_dfdUQHEPJ7EuFCvUMxo
on-chain Blob object:  0xdd8702da532f09741ec2b612b777f1b6f73c5ba9f492b69d6a2d73da8827e5ca
size:                  27 bytes
storage:               epochs 428 → 433
deletable:             true
```

## Verify it yourself (independent proof — anyone can run this)
1. **Re-fetch from a Walrus aggregator** (public, no login):
   https://aggregator.walrus-testnet.walrus.space/v1/blobs/O1_jFtwzZWDetc7tgf-6c8B_dfdUQHEPJ7EuFCvUMxo
   → returns the stored bytes, **HTTP 200**. ✅ It's on the network.
2. **In the app** (Wallet → "Generate & share with insurer"): a live audit log shows
   `① Reading → ② Consolidating → ③ Encrypting → ④ Uploading → ✓ Walrus stored it`,
   then the **blob ID receipt** + on-chain object + a "fetch it from Walrus" button.
3. **On-chain:** the Blob object id (`0xdd87…`) is a real Sui object (the network's record).

> The app's real blobs are **encrypted** before upload; this example used a plain test
> string just to show the store → ack → re-fetch round-trip clearly.

## "More than an S3 bucket" (the manipulation) — and when it happens
- **At upload time** (when you tap Sync/Share): it doesn't just dump bytes — it creates an
  **on-chain Walrus Blob object** with paid storage epochs + a deletable flag.
- **After upload:** that blob ID is **anchored behind a Sui Move contract** (`HealthRecordAnchor`,
  "a blob behind a smart contract") and **referenced by the Canton consent contract**.
  That on-chain ownership + reference is the "manipulation" beyond plain storage.
