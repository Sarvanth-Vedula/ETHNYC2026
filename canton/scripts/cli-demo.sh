#!/usr/bin/env bash
#
# PulseVault — Canton consent flow as a CLI demo with party-level output.
#
# Runs HealthDataTest:buildReport against a local Daml ledger and prints, for
# every step of the consent flow, exactly what EACH party (Patient / Insurer /
# Doctor) can see. Every line is also asserted inside the script, so the output
# is proven, not narrated. See the sample output in ../README.md.
#
# Usage:   ./scripts/cli-demo.sh        (from the canton/ directory)
#
set -euo pipefail
export PATH="$HOME/.daml/bin:$PATH"
cd "$(dirname "$0")/.."

DAR=".daml/dist/pulse-health-consent-0.1.0.dar"
OUT="/tmp/pulse-cli-report.json"

echo "› building package…"
daml build >/dev/null

# Reuse a sandbox if one is already listening on 6865 (e.g. from `daml start`);
# otherwise spin up a throwaway one just for this demo.
STARTED_PID=""
if nc -z localhost 6865 2>/dev/null; then
  echo "› using the Daml ledger already running on :6865"
else
  echo "› starting a throwaway sandbox on :6865 (first run takes ~30s)…"
  daml sandbox --port 6865 >/tmp/pulse-sandbox.log 2>&1 &
  STARTED_PID=$!
  for _ in $(seq 1 90); do nc -z localhost 6865 2>/dev/null && break; sleep 2; done
  sleep 6
fi

echo "› running the consent flow…"
# Retry a couple of times in case the ledger API is still warming up.
ok=""
for attempt in 1 2 3; do
  if daml script --dar "$DAR" --script-name HealthDataTest:buildReport \
       --ledger-host localhost --ledger-port 6865 --upload-dar yes \
       --output-file "$OUT" >/tmp/pulse-script.log 2>&1; then ok=1; break; fi
  sleep 5
done
[ -n "$ok" ] || { echo "script failed; see /tmp/pulse-script.log"; tail -5 /tmp/pulse-script.log; exit 1; }

echo
node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT','utf8')).join('\n'))"
echo

[ -n "$STARTED_PID" ] && kill "$STARTED_PID" 2>/dev/null || true
