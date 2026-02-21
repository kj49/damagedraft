import { extractTextFromImage, isSupported } from 'expo-text-extractor';

const FULL_VIN_REGEX = /[A-HJ-NPR-Z0-9]{17}/g;
const VIN_KEYWORD_REGEX = /\b(VIN|VEHICLE\s*ID|VEHICLE\s*IDENTIFICATION)\b/i;

function normalizeLine(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function splitLines(textBlocks: string[]): string[] {
  return textBlocks
    .flatMap((block) => block.split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean);
}

function isValidVin17(candidate: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(candidate);
}

function scoreVin(candidate: string, line: string, prevLine: string, nextLine: string): number {
  let score = 100;
  if (VIN_KEYWORD_REGEX.test(line)) {
    score += 35;
  }
  if (VIN_KEYWORD_REGEX.test(prevLine) || VIN_KEYWORD_REGEX.test(nextLine)) {
    score += 20;
  }

  // Typical VINs have several letters and digits; reward mixed patterns.
  const letters = (candidate.match(/[A-HJ-NPR-Z]/g) ?? []).length;
  const digits = (candidate.match(/[0-9]/g) ?? []).length;
  if (letters >= 3) {
    score += 6;
  }
  if (digits >= 3) {
    score += 6;
  }

  // Penalize obvious OCR garbage like same char repeated many times.
  const repeated = /(.)\1{5,}/.test(candidate);
  if (repeated) {
    score -= 25;
  }

  return score;
}

function collect17CharCandidates(lines: string[]): Array<{ vin: string; score: number }> {
  const candidates: Array<{ vin: string; score: number }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    const next = i + 1 < lines.length ? lines[i + 1] : '';
    const normalized = normalizeLine(current);
    if (!normalized) {
      continue;
    }

    // Prefer VIN-like values that appear in a single OCR row.
    for (let start = 0; start <= normalized.length - 17; start += 1) {
      const maybeVin = normalized.slice(start, start + 17);
      if (!isValidVin17(maybeVin)) {
        continue;
      }
      candidates.push({
        vin: maybeVin,
        score: scoreVin(maybeVin, current, prev, next),
      });
    }
  }

  return candidates;
}

function normalizeForRuns(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
}

function normalizeCompact(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function normalizeVinLight(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s\r\n-]+/g, '');
}

export function hasVinAmbiguousChars(value: string): boolean {
  return /[IOQ]/.test(normalizeVinLight(value));
}

export function extractVin(textBlocks: string[]): string | null {
  const lines = splitLines(textBlocks);
  const lineCandidates = collect17CharCandidates(lines);
  if (lineCandidates.length) {
    lineCandidates.sort((a, b) => b.score - a.score);
    return lineCandidates[0].vin;
  }

  const joined = lines.join(' ');
  const compact = normalizeCompact(joined);
  const fullMatches = compact.match(FULL_VIN_REGEX);
  if (fullMatches?.length) {
    return fullMatches[0];
  }

  const runs = normalizeForRuns(joined)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);

  if (!runs.length) {
    return null;
  }

  runs.sort((a, b) => b.length - a.length);
  return runs[0];
}

export async function extractVinFromImage(uri: string): Promise<string | null> {
  if (!isSupported) {
    return null;
  }

  try {
    const blocks = await extractTextFromImage(uri);
    return extractVin(blocks);
  } catch {
    return null;
  }
}
