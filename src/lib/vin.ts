import { ManufacturerGroup } from '../types/models';
import { normalizeVinLight } from './ocr';

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
