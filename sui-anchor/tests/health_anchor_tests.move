#[test_only]
module pulse_anchor::health_anchor_tests {
    use pulse_anchor::health_anchor::{Self, HealthRecordAnchor};
    use sui::test_scenario;
    use std::string;

    #[test]
    fun test_anchor_and_reanchor() {
        let patient = @0xA11CE;
        let mut sc = test_scenario::begin(patient);

        // Patient anchors a Walrus blob (a real testnet blob id from the Pulse pipeline).
        {
            health_anchor::anchor(
                string::utf8(b"4RhCQ1LtslrvThZPt0x1WcF_XlfirSIyIMHD47_TcuE"),
                string::utf8(b"preferred"),
                string::utf8(b"30-day consolidated"),
                sc.ctx(),
            );
        };

        // The patient now owns the anchor object; re-anchor a fresh summary.
        sc.next_tx(patient);
        {
            let mut rec = sc.take_from_sender<HealthRecordAnchor>();
            assert!(health_anchor::version(&rec) == 1, 0);
            assert!(health_anchor::owner(&rec) == patient, 1);

            health_anchor::update_blob(
                &mut rec,
                string::utf8(b"NEWBLOBID_next_month"),
                string::utf8(b"standard"),
            );
            assert!(health_anchor::version(&rec) == 2, 2);
            assert!(health_anchor::blob_id(&rec) == string::utf8(b"NEWBLOBID_next_month"), 3);
            assert!(health_anchor::risk_band(&rec) == string::utf8(b"standard"), 4);

            sc.return_to_sender(rec);
        };

        sc.end();
    }
}
