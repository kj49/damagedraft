import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';

import { listAllReportsForExport } from '../db/queries';

function toPlainDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toExcelTextFormula(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `="${escaped}"`;
}

async function writeCacheFile(fileName: string, content: string): Promise<string> {
  const base = FileSystem.cacheDirectory ?? '';
  const uri = `${base}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

async function shareFile(uri: string, mimeType: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Share sheet is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: 'Export DamageDraft Logs',
  });
}

function buildCsvContent(data: Awaited<ReturnType<typeof listAllReportsForExport>>): string {
  const header = [
    'created_at',
    'vin_text',
    'unit_location',
    'make_model',
    'recipients',
    'codes_text',
    'notes',
    'photo_count',
    'has_vin_photo',
  ];

  const lines = [header.join(',')];

  for (const item of data) {
    const codes = item.codes.map((code) => code.code).join('|');
    const notesSingleLine = item.report.notes.replace(/\r?\n+/g, ' ').trim();
    const makeModel = [item.report.make_text, item.report.model_text].filter(Boolean).join(' / ');
    const photoCount = item.photos.length;
    const hasVin = item.photos.some((photo) => photo.is_vin === 1) ? 1 : 0;

    const row = [
      escapeCsv(toPlainDate(item.report.created_at)),
      escapeCsv(item.report.vin_text),
      escapeCsv(item.report.unit_location),
      escapeCsv(makeModel),
      escapeCsv(item.report.recipients),
      escapeCsv(toExcelTextFormula(codes)),
      escapeCsv(notesSingleLine),
      String(photoCount),
      String(hasVin),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function buildPlainTextContent(data: Awaited<ReturnType<typeof listAllReportsForExport>>): string {
  return data
    .map((item) => {
      const hasVin = item.photos.some((photo) => photo.is_vin === 1);
      const codesSection = item.codes.length
        ? item.codes.map((code) => `- ${code.code}`).join('\n')
        : '- (none)';

      return [
        `Report Date: ${toPlainDate(item.report.created_at)}`,
        `VIN: ${item.report.vin_text || ''}`,
        `Location: ${item.report.unit_location || ''}`,
        `Make/Model: ${[item.report.make_text, item.report.model_text].filter(Boolean).join(' / ')}`,
        `Recipients: ${item.report.recipients || ''}`,
        'Codes:',
        codesSection,
        'Notes:',
        item.report.notes || '',
        `Photos: ${item.photos.length} (VIN photo: ${hasVin ? 'yes' : 'no'})`,
      ].join('\n');
    })
    .join('\n\n\n');
}

export async function exportLogsCsv(): Promise<void> {
  const data = await listAllReportsForExport();
  const content = buildCsvContent(data);
  const uri = await writeCacheFile(`damagedraft_logs_${Date.now()}.csv`, content);
  await shareFile(uri, 'text/csv');
}

export async function exportLogsText(): Promise<void> {
  const data = await listAllReportsForExport();
  const content = buildPlainTextContent(data);
  const uri = await writeCacheFile(`damagedraft_logs_${Date.now()}.txt`, content);
  await shareFile(uri, 'text/plain');
}

export async function emailExportFile(defaultEmail: string, format: 'csv' | 'txt'): Promise<void> {
  const recipient = defaultEmail.trim();
  if (!recipient) {
    throw new Error('Default export email is not set.');
  }

  const data = await listAllReportsForExport();
  const isCsv = format === 'csv';
  const content = isCsv ? buildCsvContent(data) : buildPlainTextContent(data);
  const uri = await writeCacheFile(
    `damagedraft_logs_${Date.now()}.${isCsv ? 'csv' : 'txt'}`,
    content
  );

  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    throw new Error('No email composer available on this device.');
  }

  await MailComposer.composeAsync({
    recipients: [recipient],
    subject: `DamageDraft Logs Export (${format.toUpperCase()})`,
    body: 'Exported logs are attached.',
    attachments: [uri],
  });
}
