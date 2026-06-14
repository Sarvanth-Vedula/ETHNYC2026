/// PulseVault — Sui-side anchor for Walrus-stored health data.
///
/// The encrypted health summary lives on Walrus (a Walrus blob, referenced by
/// `walrus_blob_id`). This Move object is the on-chain anchor for that blob: it
/// records WHO owns the record and WHICH blob is the canonical, current version,
/// as a patient-owned Sui object. This is the "store a blob behind a smart
/// contract" pattern the Sui/Walrus track rewards — the blob isn't a loose ID,
/// it's owned and versioned on Sui.
///
/// Division of labor across the project: Sui/Walrus = decentralized STORAGE +
/// on-chain OWNERSHIP of the blob; Canton = private CONSENT/disclosure of who may
/// read it. Sui is public, so it proves ownership; Canton keeps the access list
/// confidential. Neither chain duplicates the other.
module pulse_anchor::health_anchor {
    use std::string::String;
    use sui::event;

    /// A patient-owned anchor pointing at an encrypted Walrus blob.
    public struct HealthRecordAnchor has key, store {
        id: UID,
        owner: address,
        walrus_blob_id: String, // the Walrus blob holding the encrypted summary
        risk_band: String,      // consolidated signal: preferred | standard | substandard
        window: String,         // e.g. "30-day consolidated"
        version: u64,           // bumps each time the patient re-anchors a fresh summary
    }

    /// Emitted whenever a blob is anchored or re-anchored.
    public struct Anchored has copy, drop {
        owner: address,
        walrus_blob_id: String,
        version: u64,
    }

    /// Mint a new anchor for the caller (an owned Sui object).
    public entry fun anchor(
        walrus_blob_id: String,
        risk_band: String,
        window: String,
        ctx: &mut TxContext,
    ) {
        let owner = ctx.sender();
        let rec = HealthRecordAnchor {
            id: object::new(ctx),
            owner,
            walrus_blob_id,
            risk_band,
            window,
            version: 1,
        };
        event::emit(Anchored { owner, walrus_blob_id: rec.walrus_blob_id, version: 1 });
        transfer::transfer(rec, owner);
    }

    /// Owner points the anchor at a newer Walrus blob (a fresh summary), bumping version.
    public entry fun update_blob(
        rec: &mut HealthRecordAnchor,
        new_blob_id: String,
        new_risk_band: String,
    ) {
        rec.walrus_blob_id = new_blob_id;
        rec.risk_band = new_risk_band;
        rec.version = rec.version + 1;
        event::emit(Anchored { owner: rec.owner, walrus_blob_id: rec.walrus_blob_id, version: rec.version });
    }

    // ── read-only accessors ────────────────────────────────────────────────
    public fun blob_id(rec: &HealthRecordAnchor): String { rec.walrus_blob_id }
    public fun risk_band(rec: &HealthRecordAnchor): String { rec.risk_band }
    public fun version(rec: &HealthRecordAnchor): u64 { rec.version }
    public fun owner(rec: &HealthRecordAnchor): address { rec.owner }
}
