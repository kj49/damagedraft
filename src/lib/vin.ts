import { ManufacturerGroup } from '../types/models';
import { normalizeVinLight } from './ocr';

export interface FordHoldCodeMapping {
  holdCode: string;
  plantName: string;
}

export interface VinDecodedInfo {
  vinNormalized: string;
  vinLength: number;
  isFullVin: boolean;
  manufacturerGroup: ManufacturerGroup;
  likelyMake: string;
  wmi: string;
  vds: string;
  vis: string;
  assemblyChar: string;
  fordHold?: FordHoldCodeMapping;
}

export interface VinMakeModel {
  make: string;
  model: string;
}

const GROUP_PREFIXES: Record<ManufacturerGroup, string[]> = {
  ford: [
    '1FA', '1FB', '1FC', '1FD', '1FM', '1FT', '1LN', '1LM', '2FA', '2FB', '2FM', '3FA', '3FE', '3FM', '5LM',
  ],
  stellantis: [
    '1C3', '2C3', '3C3', // Chrysler
    '1C4', '2C4', '3C4', // Jeep/Chrysler MPV
    '1C6', '3C6', // Ram
    '1B3', '2B3', '3B3', // Dodge legacy
    '1J4', '1J8', // Jeep legacy
    'ZFA', // FIAT (Stellantis)
  ],
  mazda: ['JM1', 'JM3', '7MM'],
  hyundai: ['KMH', 'KMF', '5NP'],
  honda: ['1HG', '2HG', 'JHM', 'JHL', '5FN', '5J6', '19X'],
  kia: ['KNA', 'KND', 'KND', '5XY', '5XX'],
  nissan: ['1N4', '1N6', '3N1', '3N6', '5N1', 'JN1', 'JN8'],
  toyota: ['1NX', '2T1', '3TM', '4T1', '5TD', '5TF', 'JTD', 'JT3', 'JT4'],
  unknown: [],
};

const MAKE_BY_WMI_PREFIX: Array<{ prefix: string; make: string }> = [
  { prefix: '1FA', make: 'Ford' },
  { prefix: '1FB', make: 'Ford' },
  { prefix: '1FC', make: 'Ford' },
  { prefix: '1FD', make: 'Ford' },
  { prefix: '1FM', make: 'Ford' },
  { prefix: '1FT', make: 'Ford' },
  { prefix: '2FA', make: 'Ford' },
  { prefix: '2FB', make: 'Ford' },
  { prefix: '2FM', make: 'Ford' },
  { prefix: '3FA', make: 'Ford' },
  { prefix: '3FE', make: 'Ford' },
  { prefix: '3FM', make: 'Ford' },
  { prefix: '1LN', make: 'Lincoln' },
  { prefix: '1LM', make: 'Lincoln' },
  { prefix: '5LM', make: 'Lincoln' },
  { prefix: '1C3', make: 'Chrysler' },
  { prefix: '2C3', make: 'Chrysler' },
  { prefix: '3C3', make: 'Chrysler' },
  { prefix: '1C4', make: 'Jeep' },
  { prefix: '2C4', make: 'Chrysler' },
  { prefix: '3C4', make: 'Jeep' },
  { prefix: '1C6', make: 'Ram' },
  { prefix: '3C6', make: 'Ram' },
  { prefix: '1B3', make: 'Dodge' },
  { prefix: '2B3', make: 'Dodge' },
  { prefix: '3B3', make: 'Dodge' },
  { prefix: '1J4', make: 'Jeep' },
  { prefix: '1J8', make: 'Jeep' },
  { prefix: 'JM1', make: 'Mazda' },
  { prefix: 'JM3', make: 'Mazda' },
  { prefix: '7MM', make: 'Mazda' },
  { prefix: 'KMH', make: 'Hyundai' },
  { prefix: 'KMF', make: 'Hyundai' },
  { prefix: '5NP', make: 'Hyundai' },
  { prefix: '1HG', make: 'Honda' },
  { prefix: '2HG', make: 'Honda' },
  { prefix: 'JHM', make: 'Honda' },
  { prefix: 'JHL', make: 'Honda' },
  { prefix: '5FN', make: 'Honda' },
  { prefix: '5J6', make: 'Honda' },
  { prefix: '19X', make: 'Honda' },
  { prefix: 'KNA', make: 'Kia' },
  { prefix: 'KND', make: 'Kia' },
  { prefix: '5XY', make: 'Kia' },
  { prefix: '5XX', make: 'Kia' },
  { prefix: '1N4', make: 'Nissan' },
  { prefix: '1N6', make: 'Nissan' },
  { prefix: '3N1', make: 'Nissan' },
  { prefix: '3N6', make: 'Nissan' },
  { prefix: '5N1', make: 'Nissan' },
  { prefix: 'JN1', make: 'Nissan' },
  { prefix: 'JN8', make: 'Nissan' },
  { prefix: '1NX', make: 'Toyota' },
  { prefix: '2T1', make: 'Toyota' },
  { prefix: '3TM', make: 'Toyota' },
  { prefix: '4T1', make: 'Toyota' },
  { prefix: '5TD', make: 'Toyota' },
  { prefix: '5TF', make: 'Toyota' },
  { prefix: 'JTD', make: 'Toyota' },
  { prefix: 'JT3', make: 'Toyota' },
  { prefix: 'JT4', make: 'Toyota' },
];

const FORD_HOLD_BY_ASSEMBLY_CHAR: Record<string, FordHoldCodeMapping> = {
  L: { holdCode: 'AP02A', plantName: 'Michigan Assembly' },
  G: { holdCode: 'AP03A', plantName: 'Chicago Assembly' },
  D: { holdCode: 'AP04A', plantName: 'Ohio Assembly' },
  F: { holdCode: 'AP05A', plantName: 'Dearborn Assembly' },
  K: { holdCode: 'AP06A', plantName: 'Kansas City Assembly' },
  P: { holdCode: 'AP08A', plantName: 'Flat Rock Assembly' },
  U: { holdCode: 'AP09A', plantName: 'Louisville Assembly' },
  O: { holdCode: 'AP13A', plantName: 'Detroit Assembly' },
  M: { holdCode: 'AP23A', plantName: 'Cuatitlan Assembly' },
  R: { holdCode: 'AP24A', plantName: 'Hermosillo Assembly' },
  J: { holdCode: 'GN4UA', plantName: 'China CAF Hangzhou Assembly' },
};

export function detectManufacturerGroupFromVin(vinInput: string): ManufacturerGroup {
  const vin = normalizeVinLight(vinInput);
  if (vin.length < 3) {
    return 'unknown';
  }

  const wmi = vin.slice(0, 3);
  const entries = Object.entries(GROUP_PREFIXES) as Array<[ManufacturerGroup, string[]]>;
  for (const [group, prefixes] of entries) {
    if (group === 'unknown') {
      continue;
    }
    if (prefixes.some((prefix) => wmi.startsWith(prefix))) {
      return group;
    }
  }

  return 'unknown';
}

export function detectLikelyMakeFromVin(vinInput: string): string {
  const vin = normalizeVinLight(vinInput);
  if (vin.length < 3) {
    return 'Unknown';
  }

  const wmi = vin.slice(0, 3);
  const match = MAKE_BY_WMI_PREFIX.find((item) => wmi.startsWith(item.prefix));
  return match ? match.make : 'Unknown';
}

export function decodeFordHoldFromVin(vinInput: string): FordHoldCodeMapping | undefined {
  const vin = normalizeVinLight(vinInput);
  if (vin.length !== 17) {
    return undefined;
  }

  const assemblyChar = vin.slice(10, 11);
  return FORD_HOLD_BY_ASSEMBLY_CHAR[assemblyChar];
}

export function decodeVinInfo(vinInput: string): VinDecodedInfo {
  const vin = normalizeVinLight(vinInput);
  const group = detectManufacturerGroupFromVin(vin);
  const likelyMake = detectLikelyMakeFromVin(vin);
  const assemblyChar = vin.length >= 11 ? vin.slice(10, 11) : '';
  const fordHold = group === 'ford' ? decodeFordHoldFromVin(vin) : undefined;

  return {
    vinNormalized: vin,
    vinLength: vin.length,
    isFullVin: vin.length === 17,
    manufacturerGroup: group,
    likelyMake,
    wmi: vin.slice(0, 3),
    vds: vin.slice(3, 9),
    vis: vin.slice(9, 17),
    assemblyChar,
    fordHold,
  };
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export async function prefillMakeModelFromVin(vinInput: string): Promise<VinMakeModel> {
  const vin = normalizeVinLight(vinInput);
  const localMake = detectLikelyMakeFromVin(vin);
  const localMakeResolved = localMake === 'Unknown' ? '' : localMake;

  if (vin.length !== 17) {
    return { make: localMakeResolved, model: '' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`,
      {
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!response.ok) {
      return { make: localMakeResolved, model: '' };
    }

    const payload = (await response.json()) as {
      Results?: Array<{ Make?: string; Model?: string }>;
    };
    const result = payload.Results?.[0];
    const make = result?.Make?.trim() ? toTitleCase(result.Make.trim()) : localMakeResolved;
    const model = result?.Model?.trim() ? toTitleCase(result.Model.trim()) : '';
    return { make, model };
  } catch {
    return { make: localMakeResolved, model: '' };
  }
}
