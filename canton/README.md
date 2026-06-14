# PulseVault — Canton (Daml) consent layer

Tokenized, consent-gated health data on the **Canton Network**. This is the
Canton/Daml half of the Pulse project (ETHGlobal NY 2026, Canton **TradFi, RWA &
Tokenized Assets** track). The Sui/Walrus half (the iOS app that encrypts health
data and stores it on Walrus) lives in `../Pulse`.

## What it does

A person's raw daily health metrics are encrypted and stored on **Walrus**
(off-ledger). On Canton, each patient owns a **`HealthSummary`** contract that
holds only a pointer to that encrypted blob plus a consolidated risk band — and
controls **who may see it**. The patient is the sole **signatory** (self-sovereign
data) and selectively grants read access to specific insurers or doctors as
**observers**. A party who is neither the patient nor an approved grantee cannot
see the contract at all — this is the selective-disclosure / private-registry
model that regulated health and financial data require, enforced at the contract
level by Canton's privacy model rather than bolted on.

## Privacy model — who sees what, and why

| Party | Role in Daml | Sees |
|---|---|---|
| **Patient** | `signatory` | Everything about their own record; authorizes all grants/revokes |
| **Insurer / Doctor (granted)** | `observer` (added via `GrantAccess`) | The risk band + Walrus pointer of records they were granted — nothing else |
| **Anyone else** | not a stakeholder | Nothing — the contract is invisible to them |

Visibility is driven by `signatory` / `observer` / `controller`:
- `GrantAccess` / `RevokeAccess` are controlled by the **patient** only.
- `FetchSummary` asserts the caller is the patient or a current grantee.
- `AccessRequest` is a **propose/accept**: the insurer proposes, only the patient
  can `Approve`, and approval is what grants visibility — multi-party authorization.

## CLI demo — party-level visibility output

The accepted way to verify the consent model without a UI. One command runs the
full flow on a local Daml ledger and prints, at every step, exactly what **each
party can see**. Every line below is also asserted inside the script (so
`daml test` passes) — the output is proven, not narrated.

```bash
./scripts/cli-demo.sh     # builds, runs the flow, prints the report below
# or just prove it CI-style (asserts only, in-memory ledger):
daml test
```

Sample output, captured from a real run against a local Daml ledger:

```text
================================================================
 PulseVault | Canton selective-disclosure consent flow
 Parties:  Patient (data owner)  .  Insurer  .  Doctor
================================================================

STEP 1  Patient creates HealthSummary
        (raw daily data is encrypted on Walrus; only the risk band
         + Walrus pointer ever live on Canton)
    Patient  (owner)    can see 1 record(s)
    Insurer  (grantee)  can see 0 record(s)
    Doctor   (outsider) can see 0 record(s)

STEP 2  Insurer requests access -> Patient APPROVES (consent granted)
    Patient  (owner)    can see 1 record(s)
    Insurer  (grantee)  can see 1 record(s)
    Doctor   (outsider) can see 0 record(s)

STEP 3  Authorized read (FetchSummary)
        Insurer reads -> riskBand="preferred"
                         walrusBlobId="4RhCQ1LtslrvThZPt0x1WcF_XlfirSIyIMHD47_TcuE"
        Doctor  reads -> REJECTED "not authorized" (never had visibility)

STEP 4  Patient REVOKES the Insurer
    Patient  (owner)    can see 1 record(s)
    Insurer  (grantee)  can see 0 record(s)
    Doctor   (outsider) can see 0 record(s)

================================================================
 RESULT: every party saw EXACTLY what consent allowed, nothing more.
================================================================
```

**How to read it:** the same `HealthSummary` is queried as three different
parties at each step. The **Insurer** flips `0 → 1 → 0` records as consent is
granted then revoked; the **Doctor**, never granted, stays at `0` throughout and
is *rejected* when trying to read. That column-by-column difference is Canton
enforcing privacy at the contract level — not an app hiding rows. The flow is
defined in [`daml/HealthDataTest.daml`](daml/HealthDataTest.daml).

## Architecture

```
[ iOS app (../Pulse) ]                      [ Canton / Daml (this repo) ]
 reads HealthKit → consolidates 30 days
 → AES-256-GCM encrypt → upload to Walrus
        │                                          ▲
        │  walrusBlobId + riskBand                 │ patient creates HealthSummary,
        └──────────────────────────────────────────┘ grants insurer/doctor as observers
 Walrus (Sui) = encrypted storage          Canton = private consent / tokenized access registry
```

Walrus holds the heavy encrypted payload; Canton holds the tokenized access
rights and enforces confidentiality between parties.

## Setup & run locally

Requires the Daml SDK (DPM). Install:

```bash
curl -sSL https://get.daml.com/ | sh      # installs the `daml` assistant
# (Canton-native CLI is DPM: see docs.canton.network/sdks-tools/cli-tools/dpm)
```

Then, from this directory:

```bash
daml build              # compile HealthData.daml -> a .dar package
daml test               # run HealthDataTest.daml — asserts the consent/visibility flow
./scripts/cli-demo.sh   # run it AND print the per-party report (see above)
daml start              # local sandbox + HTTP JSON API for the web UI
```

## Deploy to Canton DevNet (via Seaport by 5North)

No local validator needed — DevNet provides a shared `5n sandbox` validator.

1. Create a Loop DevNet wallet at https://devnet.cantonloop.com and copy your **Party ID**.
   (Get an invite code by pinging the Canton Foundation team on the hackathon Discord.)
2. Log in to Seaport at https://app.devnet.seaport.to with that wallet; have the
   organizer add your Party ID to the hackathon org.
3. New project → paste/import the `daml/` sources → **Build Project** (produces a `.dar`).
4. **Deploy** → select the `5n sandbox` validator → confirm.
5. Create a `HealthSummary` from the Contract Factory and exercise choices live.

## Demo (2–5 min, switching party perspectives)

1. As **Patient**, create a `HealthSummary`.
2. Switch to **Insurer** — show the record is **invisible**.
3. As **Insurer**, create an `AccessRequest`; as **Patient**, `Approve` it.
4. Switch to **Insurer** — the record is now **visible**; `FetchSummary` shows the
   risk band but no raw daily data.
5. As **Patient**, `RevokeAccess` — the **Insurer**'s view disappears.

## Known limitations

- **Observers see all fields of the contract.** That's why only the risk band +
  Walrus pointer live on-ledger; the sensitive raw daily data stays encrypted on
  Walrus. Treat anything placed on a contract as visible to its observers.
- **Revocation is forward-only** — it removes future visibility, but a grantee may
  have already read/copied data while granted.
- **No contract keys** — Canton 3.x doesn't support them, so lookups are by
  contract id / query, not by key.
- The `walrusBlobId` in the test is a real Walrus testnet blob from the Sui side;
  in production the patient would supply their own per-summary blob id.
- Local sandbox uses insecure dev JWTs; never expose the JSON API publicly.
