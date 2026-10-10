import {
  GlossaryEntry,
  SessionMetadata,
  SubtitleSegment,
} from '@echo-lingo/contracts';
import { IDatabaseDriver } from './driver.js';

export class DatabaseRepository {
  private driver: IDatabaseDriver;

  constructor(driver: IDatabaseDriver) {
    this.driver = driver;
  }

  // ==================== Sessions ====================

  public createSession(session: SessionMetadata): void {
    const stmt = this.driver.prepare(`
      INSERT INTO sessions (
        id, title, status, created_at, updated_at, duration_seconds,
        source_language, target_languages, segment_count,
        speech_provider, translation_provider, audio_source_type, audio_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.title,
      session.status,
      session.createdAt,
      session.updatedAt,
      session.durationSeconds,
      session.sourceLanguage,
      JSON.stringify(session.targetLanguages),
      session.segmentCount,
      session.speechProvider,
      session.translationProvider,
      session.audioSourceType,
      session.audioDeviceId || null
    );
  }

  public getSession(id: string): SessionMetadata | null {
    const row = this.driver.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapSessionRow(row);
  }

  public getAllSessions(limit = 100, offset = 0): SessionMetadata[] {
    const rows = this.driver
      .prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as any[];
    return rows.map((r) => this.mapSessionRow(r));
  }

  public updateSession(id: string, updates: Partial<SessionMetadata>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.durationSeconds !== undefined) {
      fields.push('duration_seconds = ?');
      values.push(updates.durationSeconds);
    }
    if (updates.segmentCount !== undefined) {
      fields.push('segment_count = ?');
      values.push(updates.segmentCount);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.driver.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  public deleteSession(id: string): void {
    this.driver.prepare('DELETE FROM subtitle_segments WHERE session_id = ?').run(id);
    this.driver.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // ==================== Subtitle Segments ====================

  public insertSegment(segment: SubtitleSegment): void {
    const stmt = this.driver.prepare(`
      INSERT OR REPLACE INTO subtitle_segments (
        id, session_id, start_time, end_time, original_text,
        translations, source_language, target_languages, status,
        confidence, speech_provider, translation_provider, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      segment.id,
      segment.sessionId,
      segment.startTime,
      segment.endTime,
      segment.originalText,
      JSON.stringify(segment.translations),
      segment.sourceLanguage,
      JSON.stringify(segment.targetLanguages),
      segment.status,
      segment.confidence ?? 1.0,
      segment.speechProvider,
      segment.translationProvider,
      segment.createdAt,
      segment.updatedAt
    );

    // Update segment count on session
    this.driver
      .prepare(
        'UPDATE sessions SET segment_count = (SELECT COUNT(*) FROM subtitle_segments WHERE session_id = ?), updated_at = ? WHERE id = ?'
      )
      .run(segment.sessionId, Date.now(), segment.sessionId);
  }

  public getSegmentsBySessionId(sessionId: string): SubtitleSegment[] {
    const rows = this.driver
      .prepare('SELECT * FROM subtitle_segments WHERE session_id = ? ORDER BY start_time ASC')
      .all(sessionId) as any[];
    return rows.map((r) => this.mapSegmentRow(r));
  }

  public updateSegment(id: string, updates: Partial<SubtitleSegment>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.originalText !== undefined) {
      fields.push('original_text = ?');
      values.push(updates.originalText);
    }
    if (updates.translations !== undefined) {
      fields.push('translations = ?');
      values.push(JSON.stringify(updates.translations));
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.driver
      .prepare(`UPDATE subtitle_segments SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  public deleteSegment(id: string): void {
    this.driver.prepare('DELETE FROM subtitle_segments WHERE id = ?').run(id);
  }

  // ==================== Glossary ====================

  public getGlossary(): GlossaryEntry[] {
    const rows = this.driver.prepare('SELECT * FROM glossary ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      sourceTerm: r.source_term,
      targetTerm: r.target_term,
      sourceLanguage: r.source_language,
      targetLanguage: r.target_language,
      caseSensitive: Boolean(r.case_sensitive),
      description: r.description || undefined,
      createdAt: r.created_at,
    }));
  }

  public addGlossaryEntry(entry: GlossaryEntry): void {
    const stmt = this.driver.prepare(`
      INSERT OR REPLACE INTO glossary (
        id, source_term, target_term, source_language, target_language,
        case_sensitive, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.sourceTerm,
      entry.targetTerm,
      entry.sourceLanguage,
      entry.targetLanguage,
      entry.caseSensitive ? 1 : 0,
      entry.description || null,
      entry.createdAt
    );
  }

  public deleteGlossaryEntry(id: string): void {
    this.driver.prepare('DELETE FROM glossary WHERE id = ?').run(id);
  }

  // ==================== App Settings ====================

  public getSetting<T>(key: string, defaultValue: T): T {
    const row = this.driver.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  public setSetting(key: string, value: unknown): void {
    this.driver
      .prepare(
        'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)'
      )
      .run(key, JSON.stringify(value), Date.now());
  }

  // ==================== Pruning & Maintenance ====================

  public pruneOldSessions(retentionDays: number): number {
    if (retentionDays <= 0) return 0;
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    // Delete segments first
    this.driver.prepare(`
      DELETE FROM subtitle_segments
      WHERE session_id IN (SELECT id FROM sessions WHERE created_at < ?)
    `).run(cutoffMs);

    const res = this.driver.prepare('DELETE FROM sessions WHERE created_at < ?').run(cutoffMs);
    return res.changes;
  }

  // Helpers
  private mapSessionRow(r: any): SessionMetadata {
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      durationSeconds: r.duration_seconds,
      sourceLanguage: r.source_language,
      targetLanguages: JSON.parse(r.target_languages || '[]'),
      segmentCount: r.segment_count,
      speechProvider: r.speech_provider,
      translationProvider: r.translation_provider,
      audioSourceType: r.audio_source_type,
      audioDeviceId: r.audio_device_id || undefined,
    };
  }

  private mapSegmentRow(r: any): SubtitleSegment {
    return {
      id: r.id,
      sessionId: r.session_id,
      startTime: r.start_time,
      endTime: r.end_time,
      originalText: r.original_text,
      translations: JSON.parse(r.translations || '{}'),
      sourceLanguage: r.source_language,
      targetLanguages: JSON.parse(r.target_languages || '[]'),
      status: r.status,
      confidence: r.confidence,
      speechProvider: r.speech_provider,
      translationProvider: r.translation_provider,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
