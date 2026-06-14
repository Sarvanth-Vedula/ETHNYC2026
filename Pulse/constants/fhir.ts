// FHIR R4 serializer for HealthKit steps + sleep data

export interface FHIRCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FHIRQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'final';
  category: Array<{ coding: FHIRCoding[] }>;
  code: { coding: FHIRCoding[]; text?: string };
  subject: { identifier: { system: string; value: string } };
  effectiveDateTime: string;
  issued: string;
  valueQuantity?: FHIRQuantity;
  component?: Array<{
    code: { coding: FHIRCoding[] };
    valueQuantity: FHIRQuantity;
  }>;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'collection';
  timestamp: string;
  meta: {
    source: string;
    profile: string[];
  };
  entry: Array<{ resource: FHIRObservation }>;
}

const ACTIVITY_CATEGORY = {
  coding: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'activity',
      display: 'Activity',
    },
  ],
};

const UCUM = 'http://unitsofmeasure.org';
const LOINC = 'http://loinc.org';

export function buildStepsObservation(
  date: string,
  steps: number,
  walletAddress: string
): FHIRObservation {
  return {
    resourceType: 'Observation',
    id: `steps-${date}`,
    status: 'final',
    category: [ACTIVITY_CATEGORY],
    code: {
      coding: [
        {
          system: LOINC,
          code: '55423-8',
          display: 'Number of steps in unspecified time Pedometer',
        },
      ],
      text: 'Step count',
    },
    subject: {
      identifier: { system: 'urn:pulse:sui-wallet', value: walletAddress },
    },
    effectiveDateTime: date,
    issued: new Date().toISOString(),
    valueQuantity: {
      value: steps,
      unit: 'steps/day',
      system: UCUM,
      code: '/d',
    },
  };
}

export function buildSleepObservation(
  date: string,
  sleep: {
    totalMinutes: number;
    bedtime: string;
    wakeTime: string;
    stages: { awake: number; rem: number; core: number; deep: number };
  },
  walletAddress: string
): FHIRObservation {
  return {
    resourceType: 'Observation',
    id: `sleep-${date}`,
    status: 'final',
    category: [ACTIVITY_CATEGORY],
    code: {
      coding: [
        {
          system: LOINC,
          code: '93832-4',
          display: 'Sleep duration',
        },
      ],
      text: 'Sleep analysis',
    },
    subject: {
      identifier: { system: 'urn:pulse:sui-wallet', value: walletAddress },
    },
    effectiveDateTime: date,
    issued: new Date().toISOString(),
    valueQuantity: {
      value: sleep.totalMinutes,
      unit: 'min',
      system: UCUM,
      code: 'min',
    },
    component: [
      {
        code: {
          coding: [{ system: LOINC, code: '93830-8', display: 'Deep sleep duration' }],
        },
        valueQuantity: { value: sleep.stages.deep, unit: 'min', system: UCUM, code: 'min' },
      },
      {
        code: {
          coding: [{ system: LOINC, code: '93829-0', display: 'REM sleep duration' }],
        },
        valueQuantity: { value: sleep.stages.rem, unit: 'min', system: UCUM, code: 'min' },
      },
      {
        code: {
          coding: [{ system: LOINC, code: '93831-6', display: 'Light (Core) sleep duration' }],
        },
        valueQuantity: { value: sleep.stages.core, unit: 'min', system: UCUM, code: 'min' },
      },
      {
        code: {
          coding: [{ system: LOINC, code: '93828-2', display: 'Awake duration' }],
        },
        valueQuantity: { value: sleep.stages.awake, unit: 'min', system: UCUM, code: 'min' },
      },
    ],
  };
}

export function buildDailyBundle(
  date: string,
  steps: number,
  sleep: {
    totalMinutes: number;
    bedtime: string;
    wakeTime: string;
    stages: { awake: number; rem: number; core: number; deep: number };
  },
  walletAddress: string
): FHIRBundle {
  return {
    resourceType: 'Bundle',
    id: `pulse-daily-${date}`,
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: {
      source: 'urn:pulse:healthkit',
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
    },
    entry: [
      { resource: buildStepsObservation(date, steps, walletAddress) },
      { resource: buildSleepObservation(date, sleep, walletAddress) },
    ],
  };
}

export function bundleToBytes(bundle: FHIRBundle): string {
  return JSON.stringify(bundle, null, 0);
}
