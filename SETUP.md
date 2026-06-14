if h# PulseVault — how to test it end to end

There are three parts. **Only Part 1 needs setup on your side.** Parts 2 & 3 are
already deployed on-chain (shared) — you just view/run them.

---

## Part 1 — The phone app (the real end-to-end: your data → Walrus)

**You need:** a Mac with **Xcode**, **Node 20.19+ (or 22)**, an **iPhone + cable**, and an **Apple ID**.

1. Clone the repo and open the phone app:
   ```bash
   git clone <repo-url>
   cd EthNYC2026/Pulse
   npm install
   ```
2. Plug in your iPhone and "Trust" the Mac.
3. Build onto the phone:
   ```bash
   npx expo run:ios --device
   ```
   - Pick your iPhone from the list.
   - If Xcode asks for signing: open the generated `ios/` project, under **Signing & Capabilities** pick your Apple ID **Team**, and make sure **HealthKit** is listed as a capability.
4. On the phone, when it asks, tap **Allow** for Health access.
5. **Dashboard** now shows your *real* data (steps, sleep, heart rate, BP, etc.).
6. Go to the **Wallet** tab → tap **Sync** (and **Generate & share with insurer**).
   - It encrypts your data and uploads it to **Walrus**, then shows the **blob ID** and adds it to history. ✅

That blob ID = your real health data, encrypted, stored on decentralized storage.
**Copy it** — you'll use it in Part 3.

> Simulator note: in the iOS *simulator* (no real Health data) the app shows
> realistic sample numbers. Real numbers only appear on a real iPhone after step 4.

---

## Part 2 — Sui + Canton (already live — just view)

Nothing to deploy. These were deployed once and are shared:

- **Sui (ownership):** https://suiscan.xyz/testnet/object/0xf37e80092b6daa22f83b684af955b7fcb50049691aea47a98ca22581eccaf4c8
- **Canton (consent):** the `HealthSummary` is live on Canton DevNet — view it in Seaport (`app.devnet.seaport.to`, ETH Global Hackathon org → Active Contracts).

---

## Part 3 — (Optional) auto-create a Canton contract from your blob, + the consent dApp

These run on the **laptop**, not the phone. Optional — Part 2 already proves it's live.

**Auto-glue (blob → Canton contract, automatic):**
```bash
cd EthNYC2026/canton
CANTON_M2M_SECRET=<secret-from-the-5North-PDF> node scripts/autoGlue.mjs <yourBlobId>
```

**Canton consent dApp (the Patient/Insurer/Doctor visibility demo):**
```bash
curl -sSL https://get.daml.com/ | sh    # one-time: install Daml SDK
cd EthNYC2026/canton && daml start       # local ledger (keep running)
# new terminal:
cd EthNYC2026/canton/ui && npm install && npm run dev   # open http://localhost:5173
```

---

- **Must do:** Part 1 (run Pulse on your iPhone → get a Walrus blob ID).
- **Just view:** Part 2 (Sui + Canton are already live).
- **Optional:** Part 3 (auto-glue + the consent dApp).
