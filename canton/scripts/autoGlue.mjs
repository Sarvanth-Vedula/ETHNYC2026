// Auto-glue: turn a Walrus blob id into a live Canton DevNet contract automatically.
//
//   phone → Walrus (returns blob id) → THIS SCRIPT → Canton HealthSummary created
//
// No Seaport clicking: it gets a DevNet access token (OIDC client_credentials) and
// submits a create command to the Canton JSON Ledger API v2.
//
// usage:
//   CANTON_M2M_SECRET=<secret> node canton/scripts/autoGlue.mjs <walrusBlobId> [riskBand] [window]
//
// The secret comes from the 5North "Seaport Sandbox Validator Access" doc (DevNet,
// throwaway, 8h token). It is read from the environment so it is never committed.

const SECRET = process.env.CANTON_M2M_SECRET;
const AUTH = 'https://auth.sandbox.fivenorth.io/application/o/token/';
const LEDGER = 'https://ledger-api.validator.devnet.sandbox.fivenorth.io';
const CLIENT = 'validator-devnet-m2m';
const PKG = process.env.CANTON_PKG || '4f81ada709cee02ac24077cfdce9a68616b2c0dc190e6790adca9f827024df85';
// A party this token is allowed to act as (CanActAs). Override via env if needed.
const PARTY = process.env.CANTON_PARTY || 'exchange_82ba7f::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8';
const USER_ID = process.env.CANTON_USER_ID || '6';

const blobId = process.argv[2];
const riskBand = process.argv[3] || 'preferred';
const window = process.argv[4] || '30-day consolidated';

if (!SECRET) { console.error('✗ set CANTON_M2M_SECRET (from the 5North DevNet access doc)'); process.exit(1); }
if (!blobId) { console.error('usage: node autoGlue.mjs <walrusBlobId> [riskBand] [window]'); process.exit(1); }

async function getToken() {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET, audience: CLIENT, scope: 'daml_ledger_api' });
  const r = await fetch(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(`token exchange failed (${r.status})`);
  return (await r.json()).access_token;
}

async function main() {
  console.log('① getting a Canton DevNet access token…');
  const at = await getToken();
  console.log(`② creating HealthSummary on Canton DevNet  (walrus blob ${blobId.slice(0, 18)}…, risk: ${riskBand})…`);
  const cmd = {
    commandId: 'pulse-glue-' + Date.now(),
    userId: USER_ID,
    actAs: [PARTY],
    readAs: [],
    commands: [{
      CreateCommand: {
        templateId: `${PKG}:HealthData:HealthSummary`,
        createArguments: { patient: PARTY, grantees: [PARTY], walrusBlobId: blobId, riskBand, window },
      },
    }],
  };
  const r = await fetch(`${LEDGER}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`create failed (${r.status}): ${txt}`);
  const res = JSON.parse(txt);
  console.log('✓ live on Canton DevNet — updateId:', res.updateId);
  console.log('  (phone blob → Walrus → Canton, fully automatic)');
}

main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
