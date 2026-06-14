// Insurance summary pipeline.
//
// Privacy principle (selective disclosure): the patient stores ALL raw daily
// metrics encrypted on Walrus for themselves. An insurer does NOT get the raw,
// day-by-day stream. Instead we compute a CONSOLIDATED summary over a window
// (default 30 days) — averages + derived risk indicators only — encrypt THAT to
// the insurer's public key, and store it as its own Walrus blob. The insurer can
// then fetch by blob ID and decrypt with their private key. They learn the risk
// signal, not the minute-by-minute life of the patient.

import { encryptForRecipient, envelopeToBytes } from './crypto';
import { uploadToWalrus, WalrusUploadResult } from './walrus';

// ── The ~10 daily parameters a consumer health app typically captures ──────────
export interface HealthDay {
  date: string;             // YYYY-MM-DD
  steps: number;            // activity volume
  activeMinutes: number;    // exercise minutes
  restingHeartRate: number; // bpm
  hrvMs: number;            // heart-rate variability, ms
  vo2max: number;           // cardiorespiratory fitness, ml/kg/min
  systolic: number;         // blood pressure, mmHg
  diastolic: number;        // blood pressure, mmHg
  sleepMinutes: number;     // total sleep, min
  bmi: number;              // body mass index, kg/m^2
  spo2: number;             // blood oxygen, %
}

// Which metrics move an insurance price, and how. (Grounded in life/health
// underwriting guidance: resting HR, BP, BMI, activity, sleep, VO2max, HRV.)
export const INSURANCE_METRICS: Array<{
  key: string;
  label: string;
  unit: string;
  better: 'lower' | 'higher' | 'range';
  why: string;
}> = [
  { key: 'restingHeartRate', label: 'Resting heart rate', unit: 'bpm', better: 'lower', why: 'Strong cardiovascular mortality predictor; lower = lower risk.' },
  { key: 'systolic', label: 'Blood pressure (systolic)', unit: 'mmHg', better: 'lower', why: 'Hypertension is a major rating factor.' },
  { key: 'bmi', label: 'Body mass index', unit: 'kg/m²', better: 'range', why: 'Obesity correlates with diabetes & heart disease; >35 often substandard.' },
  { key: 'vo2max', label: 'Cardiorespiratory fitness', unit: 'ml/kg/min', better: 'higher', why: 'High VO2max is strongly cardioprotective.' },
  { key: 'steps', label: 'Daily activity', unit: 'steps', better: 'higher', why: 'Physical activity level lowers all-cause mortality.' },
  { key: 'sleepMinutes', label: 'Sleep duration', unit: 'min', better: 'range', why: '~7h optimal; <5h sharply raises mortality risk.' },
  { key: 'hrvMs', label: 'Heart-rate variability', unit: 'ms', better: 'higher', why: 'Autonomic health / stress resilience.' },
];

export interface ConsolidatedHealthSummary {
  windowDays: number;
  fromDate: string;
  toDate: string;
  daysIncluded: number;
  avgRestingHeartRate: number;
  avgHrvMs: number;
  avgVo2max: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgSleepHours: number;
  avgDailySteps: number;
  avgActiveMinutes: number;
  avgBmi: number;
  avgSpo2: number;
  pctDaysActive: number;          // % days meeting an activity goal
  pctNightsHealthySleep: number;  // % nights in 7–9h
  pctDaysNormalBp: number;        // % days < 130/80
  riskBand: 'preferred' | 'standard' | 'substandard';
  riskNotes: string[];
}

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: boolean[]) => (xs.length ? round((xs.filter(Boolean).length / xs.length) * 100, 0) : 0);

// Aggregate the most recent `windowDays` of raw data into a single risk summary.
export function consolidate(history: HealthDay[], windowDays = 30): ConsolidatedHealthSummary {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-windowDays);
  if (window.length === 0) throw new Error('No health data to consolidate');

  const summary: ConsolidatedHealthSummary = {
    windowDays,
    fromDate: window[0].date,
    toDate: window[window.length - 1].date,
    daysIncluded: window.length,
    avgRestingHeartRate: round(avg(window.map((d) => d.restingHeartRate))),
    avgHrvMs: round(avg(window.map((d) => d.hrvMs))),
    avgVo2max: round(avg(window.map((d) => d.vo2max))),
    avgSystolic: round(avg(window.map((d) => d.systolic))),
    avgDiastolic: round(avg(window.map((d) => d.diastolic))),
    avgSleepHours: round(avg(window.map((d) => d.sleepMinutes)) / 60),
    avgDailySteps: Math.round(avg(window.map((d) => d.steps))),
    avgActiveMinutes: Math.round(avg(window.map((d) => d.activeMinutes))),
    avgBmi: round(avg(window.map((d) => d.bmi))),
    avgSpo2: round(avg(window.map((d) => d.spo2))),
    pctDaysActive: pct(window.map((d) => d.steps >= 8000 || d.activeMinutes >= 30)),
    pctNightsHealthySleep: pct(window.map((d) => d.sleepMinutes >= 420 && d.sleepMinutes <= 540)),
    pctDaysNormalBp: pct(window.map((d) => d.systolic < 130 && d.diastolic < 80)),
    riskBand: 'standard',
    riskNotes: [],
  };

  // Transparent, explainable risk banding.
  const notes: string[] = [];
  let substandard = false;
  let preferredEligible = true;

  if (summary.avgBmi >= 32) { notes.push('Average BMI ≥ 32'); substandard = true; }
  else if (summary.avgBmi < 18.5 || summary.avgBmi > 27) { notes.push('BMI outside preferred 18.5–27'); preferredEligible = false; }

  if (summary.avgSystolic >= 140 || summary.avgDiastolic >= 90) { notes.push('Average BP in hypertensive range'); substandard = true; }
  else if (summary.avgSystolic >= 125 || summary.avgDiastolic >= 80) { notes.push('BP above preferred'); preferredEligible = false; }

  if (summary.avgRestingHeartRate >= 80) { notes.push('Elevated resting heart rate'); substandard = true; }
  else if (summary.avgRestingHeartRate > 65) { notes.push('Resting heart rate above preferred'); preferredEligible = false; }

  if (summary.avgVo2max < 30) { notes.push('Low cardiorespiratory fitness'); substandard = true; }
  else if (summary.avgVo2max < 40) { preferredEligible = false; }

  if (summary.pctDaysActive < 50) { notes.push('Active on <50% of days'); preferredEligible = false; }
  if (summary.pctNightsHealthySleep < 50) { notes.push('Healthy sleep on <50% of nights'); preferredEligible = false; }

  summary.riskBand = substandard ? 'substandard' : preferredEligible ? 'preferred' : 'standard';
  if (notes.length === 0) notes.push('All tracked metrics within preferred ranges');
  summary.riskNotes = notes;

  return summary;
}

// Wrap the summary with provenance metadata for the insurer.
export function buildInsuranceSummaryJSON(
  summary: ConsolidatedHealthSummary,
  patientRef: string,
): string {
  return JSON.stringify(
    {
      type: 'pulse-insurance-summary',
      version: 1,
      patientRef, // a Sui address / pseudonymous ID — NOT a real-world identity
      generatedAt: new Date().toISOString(),
      disclosure: 'consolidated-averages-only; raw daily data withheld',
      summary,
    },
    null,
    0,
  );
}

export interface InsuranceSyncResult extends WalrusUploadResult {
  summary: ConsolidatedHealthSummary;
}

// Full pipeline: consolidate → encrypt for the insurer → upload to Walrus.
// The returned blobId is public; only the insurer (holder of the private key for
// `insurerPublicKeyHex`) can decrypt it.
export async function syncInsuranceSummary(
  history: HealthDay[],
  insurerPublicKeyHex: string,
  options: { windowDays?: number; patientRef?: string; ownerAddress?: string } = {},
): Promise<InsuranceSyncResult> {
  const { windowDays = 30, patientRef = 'pulse:anon', ownerAddress } = options;

  const summary = consolidate(history, windowDays);
  const json = buildInsuranceSummaryJSON(summary, patientRef);
  const envelope = encryptForRecipient(json, insurerPublicKeyHex);
  const upload = await uploadToWalrus(envelopeToBytes(envelope), { ownerAddress });

  return { ...upload, summary };
}

// ── Demo helpers ──────────────────────────────────────────────────────────────

// Demo insurer identity (public key only lives in the app; the matching private
// key lives with the insurer / in scripts/insurerDecrypt.ts). Throwaway — for
// the hackathon demo only.
export const DEMO_INSURER_PUBLIC_KEY =
  'a3bb57fcd2338bb4a324ed7c57eba625009a6ac25b1ea35aa3275d15f05b601a';

// Generate realistic synthetic daily history (used until HealthKit reads all
// metrics; the extra parameters beyond steps/sleep aren't wired to HealthKit yet).
export function generateMockHealthHistory(days = 30, endDate = new Date()): HealthDay[] {
  const out: HealthDay[] = [];
  const jitter = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    out.push({
      date: d.toISOString().split('T')[0],
      steps: Math.max(0, Math.round(jitter(8800, 3500))),
      activeMinutes: Math.max(0, Math.round(jitter(38, 25))),
      restingHeartRate: Math.round(jitter(61, 6)),
      hrvMs: Math.round(jitter(58, 18)),
      vo2max: round(jitter(43, 4)),
      systolic: Math.round(jitter(118, 10)),
      diastolic: Math.round(jitter(76, 7)),
      sleepMinutes: Math.max(0, Math.round(jitter(445, 70))),
      bmi: round(jitter(24.2, 1.5)),
      spo2: round(jitter(97.5, 1)),
    });
  }
  return out;
}
