import {
  requestAuthorization,
  queryStatisticsForQuantity,
  queryStatisticsCollectionForQuantity,
  queryCategorySamples,
  CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import { mockSteps, mockSleep, mockVitals } from './mock';

let initPromise: Promise<void> | null = null;
let initialized = false;

export function initHealthKit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    console.log('[HealthKit:init] starting authorization request...');
    const granted = await requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierStepCount',
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKQuantityTypeIdentifierRestingHeartRate',
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'HKQuantityTypeIdentifierVO2Max',
        'HKQuantityTypeIdentifierBloodPressureSystolic',
        'HKQuantityTypeIdentifierBloodPressureDiastolic',
        'HKQuantityTypeIdentifierOxygenSaturation',
        'HKQuantityTypeIdentifierBodyMassIndex',
      ],
      toShare: [],
    });
    console.log('[HealthKit:init] authorization granted:', granted);
    if (!granted) throw new Error('HealthKit authorization denied');
    initialized = true;
    console.log('[HealthKit:init] ready ✓');
  })();
  return initPromise;
}

async function waitForInit(): Promise<boolean> {
  if (initialized) return true;
  console.log('[HealthKit] waitForInit — triggering init...');
  try { await initHealthKit(); return true; } catch (e) {
    console.log('[HealthKit] waitForInit — init failed:', e);
    return false;
  }
}

export async function getTodaySteps(): Promise<number> {
  console.log('[HealthKit:steps] getTodaySteps called at', new Date().toLocaleTimeString());
  const ready = await waitForInit();
  if (!ready) {
    console.log('[HealthKit:steps] NOT ready — returning mock:', mockSteps.today);
    return mockSteps.today;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  console.log('[HealthKit:steps] query window:', startOfDay.toLocaleTimeString(), '→', now.toLocaleTimeString());

  const stats = await queryStatisticsForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } }
  );
  console.log('[HealthKit:steps] raw response — sumQuantity:', JSON.stringify(stats.sumQuantity));
  console.log('[HealthKit:steps] sources count:', stats.sources?.length ?? 0);
  stats.sources?.forEach((src, i) => console.log(`[HealthKit:steps] source[${i}]:`, src.name ?? src.bundleIdentifier));

  const total = Math.round(stats.sumQuantity?.quantity ?? 0);
  console.log('[HealthKit:steps] FINAL total (deduplicated):', total, '— Fitness app should match this');
  return total;
}

export async function getHourlySteps(): Promise<number[]> {
  console.log('[HealthKit:hourly] getHourlySteps called at', new Date().toLocaleTimeString());
  const ready = await waitForInit();
  if (!ready) {
    console.log('[HealthKit:hourly] NOT ready — returning mock');
    return mockSteps.hourly;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  console.log('[HealthKit:hourly] querying 1-hour buckets from midnight to now');

  const collection = await queryStatisticsCollectionForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    startOfDay,
    { hour: 1 },
    { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } }
  );

  const hourly = new Array(24).fill(0);
  collection.forEach((s) => {
    if (s.startDate) {
      const hour = new Date(s.startDate).getHours();
      const count = Math.round(s.sumQuantity?.quantity ?? 0);
      hourly[hour] = count;
      if (count > 0) console.log(`[HealthKit:hourly] ${hour}:00 → ${count} steps`);
    }
  });
  console.log('[HealthKit:hourly] done — active hours:', hourly.filter(x => x > 0).length);
  return hourly;
}

export async function getWeeklySteps(): Promise<{ day: string; steps: number }[]> {
  console.log('[HealthKit:weekly] getWeeklySteps called at', new Date().toLocaleTimeString());
  const ready = await waitForInit();
  if (!ready) {
    console.log('[HealthKit:weekly] NOT ready — returning mock');
    return mockSteps.weekly;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  console.log('[HealthKit:weekly] querying 7-day window from', sevenDaysAgo.toLocaleDateString());

  const collection = await queryStatisticsCollectionForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    sevenDaysAgo,
    { day: 1 },
    { unit: 'count', filter: { date: { startDate: sevenDaysAgo, endDate: now } } }
  );

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const results = collection.map((s) => {
    const day = days[new Date(s.startDate!).getDay()];
    const steps = Math.round(s.sumQuantity?.quantity ?? 0);
    console.log(`[HealthKit:weekly] ${day} (${new Date(s.startDate!).toLocaleDateString()}): ${steps} steps`);
    return { day, steps };
  });
  return results;
}

export async function getLastNightSleep(): Promise<typeof mockSleep.last | null> {
  console.log('[HealthKit:sleep] getLastNightSleep called at', new Date().toLocaleTimeString());
  const ready = await waitForInit();
  if (!ready) {
    console.log('[HealthKit:sleep] NOT ready — returning null');
    return null;
  }

  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  threeDaysAgo.setHours(18, 0, 0, 0);
  console.log('[HealthKit:sleep] query window:', threeDaysAgo.toLocaleDateString(), '18:00 →', now.toLocaleTimeString());

  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 0,
    filter: { date: { startDate: threeDaysAgo, endDate: now } },
  });
  console.log('[HealthKit:sleep] total samples returned:', samples.length);

  if (samples.length === 0) {
    console.log('[HealthKit:sleep] no sleep data found in HealthKit — returning null');
    return null;
  }

  const stages = { awake: 0, rem: 0, core: 0, deep: 0 };
  let earliest = now;
  let latest = threeDaysAgo;

  samples.forEach((s, i) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    const dur = (end.getTime() - start.getTime()) / 60000;
    if (start < earliest) earliest = start;
    if (end > latest) latest = end;
    const stageLabel = {
      0: 'inBed', 1: 'asleepUnspecified', 2: 'awake',
      3: 'asleepCore', 4: 'asleepDeep', 5: 'asleepREM'
    }[s.value as number] ?? `unknown(${s.value})`;
    console.log(`[HealthKit:sleep] sample[${i}] ${stageLabel} — ${dur.toFixed(0)}min — ${start.toLocaleTimeString()} → ${end.toLocaleTimeString()}`);

    switch (s.value) {
      case CategoryValueSleepAnalysis.awake:             stages.awake += dur; break;
      case CategoryValueSleepAnalysis.asleepCore:        stages.core  += dur; break;
      case CategoryValueSleepAnalysis.asleepDeep:        stages.deep  += dur; break;
      case CategoryValueSleepAnalysis.asleepREM:         stages.rem   += dur; break;
      case CategoryValueSleepAnalysis.asleepUnspecified: stages.core  += dur; break;
    }
  });

  const total = Math.round(stages.awake + stages.rem + stages.core + stages.deep);
  console.log('[HealthKit:sleep] stages → deep:', stages.deep.toFixed(0), 'rem:', stages.rem.toFixed(0), 'core:', stages.core.toFixed(0), 'awake:', stages.awake.toFixed(0), '| TOTAL:', total, 'min');

  const fmt = (d: Date) => {
    const h = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
    return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  return {
    totalMinutes: total,
    bedtime: fmt(earliest),
    wakeTime: fmt(latest),
    stages: {
      awake: Math.round(stages.awake),
      rem:   Math.round(stages.rem),
      core:  Math.round(stages.core),
      deep:  Math.round(stages.deep),
    },
  };
}

export interface Vitals {
  restingHeartRate: number;
  hrvMs: number;
  vo2max: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  bmi: number;
}

// Reads the most recent value of each vital from HealthKit (last 30 days). Each
// metric is independent — if it's missing or not granted, we fall back to the mock
// value so the dashboard always renders. Real values appear on a device build.
export async function getVitals(): Promise<Vitals> {
  console.log('[HealthKit:vitals] getVitals called');
  const ready = await waitForInit();
  if (!ready) {
    console.log('[HealthKit:vitals] NOT ready — returning mock vitals');
    return mockVitals;
  }

  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 30);
  const filter = { date: { startDate: from, endDate: now } };

  const recent = async (id: string, unit: string, fallback: number): Promise<number> => {
    try {
      const s = await queryStatisticsForQuantity(id as any, ['mostRecent'] as any, { unit, filter } as any);
      const v = (s as any).mostRecentQuantity?.quantity;
      return typeof v === 'number' ? v : fallback;
    } catch {
      console.log('[HealthKit:vitals]', id, 'unavailable — using fallback');
      return fallback;
    }
  };

  const [rhr, hrv, vo2, sys, dia, ox, bmi] = await Promise.all([
    recent('HKQuantityTypeIdentifierRestingHeartRate', 'count/min', mockVitals.restingHeartRate),
    recent('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', mockVitals.hrvMs),
    recent('HKQuantityTypeIdentifierVO2Max', 'ml/kg*min', mockVitals.vo2max),
    recent('HKQuantityTypeIdentifierBloodPressureSystolic', 'mmHg', mockVitals.systolic),
    recent('HKQuantityTypeIdentifierBloodPressureDiastolic', 'mmHg', mockVitals.diastolic),
    recent('HKQuantityTypeIdentifierOxygenSaturation', '%', mockVitals.spo2),
    recent('HKQuantityTypeIdentifierBodyMassIndex', 'count', mockVitals.bmi),
  ]);

  // OxygenSaturation is reported as a fraction (0–1) in HealthKit; show as %.
  const spo2 = ox <= 1 ? ox * 100 : ox;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    restingHeartRate: Math.round(rhr),
    hrvMs: Math.round(hrv),
    vo2max: r1(vo2),
    systolic: Math.round(sys),
    diastolic: Math.round(dia),
    spo2: r1(spo2),
    bmi: r1(bmi),
  };
}
