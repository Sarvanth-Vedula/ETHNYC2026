// Minimal Daml JSON Ledger API client — this is what makes the page a real dApp:
// every action below is an HTTP call to the Canton ledger (create / query /
// exercise a Daml contract), not local state.
//
// Dev (local `daml start`): we mint HS256 dev tokens in-browser (the sandbox
// doesn't verify the signature) and the Vite proxy forwards /v1 to :7575.
// For a public DevNet demo, replace mintToken with the JWT your wallet issues.

const PKG = '123f3f464c523cc64180830f86c87128be0c5e442773be8930e1a0446d1b19a7';
export const tid = (t: string) => `${PKG}:HealthData:${t}`;
const LEDGER_ID = 'sandbox';
const SECRET = 'secret';

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const b64urlStr = (str: string) => b64url(new TextEncoder().encode(str));

async function hmac256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

async function mintToken(claims: object): Promise<string> {
  const header = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlStr(JSON.stringify({ 'https://daml.com/ledger-api': claims }));
  const sig = await hmac256(SECRET, `${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

const adminToken = () =>
  mintToken({ ledgerId: LEDGER_ID, applicationId: 'pulse', admin: true, actAs: [], readAs: [] });
const partyToken = (p: string) =>
  mintToken({ ledgerId: LEDGER_ID, applicationId: 'pulse', actAs: [p], readAs: [p] });

async function call(path: string, token: string, body: object): Promise<any> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.status !== 200) throw new Error(JSON.stringify(j.errors ?? j));
  return j.result;
}

export interface Contract {
  contractId: string;
  payload: any;
}

export async function allocateParty(hint: string): Promise<string> {
  const r = await call('/v1/parties/allocate', await adminToken(), { identifierHint: hint });
  return r.identifier;
}

export async function create(party: string, template: string, payload: object): Promise<Contract> {
  return call('/v1/create', await partyToken(party), { templateId: tid(template), payload });
}

export async function query(party: string, template: string): Promise<Contract[]> {
  return call('/v1/query', await partyToken(party), { templateIds: [tid(template)] });
}

export async function exercise(
  party: string,
  template: string,
  contractId: string,
  choice: string,
  argument: object,
): Promise<any> {
  return call('/v1/exercise', await partyToken(party), {
    templateId: tid(template),
    contractId,
    choice,
    argument,
  });
}
