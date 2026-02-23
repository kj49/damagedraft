import * as FileSystem from 'expo-file-system/legacy';

import {
  DEFAULT_EXPORT_EMAIL,
  DEFAULT_RECIPIENTS,
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_ACCENT,
  DEFAULT_THEME_PRIMARY,
  getDb,
  initDb,
} from './db';
import {
  ExportReportData,
  ManufacturerGroup,
  PendingSendConfirmationItem,
  ReportCodeRow,
  ReportDetail,
  ReportEventType,
  ReportListItem,
  ReportPhotoRow,
  ReportRow,
  ReportStatus,
  SendStatus,
  SettingsRow,
} from '../types/models';

const REPORT_UPDATABLE_FIELDS = new Set([
  'status',
  'send_status',
  'vin_text',
  'make_text',
  'model_text',
  'unit_location',
  'manufacturer_group',
  'recipients',
  'notes',
] as const);

type ReportUpdateFields = Partial<
  Pick<
    ReportRow,
    | 'status'
    | 'send_status'
    | 'vin_text'
    | 'make_text'
    | 'model_text'
    | 'unit_location'
    | 'manufacturer_group'
    | 'recipients'
    | 'notes'
  >
>;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function deleteFileBestEffort(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort cleanup only
  }
}

export async function createReport(status: ReportStatus = 'incomplete'): Promise<ReportRow> {
  await initDb();
  const db = await getDb();
  const id = makeId('rpt');
  const now = Date.now();
  await db.runAsync(
    `
      INSERT INTO reports (
        id,
        status,
        send_status,
        created_at,
        updated_at,
        vin_text,
        make_text,
        model_text,
        unit_location,
        manufacturer_group,
        recipients,
        notes
      )
      VALUES (?, ?, ?, ?, ?, '', '', '', '', ?, ?, '')
    `,
    id,
    status,
    'none',
    now,
    now,
    'unknown',
    DEFAULT_RECIPIENTS
  );

  const row = await db.getFirstAsync<ReportRow>('SELECT * FROM reports WHERE id = ?', id);
  if (!row) {
    throw new Error('Failed to create report');
  }
  return row;
}

export async function quickDuplicateReport(sourceReportId: string): Promise<ReportRow> {
  await initDb();
  const db = await getDb();
  const source = await db.getFirstAsync<ReportRow>('SELECT * FROM reports WHERE id = ?', sourceReportId);
  if (!source) {
    throw new Error('Source report not found');
  }

  const id = makeId('rpt');
  const now = Date.now();
  await db.runAsync(
    `
      INSERT INTO reports (
        id,
        status,
        send_status,
        created_at,
        updated_at,
        vin_text,
        make_text,
        model_text,
        unit_location,
        manufacturer_group,
        recipients,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    'incomplete',
    'none',
    now,
    now,
    source.vin_text,
    source.make_text,
    source.model_text,
    source.unit_location,
    source.manufacturer_group,
    source.recipients,
    ''
  );

  const duplicated = await db.getFirstAsync<ReportRow>('SELECT * FROM reports WHERE id = ?', id);
  if (!duplicated) {
    throw new Error('Failed to duplicate report');
  }
  return duplicated;
}

export async function updateReportFields(id: string, fields: ReportUpdateFields): Promise<void> {
  await initDb();
  const db = await getDb();

  const entries = Object.entries(fields).filter(([, value]) => value !== undefined) as Array<
    [keyof ReportUpdateFields, ReportUpdateFields[keyof ReportUpdateFields]]
  >;

  const setParts: string[] = [];
  const values: Array<string | number> = [];

  for (const [key, value] of entries) {
    if (!REPORT_UPDATABLE_FIELDS.has(key)) {
      continue;
    }
    setParts.push(`${key} = ?`);
    values.push((value ?? '') as string | number);
  }

  setParts.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await db.runAsync(`UPDATE reports SET ${setParts.join(', ')} WHERE id = ?`, ...values);
}

export async function addCode(reportId: string, code: string): Promise<ReportCodeRow> {
  await initDb();
  const db = await getDb();
  const id = makeId('code');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO report_codes (id, report_id, code, created_at) VALUES (?, ?, ?, ?)`,
    id,
    reportId,
    code,
    now
  );

  const row = await db.getFirstAsync<ReportCodeRow>('SELECT * FROM report_codes WHERE id = ?', id);
  if (!row) {
    throw new Error('Failed to add code');
  }
  await updateReportFields(reportId, {});
  return row;
}

export async function removeCode(codeId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  const existing = await db.getFirstAsync<Pick<ReportCodeRow, 'report_id'>>(
    'SELECT report_id FROM report_codes WHERE id = ?',
    codeId
  );
  await db.runAsync('DELETE FROM report_codes WHERE id = ?', codeId);
  if (existing?.report_id) {
    await updateReportFields(existing.report_id, {});
  }
}

export async function addPhoto(reportId: string, uri: string, isVin: boolean): Promise<ReportPhotoRow> {
  await initDb();
  const db = await getDb();
  const id = makeId('photo');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO report_photos (id, report_id, uri, created_at, is_vin) VALUES (?, ?, ?, ?, ?)`,
    id,
    reportId,
    uri,
    now,
    isVin ? 1 : 0
  );
  const row = await db.getFirstAsync<ReportPhotoRow>('SELECT * FROM report_photos WHERE id = ?', id);
  if (!row) {
    throw new Error('Failed to add photo');
  }
  await updateReportFields(reportId, {});
  return row;
}

export async function removePhoto(photoId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<ReportPhotoRow>('SELECT * FROM report_photos WHERE id = ?', photoId);
  if (row) {
    await deleteFileBestEffort(row.uri);
    await db.runAsync('DELETE FROM report_photos WHERE id = ?', photoId);
    await updateReportFields(row.report_id, {});
  }
}

export async function listReports(status: ReportStatus): Promise<ReportListItem[]> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `
      SELECT
        r.*,
        (SELECT COUNT(1) FROM report_photos p WHERE p.report_id = r.id) AS photo_count,
        (SELECT COUNT(1) FROM report_codes c WHERE c.report_id = r.id) AS code_count,
        (
          SELECT CASE WHEN EXISTS(
            SELECT 1 FROM report_photos p2 WHERE p2.report_id = r.id AND p2.is_vin = 1
          ) THEN 1 ELSE 0 END
        ) AS has_vin_photo
      FROM reports r
      WHERE r.status = ?
      ORDER BY r.updated_at DESC
    `,
    status
  );

  return rows.map((row) => ({
    ...row,
    photo_count: Number(row.photo_count ?? 0),
    code_count: Number(row.code_count ?? 0),
    has_vin_photo: Number(row.has_vin_photo ?? 0),
  }));
}

async function insertReportEvent(reportId: string, eventType: ReportEventType): Promise<void> {
  const detail = await getReportDetail(reportId);
  if (!detail) {
    return;
  }
  const db = await getDb();
  const id = makeId('evt');
  const codesPipe = detail.codes.map((code) => code.code).join('|');
  await db.runAsync(
    `
      INSERT INTO report_events (
        id,
        report_id,
        event_type,
        event_at,
        vin_text,
        manufacturer_group,
        unit_location,
        codes_pipe
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    reportId,
    eventType,
    Date.now(),
    detail.vin_text,
    detail.manufacturer_group,
    detail.unit_location,
    codesPipe
  );
}

export async function getReportDetail(id: string): Promise<ReportDetail | null> {
  await initDb();
  const db = await getDb();
  const report = await db.getFirstAsync<ReportRow>('SELECT * FROM reports WHERE id = ?', id);
  if (!report) {
    return null;
  }
  const codes = await db.getAllAsync<ReportCodeRow>(
    'SELECT * FROM report_codes WHERE report_id = ? ORDER BY created_at ASC',
    id
  );
  const photos = await db.getAllAsync<ReportPhotoRow>(
    'SELECT * FROM report_photos WHERE report_id = ? ORDER BY created_at ASC',
    id
  );

  return {
    ...report,
    codes,
    photos,
  };
}

export async function markReportDraftOpened(reportId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
      UPDATE reports
      SET
        status = 'completed',
        send_status = 'pending_send_confirmation',
        updated_at = ?
      WHERE id = ?
    `,
    Date.now(),
    reportId
  );
  await insertReportEvent(reportId, 'draft_opened');
}

export async function markReportSentConfirmed(reportId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    `
      UPDATE reports
      SET
        send_status = 'sent_confirmed',
        updated_at = ?
      WHERE id = ?
    `,
    Date.now(),
    reportId
  );
  await insertReportEvent(reportId, 'sent_confirmed');
}

export async function listPendingSendConfirmations(): Promise<PendingSendConfirmationItem[]> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<PendingSendConfirmationItem>(
    `
      SELECT
        r.id,
        r.created_at,
        r.updated_at,
        r.vin_text,
        r.unit_location,
        r.manufacturer_group,
        COALESCE((SELECT group_concat(c.code, '|') FROM report_codes c WHERE c.report_id = r.id), '') AS codes_pipe
      FROM reports r
      WHERE r.send_status = 'pending_send_confirmation'
      ORDER BY r.updated_at DESC
    `
  );
  return rows;
}

export async function findDuplicateVinCodeMatch(params: {
  currentReportId: string;
  vinText: string;
  codes: string[];
}): Promise<{ report: ReportRow; overlappingCodes: string[] } | null> {
  await initDb();
  const db = await getDb();
  if (!params.vinText || params.codes.length === 0) {
    return null;
  }

  const reports = await db.getAllAsync<ReportRow>(
    `
      SELECT *
      FROM reports
      WHERE id != ? AND vin_text = ? AND status = 'completed'
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    params.currentReportId,
    params.vinText
  );

  const incoming = new Set(params.codes);
  for (const report of reports) {
    const previousCodes = await db.getAllAsync<{ code: string }>(
      'SELECT code FROM report_codes WHERE report_id = ?',
      report.id
    );
    const overlappingCodes = previousCodes
      .map((row) => row.code)
      .filter((code) => incoming.has(code));

    if (overlappingCodes.length > 0) {
      return { report, overlappingCodes };
    }
  }

  return null;
}

export async function deleteReport(id: string): Promise<void> {
  await initDb();
  const db = await getDb();
  const photos = await db.getAllAsync<Pick<ReportPhotoRow, 'uri'>>(
    'SELECT uri FROM report_photos WHERE report_id = ?',
    id
  );
  for (const photo of photos) {
    await deleteFileBestEffort(photo.uri);
  }
  await db.runAsync('DELETE FROM reports WHERE id = ?', id);
}

export async function countReportsByStatus(status: ReportStatus): Promise<number> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(1) AS count FROM reports WHERE status = ?',
    status
  );
  return Number(row?.count ?? 0);
}

export async function deleteAllReportsByStatus(status: ReportStatus): Promise<number> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM reports WHERE status = ?', status);
  for (const row of rows) {
    await deleteReport(row.id);
  }
  return rows.length;
}

export async function getSettings(): Promise<SettingsRow> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<Partial<SettingsRow>>('SELECT * FROM settings WHERE id = ?', 'singleton');
  if (!row) {
    const defaults: SettingsRow = {
      id: 'singleton',
      default_recipients: DEFAULT_RECIPIENTS,
      default_export_email: DEFAULT_EXPORT_EMAIL,
      theme_mode: DEFAULT_THEME_MODE as SettingsRow['theme_mode'],
      theme_primary: DEFAULT_THEME_PRIMARY,
      theme_accent: DEFAULT_THEME_ACCENT,
    };
    await db.runAsync(
      `
        INSERT INTO settings (id, default_recipients, default_export_email, theme_mode, theme_primary, theme_accent)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      defaults.id,
      defaults.default_recipients,
      defaults.default_export_email,
      defaults.theme_mode,
      defaults.theme_primary,
      defaults.theme_accent
    );
    return defaults;
  }

  return {
    id: 'singleton',
    default_recipients: row.default_recipients ?? DEFAULT_RECIPIENTS,
    default_export_email: row.default_export_email ?? DEFAULT_EXPORT_EMAIL,
    theme_mode: (row.theme_mode ?? DEFAULT_THEME_MODE) as SettingsRow['theme_mode'],
    theme_primary: row.theme_primary ?? DEFAULT_THEME_PRIMARY,
    theme_accent: row.theme_accent ?? DEFAULT_THEME_ACCENT,
  };
}

export async function updateSettings(partial: Partial<Omit<SettingsRow, 'id'>>): Promise<SettingsRow> {
  await initDb();
  const db = await getDb();
  const current = await getSettings();
  const next: SettingsRow = {
    ...current,
    ...partial,
    id: 'singleton',
  };

  await db.runAsync(
    `
      INSERT INTO settings (id, default_recipients, default_export_email, theme_mode, theme_primary, theme_accent)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        default_recipients = excluded.default_recipients,
        default_export_email = excluded.default_export_email,
        theme_mode = excluded.theme_mode,
        theme_primary = excluded.theme_primary,
        theme_accent = excluded.theme_accent
    `,
    next.id,
    next.default_recipients,
    next.default_export_email,
    next.theme_mode,
    next.theme_primary,
    next.theme_accent
  );

  return next;
}

export async function computeTop5Area(last30DaysMs: number): Promise<string[]> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<{ segment: string }>(
    `
      SELECT substr(rc.code, 1, 2) AS segment, COUNT(1) AS count
      FROM report_codes rc
      INNER JOIN reports r ON r.id = rc.report_id
      WHERE r.status = 'completed' AND r.updated_at >= ?
      GROUP BY segment
      ORDER BY count DESC, segment ASC
      LIMIT 5
    `,
    last30DaysMs
  );

  return rows.map((row) => row.segment);
}

export async function computeTop5Type(last30DaysMs: number): Promise<string[]> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<{ segment: string }>(
    `
      SELECT substr(rc.code, 4, 2) AS segment, COUNT(1) AS count
      FROM report_codes rc
      INNER JOIN reports r ON r.id = rc.report_id
      WHERE r.status = 'completed' AND r.updated_at >= ?
      GROUP BY segment
      ORDER BY count DESC, segment ASC
      LIMIT 5
    `,
    last30DaysMs
  );

  return rows.map((row) => row.segment);
}

export async function deletePhotosOlderThan(cutoffMs: number): Promise<number> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<ReportPhotoRow>(
    'SELECT * FROM report_photos WHERE created_at < ?',
    cutoffMs
  );

  for (const row of rows) {
    await deleteFileBestEffort(row.uri);
  }

  await db.runAsync('DELETE FROM report_photos WHERE created_at < ?', cutoffMs);
  return rows.length;
}

export async function deleteAllStoredPhotos(): Promise<number> {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<ReportPhotoRow, 'uri'>>('SELECT uri FROM report_photos');
  for (const row of rows) {
    await deleteFileBestEffort(row.uri);
  }
  await db.runAsync('DELETE FROM report_photos');
  return rows.length;
}

export async function listAllReportsForExport(): Promise<ExportReportData[]> {
  await initDb();
  const db = await getDb();
  const reports = await db.getAllAsync<ReportRow>('SELECT * FROM reports ORDER BY created_at DESC');
  const output: ExportReportData[] = [];

  for (const report of reports) {
    const codes = await db.getAllAsync<ReportCodeRow>(
      'SELECT * FROM report_codes WHERE report_id = ? ORDER BY created_at ASC',
      report.id
    );
    const photos = await db.getAllAsync<ReportPhotoRow>(
      'SELECT * FROM report_photos WHERE report_id = ? ORDER BY created_at ASC',
      report.id
    );
    output.push({ report, codes, photos });
  }

  return output;
}

export async function findVinPhoto(reportId: string): Promise<ReportPhotoRow | null> {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<ReportPhotoRow>(
    'SELECT * FROM report_photos WHERE report_id = ? AND is_vin = 1 ORDER BY created_at DESC LIMIT 1',
    reportId
  );
  return row ?? null;
}

export async function listPhotosForReport(reportId: string): Promise<ReportPhotoRow[]> {
  await initDb();
  const db = await getDb();
  return db.getAllAsync<ReportPhotoRow>(
    'SELECT * FROM report_photos WHERE report_id = ? ORDER BY created_at ASC',
    reportId
  );
}
