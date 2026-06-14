import { useEffect, useState, useCallback } from 'react';
import * as L from './ledger';
import { fetchEnvelope, decryptEnvelope, InsuranceSummary } from './walrusDecrypt';
import { resolveEns, EnsProfile } from './ens';
import { anchorOnSui, AnchorResult } from './sui';

type Role = 'Patient' | 'Insurer' | 'Doctor';
type Parties = Record<Role, string>;
const ROLES: { key: Role; label: string; icon: string; desc: string }[] = [
  { key: 'Patient', label: 'Consumer', icon: '🧑', desc: 'owns the data' },
  { key: 'Insurer', label: 'Insurer', icon: '🏦', desc: 'wants the risk score' },
  { key: 'Doctor', label: 'Doctor', icon: '🩺', desc: 'treats the patient' },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function App() {
  const [parties, setParties] = useState<Parties | null>(null);
  const [cantonOffline, setCantonOffline] = useState(false);
  const [role, setRole] = useState<Role>('Patient');
  const [summaries, setSummaries] = useState<L.Contract[]>([]);
  const [requests, setRequests] = useState<L.Contract[]>([]);
  const [reads, setReads] = useState<Record<string, InsuranceSummary>>({});
  const [steps, setSteps] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [blobInput, setBlobInput] = useState('4RhCQ1LtslrvThZPt0x1WcF_XlfirSIyIMHD47_TcuE');
  const [ensName, setEnsName] = useState('pulse.eth');
  const [ens, setEns] = useState<EnsProfile | null>(null);
  const [ensBusy, setEnsBusy] = useState(false);
  // Sui Move anchor (live testnet call).
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [anchorSteps, setAnchorSteps] = useState<string[]>([]);
  const [anchorRes, setAnchorRes] = useState<AnchorResult | null>(null);
  // Standalone Walrus fetch + decrypt (works without Canton).
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoSteps, setDemoSteps] = useState<string[]>([]);
  const [demoRead, setDemoRead] = useState<InsuranceSummary | null>(null);

  const me = parties ? parties[role] : '';
  const roleLabel = ROLES.find((r) => r.key === role)!.label;

  // Try to reach the Canton ledger. If it isn't there (e.g. a hosted static
  // deploy with no local Daml ledger), degrade gracefully instead of crashing.
  useEffect(() => {
    (async () => {
      const cached = localStorage.getItem('pulse-parties-v2');
      if (cached) { setParties(JSON.parse(cached)); return; }
      const s = String(Math.floor(Math.random() * 1e6));
      const p: Parties = {
        Patient: await L.allocateParty('Consumer' + s),
        Insurer: await L.allocateParty('Insurer' + s),
        Doctor: await L.allocateParty('Doctor' + s),
      };
      localStorage.setItem('pulse-parties-v2', JSON.stringify(p));
      setParties(p);
    })().catch(() => setCantonOffline(true));
  }, []);

  const refresh = useCallback(async () => {
    if (!me) return;
    try {
      setSummaries(await L.query(me, 'HealthSummary'));
      setRequests(await L.query(me, 'AccessRequest'));
    } catch { setCantonOffline(true); }
  }, [me]);
  useEffect(() => { refresh(); }, [refresh]);

  // Switching party = a fresh view.
  useEffect(() => { setReads({}); setSteps({}); setErr(''); }, [role]);

  // ENS identity (read-only, live from Sepolia).
  const resolveIdentity = async (n: string) => {
    if (!n.trim()) return;
    setEnsBusy(true);
    try { setEns(await resolveEns(n)); } catch { setEns(null); } finally { setEnsBusy(false); }
  };
  useEffect(() => { resolveIdentity('pulse.eth'); }, []);

  const act = (label: string, fn: () => Promise<any>) => async () => {
    setBusy(label); setErr('');
    try { await fn(); await refresh(); }
    catch (e: any) { setErr(String(e.message)); }
    finally { setBusy(''); }
  };

  const myRecord = parties ? summaries.find((c) => c.payload.patient === parties.Patient) : undefined;
  const grantedTo = (who: Role) =>
    !!(myRecord && parties && myRecord.payload.grantees.includes(parties[who]));

  const createSummary = act('create', () =>
    L.create(parties!.Patient, 'HealthSummary', {
      patient: parties!.Patient, grantees: [],
      walrusBlobId: blobInput.trim(),
      riskBand: 'preferred', window: '30-day consolidated',
    }));
  const grant = (who: Role) => act('grant', () =>
    L.exercise(parties!.Patient, 'HealthSummary', myRecord!.contractId, 'GrantAccess', { grantee: parties![who] }));
  const revoke = (who: Role) => act('revoke', () =>
    L.exercise(parties!.Patient, 'HealthSummary', myRecord!.contractId, 'RevokeAccess', { grantee: parties![who] }));
  const requestAccess = act('request', () =>
    L.create(parties!.Insurer, 'AccessRequest', { insurer: parties!.Insurer, patient: parties!.Patient, purpose: 'underwriting quote' }));
  const approve = (cid: string) => act('approve', async () => {
    try {
      await L.exercise(parties!.Patient, 'AccessRequest', cid, 'Approve', { summaryCid: myRecord!.contractId });
    } catch (e: any) {
      if (String(e.message).includes('already granted')) {
        await L.exercise(parties!.Patient, 'AccessRequest', cid, 'Decline', {});
      } else { throw e; }
    }
  });

  const read = (cid: string, blobId: string) => act('read', async () => {
    const log: string[] = [];
    const step = async (m: string, ms = 600) => { log.push(m); setSteps((p) => ({ ...p, [cid]: [...log] })); await sleep(ms); };
    setSteps((p) => ({ ...p, [cid]: [] }));
    setReads((p) => { const n = { ...p }; delete n[cid]; return n; });
    await step(`① Canton — is "${roleLabel}" an authorized observer of this record?`);
    await L.exercise(me, 'HealthSummary', cid, 'FetchSummary', { viewer: me });
    await step('   ✓ authorized — Canton returns only the pointer (no raw data on-chain)');
    await step(`② Pointer from Canton → Walrus blob ${blobId.slice(0, 20)}…`);
    await step('③ Fetching the encrypted blob from Walrus…');
    const env = await fetchEnvelope(blobId);
    await step(`   ✓ got ${env.ct.length / 2} bytes of ciphertext: ${env.ct.slice(0, 28)}… (unreadable)`);
    await step("④ Decrypting with the recipient's access key (x25519 + AES-256-GCM)…");
    const summary = decryptEnvelope(env);
    await step('   ✓ decrypted — the real 30-day summary is below', 0);
    setReads((p) => ({ ...p, [cid]: summary }));
  });

  // Live Sui Move-contract anchor — works on a public URL (testnet RPC, open CORS).
  const anchorNow = async () => {
    setAnchorBusy(true); setErr(''); setAnchorRes(null); setAnchorSteps([]);
    try {
      const r = await anchorOnSui(blobInput.trim(), 'preferred', '30-day consolidated',
        (m) => setAnchorSteps((p) => [...p, m]));
      setAnchorRes(r);
    } catch (e: any) { setErr(String(e.message)); } finally { setAnchorBusy(false); }
  };

  // Standalone Walrus fetch + decrypt — shows the storage/encryption layer live,
  // independent of Canton (so it works on the hosted deploy too).
  const demoDecrypt = async () => {
    setDemoBusy(true); setErr(''); setDemoRead(null); setDemoSteps([]);
    const log: string[] = [];
    const step = async (m: string, ms = 500) => { log.push(m); setDemoSteps([...log]); await sleep(ms); };
    try {
      await step('① Fetching the encrypted blob from the Walrus aggregator…');
      const env = await fetchEnvelope(blobInput.trim());
      await step(`   ✓ got ${env.ct.length / 2} bytes of ciphertext: ${env.ct.slice(0, 28)}… (unreadable)`);
      await step("② Decrypting with the insurer's access key (x25519 + AES-256-GCM)…");
      const s = decryptEnvelope(env);
      await step('   ✓ decrypted — the real 30-day summary is below', 0);
      setDemoRead(s);
    } catch (e: any) { setErr(String(e.message)); } finally { setDemoBusy(false); }
  };

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">🔐 PulseVault</div>
        <div className="tag">Your health data. Encrypted on Walrus. You decide who sees it.</div>
        <div className="badge">● Walrus · Sui · Canton · ENS</div>
      </div>

      {/* ── Identity via ENS (live from Sepolia) ───────────────────────────── */}
      <div className="ens">
        <div className="enshead">🪪 Identity via ENS</div>
        <div className="ensrow">
          <input className="ensinput" value={ensName} onChange={(e) => setEnsName(e.target.value)} placeholder="name.eth" />
          <button className="btn sm" onClick={() => resolveIdentity(ensName)} disabled={ensBusy}>{ensBusy ? '…' : 'Resolve'}</button>
        </div>
        {ens && (
          <div className="ensresult">
            {ens.avatar && <img className="ensavatar" src={ens.avatar} alt="" />}
            <div style={{ minWidth: 0 }}>
              <div className="ensname">{ens.name}</div>
              {ens.address
                ? <div className="ensaddr mono">{ens.address}</div>
                : <div className="ensaddr muted">no address record set for this name</div>}
              {ens.description && <div className="ensdesc">{ens.description}</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── The Walrus blob (shared input) ─────────────────────────────────── */}
      <div className="panel">
        <div className="ptitle">Walrus blob — the encrypted 30-day summary</div>
        <input className="blobinput" value={blobInput} onChange={(e) => setBlobInput(e.target.value)} placeholder="Walrus blob ID from the phone app" />
        <div className="hint">Default is a real Walrus testnet blob. Paste the one your Pulse app produced to use your own.</div>
      </div>

      {/* ── Sui ownership: live Move-contract anchor ───────────────────────── */}
      <div className="panel">
        <div className="ptitle">⚓ Sui ownership — anchor the blob behind a Move contract</div>
        <div className="hint">Calls <span className="mono">health_anchor::anchor</span> live on Sui testnet → mints a patient-owned <span className="mono">HealthRecordAnchor</span> object. This is the “blob behind a smart contract” — more than an S3 bucket.</div>
        <button className="btn big" onClick={anchorNow} disabled={anchorBusy || !blobInput.trim()}>{anchorBusy ? 'Anchoring on Sui…' : '⚓ Anchor this blob on Sui'}</button>
        {anchorSteps.length > 0 && <div className="steps">{anchorSteps.map((s, i) => <div className="step" key={i}>{s}</div>)}</div>}
        {anchorRes && (
          <div style={{ marginTop: 10 }}>
            <div className="recrow"><span className="reclbl">Signer</span><span className="mono">{anchorRes.signer.slice(0, 14)}…</span></div>
            <div className="recrow"><span className="reclbl">Sui tx</span><a className="mono" href={anchorRes.txUrl} target="_blank" rel="noreferrer">{anchorRes.digest.slice(0, 18)}… ↗</a></div>
            <div className="recrow"><span className="reclbl">Anchor object</span><a className="mono" href={anchorRes.objectUrl} target="_blank" rel="noreferrer">{anchorRes.objectId.slice(0, 18)}… ↗</a></div>
          </div>
        )}
      </div>

      {/* ── Walrus: fetch + decrypt (the storage/encryption layer, live) ───── */}
      <div className="panel">
        <div className="ptitle">🔓 Walrus — fetch &amp; decrypt the encrypted summary</div>
        <div className="hint">Pulls the blob from the public Walrus aggregator and decrypts it as the authorized insurer. What’s stored on Walrus is ciphertext — only the key opens it.</div>
        <button className="btn big" onClick={demoDecrypt} disabled={demoBusy || !blobInput.trim()}>{demoBusy ? 'Working…' : '🔓 Fetch &amp; decrypt from Walrus'}</button>
        {demoSteps.length > 0 && <div className="steps">{demoSteps.map((s, i) => <div className="step" key={i}>{s}</div>)}</div>}
        {demoRead && <Decrypted s={demoRead} />}
      </div>

      {/* ── Canton consent ─────────────────────────────────────────────────── */}
      {cantonOffline ? (
        <div className="panel">
          <div className="ptitle">🔒 Canton consent — private, runs on a Daml ledger</div>
          <div className="hint">
            Canton enforces <b>who may read</b> your record with contract-level privacy — that can’t run on a static host
            (it needs a live Daml ledger). On this public link it’s shown read-only; the interactive party-switching demo
            runs locally (<span className="mono">daml start</span> + this app) or via the CLI.
          </div>
          <div className="rec" style={{ marginTop: 12 }}>
            <div className="recrow"><span className="reclbl">Patient (owner)</span><span>sees the record · grants / revokes access</span></div>
            <div className="recrow"><span className="reclbl">Insurer (granted)</span><span>sees the risk band <b>only after</b> consent</span></div>
            <div className="recrow"><span className="reclbl">Doctor (not granted)</span><span>🔒 record is invisible</span></div>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>CLI proof: <span className="mono">cd canton &amp;&amp; ./scripts/cli-demo.sh</span> — sample output is in the repo README.</div>
        </div>
      ) : !parties ? (
        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>Connecting to the Canton ledger…</div>
      ) : (
        <>
          <div className="switch">
            {ROLES.map((r) => (
              <button key={r.key} className={'tab' + (role === r.key ? ' on' : '')} onClick={() => setRole(r.key)}>
                <span className="tabicon">{r.icon}</span>
                <span className="tabname">{r.label}</span>
                <span className="tabdesc">{r.desc}</span>
              </button>
            ))}
          </div>

          <div className="vault">
            <div className="vaulthead">
              <span>What <b>{roleLabel}</b> can see on the ledger</span>
              <span className={'dot ' + (summaries.length ? 'open' : 'shut')}>{summaries.length ? '● visible' : '● hidden'}</span>
            </div>
            {summaries.length === 0 ? (
              <div className="locked">
                <div className="lockicon">🔒</div>
                <div className="lockttl">No access</div>
                <div className="muted">Canton keeps this record completely invisible to {roleLabel}<br />until the consumer grants it.</div>
              </div>
            ) : summaries.map((c) => (
              <div className="rec" key={c.contractId}>
                <div className="recrow"><span className="reclbl">Risk band</span><span className={'chip ' + c.payload.riskBand}>{c.payload.riskBand}</span></div>
                <div className="recrow"><span className="reclbl">Window</span><span>{c.payload.window}</span></div>
                <div className="recrow"><span className="reclbl">Walrus blob</span><span className="mono">{c.payload.walrusBlobId.slice(0, 18)}…</span></div>
                <div className="recrow"><span className="reclbl">Granted to</span><span>{c.payload.grantees.length} party</span></div>
                {role !== 'Patient' && <button className="btn" style={{ marginTop: 12 }} onClick={read(c.contractId, c.payload.walrusBlobId)} disabled={busy === 'read'}>{busy === 'read' ? 'Working…' : '🔓 Decrypt & read full data'}</button>}
                {steps[c.contractId]?.length > 0 && (
                  <div className="steps">{steps[c.contractId].map((s, i) => <div className="step" key={i}>{s}</div>)}</div>
                )}
                {reads[c.contractId] && <Decrypted s={reads[c.contractId]} />}
              </div>
            ))}
          </div>

          {role === 'Patient' && (
            <div className="panel">
              <div className="ptitle">Consumer controls</div>
              {!myRecord ? (
                <button className="btn big" onClick={createSummary} disabled={busy === 'create' || !blobInput.trim()}>＋ Create my encrypted health summary</button>
              ) : (
                <div className="btnrow">
                  <button className={'btn' + (grantedTo('Insurer') ? ' off' : '')} onClick={grant('Insurer')} disabled={busy === 'grant' || grantedTo('Insurer')}>{grantedTo('Insurer') ? '✓ Insurer granted' : 'Grant Insurer'}</button>
                  <button className={'btn' + (grantedTo('Doctor') ? ' off' : '')} onClick={grant('Doctor')} disabled={busy === 'grant' || grantedTo('Doctor')}>{grantedTo('Doctor') ? '✓ Doctor granted' : 'Grant Doctor'}</button>
                  {grantedTo('Insurer') && <button className="btn ghost" onClick={revoke('Insurer')} disabled={busy === 'revoke'}>Revoke Insurer</button>}
                </div>
              )}
              {requests.length > 0 && (
                <>
                  <div className="ptitle small">Pending access requests</div>
                  {requests.map((r) => (
                    <div className="req" key={r.contractId}>
                      <span><b>Insurer</b> requests access — “{r.payload.purpose}”</span>
                      <button className="btn sm" onClick={approve(r.contractId)} disabled={!myRecord || busy === 'approve'}>
                        {grantedTo('Insurer') ? 'Dismiss' : 'Approve'}
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {role === 'Insurer' && (
            <div className="panel">
              <div className="ptitle">Insurer controls</div>
              <button className="btn big" onClick={requestAccess} disabled={busy === 'request'}>Request access from the consumer</button>
            </div>
          )}
        </>
      )}

      {err && <div className="err">⚠ {err.length > 200 ? err.slice(0, 200) + '…' : err}</div>}
      <div className="foot">Sui = public ownership · Walrus = encrypted storage · Canton = private consent · ENS = identity</div>
    </div>
  );
}

function Decrypted({ s }: { s: InsuranceSummary }) {
  const rows: [string, string][] = [
    ['Resting HR', `${s.avgRestingHeartRate} bpm`],
    ['Blood pressure', `${s.avgSystolic}/${s.avgDiastolic}`],
    ['BMI', `${s.avgBmi}`],
    ['VO₂max', `${s.avgVo2max}`],
    ['Sleep', `${s.avgSleepHours} h/night`],
    ['Daily steps', `${s.avgDailySteps}`],
    ['HRV', `${s.avgHrvMs} ms`],
    ['Blood oxygen', `${s.avgSpo2}%`],
    ['Active days', `${s.pctDaysActive}%`],
    ['Healthy sleep', `${s.pctNightsHealthySleep}%`],
  ];
  return (
    <div className="decrypted">
      <div className="dechead">🔓 Decrypted from Walrus · {s.windowDays}-day window ({s.fromDate} → {s.toDate})</div>
      <div className="metrics">
        {rows.map(([k, v]) => (
          <div className="metric" key={k}><span className="mk">{k}</span><span className="mv">{v}</span></div>
        ))}
      </div>
      <div className="decnote">{s.riskNotes.join(' · ')}</div>
    </div>
  );
}
