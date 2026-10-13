import { IDatabaseDriver } from '@echo-lingo/database/driver.js';

export interface Migration {
  id: number;
  name: string;
  up(driver: IDatabaseDriver): void;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    up(driver: IDatabaseDriver) {
      driver.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          source_language TEXT NOT NULL,
          target_languages TEXT NOT NULL, -- JSON array
          segment_count INTEGER NOT NULL DEFAULT 0,
          speech_provider TEXT NOT NULL,
          translation_provider TEXT NOT NULL,
          audio_source_type TEXT NOT NULL,
          audio_device_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

        CREATE TABLE IF NOT EXISTS subtitle_segments (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NOT NULL,
          original_text TEXT NOT NULL,
          translations TEXT NOT NULL, -- JSON object
          source_language TEXT NOT NULL,
          target_languages TEXT NOT NULL, -- JSON array
          status TEXT NOT NULL,
          confidence REAL,
          speech_provider TEXT NOT NULL,
          translation_provider TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_segments_session ON subtitle_segments(session_id, start_time ASC);

        CREATE TABLE IF NOT EXISTS glossary (
          id TEXT PRIMARY KEY,
          source_term TEXT NOT NULL,
          target_term TEXT NOT NULL,
          source_language TEXT NOT NULL,
          target_language TEXT NOT NULL,
          case_sensitive INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_glossary_lang ON glossary(source_language, target_language);

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    },
  },
  {
    id: 2,
    name: 'ocr_history_schema',
    up(driver: IDatabaseDriver) {
      driver.exec(`
        CREATE TABLE IF NOT EXISTS ocr_history (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          ocr_provider TEXT NOT NULL,
          ocr_language TEXT NOT NULL,
          source_language TEXT NOT NULL,
          target_language TEXT NOT NULL,
          original_text TEXT NOT NULL,
          corrected_text TEXT,
          translated_text TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 1,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          session_type TEXT NOT NULL DEFAULT 'single',
          image_data TEXT,
          metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_ocr_history_created_at ON ocr_history(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ocr_history_session_type ON ocr_history(session_type);
      `);
    },
  },
];

export function runMigrations(driver: IDatabaseDriver): void {
  // Ensure migrations tracking table exists
  driver.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = driver.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>;
  const appliedIds = new Set(appliedRows.map((r) => r.id));

  for (const migration of MIGRATIONS) {
    if (!appliedIds.has(migration.id)) {
      console.log(`Applying migration ${migration.id}: ${migration.name}`);
      migration.up(driver);
      driver.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        Date.now()
      );
    }
  }
}
