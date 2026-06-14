# PulseVault — Judge Cheat Sheet (read before demoing)

## 🎤 30-second pitch (say this first)
> "Your health data lives locked inside Apple/insurers — you don't own it. **PulseVault** flips that: your phone encrypts your health data and stores it on **Walrus** (decentralized storage), you **own** it via a **Sui** smart contract, and you decide **who can see it** with private consent on **Canton**. Plus a human-readable **ENS** identity. You own your data; you grant access; you can revoke it."

## The product in one line
**Phone encrypts health data → Walrus stores it → Sui proves you own it → Canton controls who sees it → ENS names the identity.**

---

## 🟦 SUI / WALRUS bounty — "Best new build with Walrus & the Sui stack"
**SHOW:**
1. Run `npm run e2e` (terminal) — encrypts 30-day summary, uploads to Walrus, insurer decrypts.
2. Open the blob in a browser: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/4RhCQ1LtslrvThZPt0x1WcF_XlfirSIyIMHD47_TcuE` → **gibberish (encrypted)**.
3. Suiscan — the live Move object: `https://suiscan.xyz/testnet/object/0xf37e80092b6daa22f83b684af955b7fcb50049691aea47a98ca22581eccaf4c8`

**SAY:**
> "Health data is too sensitive to sit on-chain, so we store it **encrypted on Walrus** — here's the public blob, it's gibberish without the key. Then a **Sui Move contract** owns and versions that blob — a blob *behind a smart contract*, not a loose ID. New build, real Walrus + Sui."

**Meets:** new build ✅ · meaningful Walrus + Sui (not superficial) ✅ · working demo ✅
**Key IDs:** Move package `0x8743caaf…1a9565` · anchor object `0xf37e80…f4c8`

---

## 🟩 CANTON bounty — "TradFi, RWA & Tokenized Assets"
**SHOW (the web dApp — see demo flow below):** switch Consumer → Insurer → Doctor and show who can/can't see the record; Insurer decrypts live.

**SAY:**
> "On a public chain everyone sees who can access your data. Canton is the only chain here with **private smart contracts**. We tokenize the health record as a **privately-owned asset**: the patient is the **sole signatory** and grants specific insurers/doctors as **observers** — exactly the *private-registry / selective-disclosure* model, like a tokenized bond's private cap table. Watch: the insurer sees **nothing** until the patient grants, then only they can read it — the doctor still can't."

**Meets:** deployed on DevNet via Seaport ✅ · meaningful Daml, signatory/observer/controller ✅ · open-source, README ✅ · functional UI (party differences) ✅
**Key IDs:** DevNet package `4f81ada709…24df85` · live HealthSummary contract created via Seaport

---

## 🟪 ENS bounty — "Integrate ENS" (equal-split pool)
**SHOW:** in the dApp, the "Identity via ENS" card resolves **`pulse.eth` → your wallet** live (and type any `.eth` name → resolves live).

**SAY:**
> "We integrate ENS for human-readable identity. This isn't RainbowKit — it's **viem's ENS resolution**, reading the name → address + profile **live from chain**. The address isn't hard-coded anywhere; change the record and the app shows the new value. Our own `pulse.eth` resolves to our wallet."

**Meets:** ENS-specific code (not RainbowKit) ✅ · functional, no hard-coded values ✅ · open-source ✅
**Key fact:** `pulse.eth → 0xa0e6A78d…BDBE7` (Sepolia), resolved live via viem.

---

## ▶️ DEMO FLOW (click-by-click)
1. **Phone (Pulse app):** Wallet → **"Generate & share with insurer"** → watch the live audit (Reading → Encrypting → Uploading → ✓ stored) → copy the **blob ID**.
2. **Web dApp (localhost:5173):** ENS card shows **pulse.eth → wallet**. As **Consumer** → paste blob ID → **Create**.
3. **Insurer** tab → "Request access" (record still hidden). **Consumer** → **Approve**.
4. **Insurer** tab → record appears → **Decrypt & read** → live audit (Canton authorizes → fetch Walrus → decrypt) → **real data shows**.
5. **Doctor** tab → **No access** 🔒.
**Close:** "Same data, three chains — Sui owns it, Canton controls access, ENS names it."

---

## ❓ Judge Q&A (the hard questions + your answers)

**Q: Blob IDs are public — isn't the data exposed?**
A: No. We encrypt **on the device** before upload (AES-256-GCM). The public blob is ciphertext — useless without the key.

**Q: How does the insurer decrypt it?**
A: We encrypt the summary **to the insurer's public key** (X25519 sealed box). Only their private key opens it. The key is never uploaded.

**Q: Isn't Sui and Canton doing the same thing?**
A: No — opposite jobs. **Sui = public ownership** of the stored blob. **Canton = private control** of who can read it. Sui can't keep the access list secret; Canton isn't a public composable asset layer. The Walrus blob ID is the bridge.

**Q: Is the ENS resolution hard-coded?**
A: No — it reads the chain live via viem. Type a different name, get a different result; change the record, the app updates. The address isn't in our code.

**Q: Is the data really on Walrus?**
A: Yes — anyone can fetch any blob ID from a public aggregator (HTTP 200). The blob ID is the acknowledgement. (See WALRUS-PROOF.md.)

**Q: "More than an S3 bucket"?**
A: The upload creates an **on-chain Walrus Blob object** (storage epochs, deletable flag), then it's **anchored behind a Sui Move contract** and **referenced by the Canton contract** — not plain storage.

**Q: Per-field access (insurer sees X, doctor sees Y)?**
A: Today it's record-level (granted = see it; not granted = invisible). Per-field is a natural next step via separate per-audience contracts. (Honest.)

**Q: Real data or mock?**
A: Steps/sleep are read from real HealthKit on a device; the broader vitals are realistic sample data for the demo. The encryption → storage → consent pipeline is fully real.

---

## 📌 Reference
- **Repo:** https://github.com/Sarvanth-Vedula/ETHNYC2026
- **Walrus aggregator (verify any blob):** `https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>`
- **Run dApp:** `cd canton && daml start` + `cd canton/ui && npm run dev` → localhost:5173
- **Run Walrus demo:** `cd Pulse && npm run e2e`

## ✅ Before you submit (per bounty)
Record a 2–5 min demo video, push code (done ✅), and **submit the project on ETHGlobal tagged to all three: Sui, Canton, ENS.**
