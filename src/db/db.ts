import * as SQLite from 'expo-sqlite';

export const DEFAULT_RECIPIENTS = 'claims@railyard.local;damage@railyard.local';
export const DEFAULT_EXPORT_EMAIL = '';
export const DEFAULT_THEME_PRIMARY = '#1565C0';
export const DEFAULT_THEME_ACCENT = '#42A5F5';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

async function columnExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const exists = await columnExists(db, table, column);
  if (!exists) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('damagedraft.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

export async function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('incomplete', 'completed')),
          send_status TEXT NOT NULL DEFAULT 'none',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          vin_text TEXT NOT NULL DEFAULT '',
          unit_location TEXT NOT NULL DEFAULT '',
          manufacturer_group TEXT NOT NULL DEFAULT 'unknown',
          recipients TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS report_codes (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL,
          code TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS report_photos (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          is_vin INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY NOT NULL,
          default_recipients TEXT NOT NULL DEFAULT '',
          default_export_email TEXT NOT NULL DEFAULT '',
          theme_primary TEXT NOT NULL DEFAULT '',
          theme_accent TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS report_events (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_at INTEGER NOT NULL,
          vin_text TEXT NOT NULL DEFAULT '',
          manufacturer_group TEXT NOT NULL DEFAULT 'unknown',
          unit_location TEXT NOT NULL DEFAULT '',
          codes_pipe TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_report_codes_code ON report_codes(code);
        CREATE INDEX IF NOT EXISTS idx_report_photos_created_at ON report_photos(created_at);
        CREATE INDEX IF NOT EXISTS idx_report_events_type_at ON report_events(event_type, event_at);
        CREATE INDEX IF NOT EXISTS idx_reports_send_status ON reports(send_status);
      `);

      await ensureColumn(db, 'reports', 'send_status', "TEXT NOT NULL DEFAULT 'none'");
      await ensureColumn(db, 'reports', 'manufacturer_group', "TEXT NOT NULL DEFAULT 'unknown'");

      await db.execAsync(`
        UPDATE reports
        SET send_status = CASE
          WHEN status = 'completed' THEN 'pending_send_confirmation'
          ELSE 'none'
        END
        WHERE send_status IS NULL OR send_status = '';

        UPDATE reports
        SET manufacturer_group = 'unknown'
        WHERE manufacturer_group IS NULL OR manufacturer_group = '';
      `);

      await db.runAsync(
        `
          INSERT INTO settings (id, default_recipients, default_export_email, theme_primary, theme_accent)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `,
        'singleton',
        DEFAULT_RECIPIENTS,
        DEFAULT_EXPORT_EMAIL,
        DEFAULT_THEME_PRIMARY,
        DEFAULT_THEME_ACCENT
      );
    })();
  }

  return initPromise;
}
