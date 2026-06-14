export const mockSteps = {
  today: 8432,
  goal: 10000,
  hourly: [0, 0, 0, 0, 0, 0, 312, 890, 1204, 643, 521, 380, 720, 445, 312, 198, 421, 386, 0, 0, 0, 0, 0, 0],
  weekly: [
    { day: 'Mon', steps: 9210 },
    { day: 'Tue', steps: 7430 },
    { day: 'Wed', steps: 11240 },
    { day: 'Thu', steps: 6890 },
    { day: 'Fri', steps: 8100 },
    { day: 'Sat', steps: 12300 },
    { day: 'Sun', steps: 8432 },
  ],
  weeklyAvg: 9086,
  bestDay: 'Saturday',
};

export const mockSleep = {
  last: {
    bedtime: '11:15 PM',
    wakeTime: '6:28 AM',
    totalMinutes: 433,
    stages: {
      awake: 18,
      rem: 94,
      core: 187,
      deep: 134,
    },
  },
  weekly: [
    { day: 'Mon', minutes: 412 },
    { day: 'Tue', minutes: 380 },
    { day: 'Wed', minutes: 456 },
    { day: 'Thu', minutes: 395 },
    { day: 'Fri', minutes: 320 },
    { day: 'Sat', minutes: 480 },
    { day: 'Sun', minutes: 433 },
  ],
  weeklyAvg: 411,
};

export const mockWallet = {
  address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  balance: 12.4,
  blobsStored: 47,
  oldestExpiresDays: 318,
  lastSync: '6:02 AM',
  pendingBlobs: 0,
};

// Vitals shown on the dashboard. Real values come from HealthKit on a device;
// these are the fallback for the simulator / when a metric isn't available.
export const mockVitals = {
  restingHeartRate: 61, // bpm
  hrvMs: 58,            // ms
  vo2max: 43,           // ml/kg·min
  systolic: 118,        // mmHg
  diastolic: 76,        // mmHg
  spo2: 97.5,           // %
  bmi: 24.2,            // kg/m²
};

export const formatMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

export const formatAddress = (addr: string): string =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;
