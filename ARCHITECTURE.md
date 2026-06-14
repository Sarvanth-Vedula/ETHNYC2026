# PulseVault — Architecture (end to end)

**One line:** Your health data comes from your *phone*, is stored *encrypted on Walrus*,
*owned* on *Sui*, and *access-controlled* on *Canton* — you decide who can see it.

```
                ┌─────────────────────────────────────────────┐
                │   PATIENT'S iPHONE  —  "Pulse" app          │
                │   (run on device via Xcode, wired)          │
                │                                             │
                │   Apple HealthKit  (steps, sleep, HR, BP…)  │
                │        │                                    │
                │        ▼  consolidate 30 days → risk band   │
                │        ▼  AES-256-GCM encrypt  🔒           │
                └───────────────────┬─────────────────────────┘
                                    │  upload ciphertext
                                    ▼
                ┌─────────────────────────────────────────────┐
                │   WALRUS   (decentralized storage, on Sui)  │
                │   • stores the ENCRYPTED blob               │
                │   • returns a public  blob ID               │
                │   • public link = gibberish without the key │
                └────────┬─────────────────────────┬──────────┘
            blob ID ◄────┘                         └────► blob ID
                ▼                                          ▼
   ┌────────────────────────────┐        ┌────────────────────────────────┐
   │  SUI  —  Move contract     │        │  CANTON  —  Daml contract       │
   │  HealthRecordAnchor        │        │  HealthSummary                  │
   │                            │        │                                │
   │  records WHO OWNS the blob │        │  controls WHO MAY SEE it       │
   │  (public, on-chain)        │        │  • patient = signatory (owner) │
   │                            │        │  • grant / revoke insurer,doc  │
   │  🏆  Sui / Walrus bounty   │        │  • AccessRequest (ask→approve) │
   └────────────────────────────┘        │  🏆  Canton TradFi/RWA bounty  │
                                          └──────────────────┬─────────────┘
                                                  granted as │ observer
                                                             ▼
                                          ┌────────────────────────────────┐
                                          │  INSURER / DOCTOR              │
                                          │  1) read risk band + pointer  │
                                          │     directly from CANTON       │
                                          │  2) fetch full blob from       │
                                          │     WALRUS  →  decrypt  🔓     │
                                          └────────────────────────────────┘
```

## The pieces, plainly

| # | Piece | Job | What it is in code |
|---|-------|-----|--------------------|
| 1 | **Phone (Pulse)** | get data in, encrypt, upload | `Pulse/` (React Native / Expo, HealthKit) |
| 2 | **Walrus** | store the **encrypted** data, give a public blob ID | `Pulse/constants/walrus.ts` |
| 3 | **Sui (Move)** | record **who owns** the blob (public) | `sui-anchor/` → `HealthRecordAnchor` |
| 4 | **Canton (Daml)** | control **who may see** it (private, revocable) | `canton/` → `HealthSummary`, `AccessRequest` |
| 5 | **Insurer / Doctor** | once granted: read risk band on Canton, fetch full data from Walrus, decrypt | `canton/ui` dApp + `Pulse/scripts/insurerDecrypt.ts` |

## The split that wins both bounties

- **Sui = who OWNS the stored data** (public — anyone can verify ownership, nobody can read the encrypted bytes).
- **Canton = who is ALLOWED to read it** (private — others can't even see the record exists until granted).
- **Walrus = where the encrypted data physically lives.**
- **The blob ID is the thread** connecting all of them.


 Sui is public (can't keep the access list secret),
Canton isn't a public composable asset layer. That's *why* we use both — not for prizes,
but because the problem has two halves.
