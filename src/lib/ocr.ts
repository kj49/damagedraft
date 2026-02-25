import { extractTextFromImage, isSupported } from 'expo-text-extractor';

const FULL_VIN_REGEX = /[A-HJ-NPR-Z0-9]{17}/g;
const VIN_KEYWORD_REGEX = /\b(VIN|VEHICLE\s*ID|VEHICLE\s*IDENTIFICATION)\b/i;
const LEADING_VIN_LABEL_REGEX = /^\s*V[1I]N[\s:;#-]*/i;
const INLINE_VIN_LABEL_REGEX = /V[1I]N[\s:;#-]+/i;

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

function startsInsideVinLabel(normalizedLine: string, start: number): boolean {
  const around = normalizedLine.slice(Math.max(0, start - 2), start + 1);
  return /V[1I]N/.test(around);
}

function stripLeadingVinLabel(line: string): string {
  if (LEADING_VIN_LABEL_REGEX.test(line)) {
    return line.replace(LEADING_VIN_LABEL_REGEX, '');
  }

  // Some OCR rows contain text before "VIN: ..." on the same line.
  const inline = INLINE_VIN_LABEL_REGEX.exec(line);
  if (!inline) {
    return line;
  }

  const before = inline.index > 0 ? line[inline.index - 1] : ' ';
  if (/[A-Z0-9]/i.test(before)) {
    return line;
  }

  return line.slice(inline.index + inline[0].length).trim();
}

function scoreVin(params: {
  candidate: string;
  line: string;
  prevLine: string;
  nextLine: string;
  fromLabelStripped: boolean;
  normalizedLine: string;
  startIndex: number;
}): number {
  const {
    candidate,
    line,
    prevLine,
    nextLine,
    fromLabelStripped,
    normalizedLine,
    startIndex,
  } = params;

  let score = 100;
  if (VIN_KEYWORD_REGEX.test(line)) {
    score += 35;
  }
  if (VIN_KEYWORD_REGEX.test(prevLine) || VIN_KEYWORD_REGEX.test(nextLine)) {
    score += 20;
  }
  if (fromLabelStripped) {
    score += 35;
  }
  if (startsInsideVinLabel(normalizedLine, startIndex)) {
    score -= 70;
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

    const scanTargets: Array<{ normalized: string; fromLabelStripped: boolean }> = [];
    const normalized = normalizeLine(current);
    if (normalized) {
      scanTargets.push({ normalized, fromLabelStripped: false });
    }

    const stripped = stripLeadingVinLabel(current);
    const normalizedStripped = normalizeLine(stripped);
    if (normalizedStripped && normalizedStripped !== normalized) {
      scanTargets.push({ normalized: normalizedStripped, fromLabelStripped: true });
    }

    for (const target of scanTargets) {
      for (let start = 0; start <= target.normalized.length - 17; start += 1) {
        const maybeVin = target.normalized.slice(start, start + 17);
        if (!isValidVin17(maybeVin)) {
          continue;
        }
        candidates.push({
          vin: maybeVin,
          score: scoreVin({
            candidate: maybeVin,
            line: current,
            prevLine: prev,
            nextLine: next,
            fromLabelStripped: target.fromLabelStripped,
            normalizedLine: target.normalized,
            startIndex: start,
          }),
        });
      }
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

function isUsefulFallbackRun(run: string): boolean {
  if (run.length < 8) {
    return false;
  }
  if (/^V[1I]N/.test(run)) {
    return false;
  }
  const letters = (run.match(/[A-Z]/g) ?? []).length;
  const digits = (run.match(/[0-9]/g) ?? []).length;
  if (letters < 2 || digits < 3) {
    return false;
  }
  return true;
}

function sortFallbackRuns(a: string, b: string): number {
  if (b.length !== a.length) {
    return b.length - a.length;
  }
  const aDigits = (a.match(/[0-9]/g) ?? []).length;
  const bDigits = (b.match(/[0-9]/g) ?? []).length;
  if (bDigits !== aDigits) {
    return bDigits - aDigits;
  }
  return a.localeCompare(b);
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

  const strippedLines = lines.map((line) => stripLeadingVinLabel(line));
  const compactStripped = normalizeCompact(strippedLines.join(' '));
  const fullMatchesStripped = compactStripped.match(FULL_VIN_REGEX);
  if (fullMatchesStripped?.length) {
    return fullMatchesStripped[0];
  }

  const joined = lines.join(' ');
  const compact = normalizeCompact(joined);
  const fullMatches = compact.match(FULL_VIN_REGEX);
  if (fullMatches?.length) {
    return fullMatches[0];
  }

  const runs = normalizeForRuns(strippedLines.join(' '))
    .split(' ')
    .map((item) => item.trim())
    .filter(isUsefulFallbackRun);

  if (!runs.length) {
    return null;
  }

  runs.sort(sortFallbackRuns);
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
