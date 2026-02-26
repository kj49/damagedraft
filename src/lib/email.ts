import * as MailComposer from 'expo-mail-composer';

export function parseRecipients(value: string): string[] {
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildDraftSubject(vinText: string, unitLocation: string): string {
  const vin = vinText.trim();
  const location = unitLocation.trim();
  if (!location) {
    return `VIN ${vin} - Damage Report`;
  }
  return `VIN ${vin} - ${location} - Damage Report`;
}

export function buildDraftBody(params: {
  vinText: string;
  makeText: string;
  modelText: string;
  colorText: string;
  codes: string[];
  unitLocation: string;
  notes: string;
  photoCount: number;
}): string {
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return [
    `VIN: ${params.vinText || ''}`,
    `Make/Model: ${[params.makeText, params.modelText].filter(Boolean).join(' / ')}`,
    `Color: ${params.colorText || ''}`,
    `Location: ${params.unitLocation || ''}`,
    `Codes: ${params.codes.length ? params.codes.join(', ') : ''}`,
    `Notes: ${params.notes || ''}`,
    `Photos: ${params.photoCount}`,
    `Date: ${formattedDate}`,
    '',
    '---------------------',
  ].join('\n');
}

export async function openEmailDraft(options: {
  recipientsText: string;
  vinText: string;
  makeText: string;
  modelText: string;
  colorText: string;
  unitLocation: string;
  notes: string;
  codes: string[];
  photoCount: number;
  attachments: string[];
}): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    throw new Error('No email composer available on this device.');
  }

  const recipients = parseRecipients(options.recipientsText);
  const subject = buildDraftSubject(options.vinText, options.unitLocation);
  const body = buildDraftBody({
    vinText: options.vinText,
    makeText: options.makeText,
    modelText: options.modelText,
    colorText: options.colorText,
    codes: options.codes,
    unitLocation: options.unitLocation,
    notes: options.notes,
    photoCount: options.photoCount,
  });

  await MailComposer.composeAsync({
    recipients,
    subject,
    body,
    attachments: options.attachments,
  });
}
