import {
  GlossaryEntry,
  OcrHistoryItem,
  SearchResultItem,
  SessionMetadata,
  SubtitleSegment,
} from '@echo-lingo/contracts';
import { IDatabaseDriver } from '@echo-lingo/database/driver.js';

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

  // ==================== OCR History ====================

  public insertOcrHistoryItem(item: OcrHistoryItem): void {
    const stmt = this.driver.prepare(`
      INSERT OR REPLACE INTO ocr_history (
        id, created_at, ocr_provider, ocr_language, source_language, target_language,
        original_text, corrected_text, translated_text, confidence, duration_ms,
        session_type, image_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.createdAt,
      item.ocrProvider,
      item.ocrLanguage,
      item.sourceLanguage,
      item.targetLanguage,
      item.originalText,
      item.correctedText || null,
      item.translatedText,
      item.confidence,
      item.durationMs,
      item.sessionType || 'single',
      item.imageData || null,
      item.metadata ? JSON.stringify(item.metadata) : null
    );
  }

  public getOcrHistoryItem(id: string): OcrHistoryItem | null {
    const row = this.driver.prepare('SELECT * FROM ocr_history WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapOcrHistoryRow(row);
  }

  public getAllOcrHistory(limit = 100, offset = 0): OcrHistoryItem[] {
    const rows = this.driver
      .prepare('SELECT * FROM ocr_history ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as any[];
    return rows.map((r) => this.mapOcrHistoryRow(r));
  }

  public searchOcrHistory(query: string, limit = 100, offset = 0): OcrHistoryItem[] {
    const pattern = `%${query}%`;
    const rows = this.driver
      .prepare(`
        SELECT * FROM ocr_history
        WHERE original_text LIKE ? OR translated_text LIKE ? OR (corrected_text IS NOT NULL AND corrected_text LIKE ?)
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `)
      .all(pattern, pattern, pattern, limit, offset) as any[];
    return rows.map((r) => this.mapOcrHistoryRow(r));
  }

  public deleteOcrHistoryItem(id: string): void {
    this.driver.prepare('DELETE FROM ocr_history WHERE id = ?').run(id);
  }

  public clearAllOcrHistory(): void {
    this.driver.prepare('DELETE FROM ocr_history').run();
  }

  public pruneOldOcrHistory(retentionDays: number): number {
    if (retentionDays <= 0) return 0;
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const res = this.driver.prepare('DELETE FROM ocr_history WHERE created_at < ?').run(cutoffMs);
    return res.changes;
  }

  // ==================== Global Database Search ====================

  public searchDatabase(
    query: string,
    options?: { limit?: number; categories?: Array<'session' | 'segment' | 'ocr' | 'glossary'> }
  ): SearchResultItem[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const pattern = `%${trimmed}%`;
    const categories = new Set(options?.categories ?? ['session', 'segment', 'ocr', 'glossary']);
    const results: SearchResultItem[] = [];

    // 1. Sessions
    if (categories.has('session')) {
      try {
        const sessionRows = this.driver
          .prepare(
            `SELECT id, title, status, source_language, target_languages, created_at, segment_count
             FROM sessions
             WHERE title LIKE ? OR source_language LIKE ? OR target_languages LIKE ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(pattern, pattern, pattern, limit) as any[];

        for (const row of sessionRows) {
          const targets = JSON.parse(row.target_languages || '[]');
          results.push({
            id: `session:${row.id}`,
            category: 'session',
            title: row.title || 'Untitled Session',
            description: `${(row.source_language || 'auto').toUpperCase()} → ${targets.map((t: string) => t.toUpperCase()).join(', ')} • ${row.segment_count || 0} segments`,
            icon: 'FolderKanban',
            path: 'Sessions',
            badge: row.status === 'active' ? 'Active' : undefined,
            action: {
              type: 'open-session',
              payload: { sessionId: row.id },
            },
            metadata: { sessionId: row.id, createdAt: row.created_at },
          });
        }
      } catch {
        // Table may not have been created yet in test or error
      }
    }

    // 2. Subtitle Segments
    if (categories.has('segment')) {
      try {
        const segmentRows = this.driver
          .prepare(
            `SELECT s.id, s.session_id, s.original_text, s.translations, s.source_language, s.start_time, sess.title as session_title
             FROM subtitle_segments s
             LEFT JOIN sessions sess ON s.session_id = sess.id
             WHERE s.original_text LIKE ? OR s.translations LIKE ?
             ORDER BY s.created_at DESC LIMIT ?`
          )
          .all(pattern, pattern, limit) as any[];

        for (const row of segmentRows) {
          let transText = '';
          try {
            const parsed = JSON.parse(row.translations || '{}');
            transText = Object.values(parsed).filter(Boolean).join(' | ');
          } catch {
            transText = row.translations || '';
          }

          results.push({
            id: `segment:${row.id}`,
            category: 'session',
            title: row.original_text.length > 80 ? `${row.original_text.slice(0, 80)}…` : row.original_text,
            description: transText.length > 120 ? `${transText.slice(0, 120)}…` : transText,
            subtitle: `Session: ${row.session_title || row.session_id}`,
            icon: 'Captions',
            path: `Sessions > ${row.session_title || 'Session'}`,
            action: {
              type: 'open-session',
              payload: { sessionId: row.session_id, segmentId: row.id },
            },
            metadata: { sessionId: row.session_id, segmentId: row.id },
          });
        }
      } catch {
        // Fallback
      }
    }

    // 3. OCR History
    if (categories.has('ocr')) {
      try {
        const ocrRows = this.driver
          .prepare(
            `SELECT id, original_text, translated_text, corrected_text, ocr_provider, created_at
             FROM ocr_history
             WHERE original_text LIKE ? OR translated_text LIKE ? OR (corrected_text IS NOT NULL AND corrected_text LIKE ?)
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(pattern, pattern, pattern, limit) as any[];

        for (const row of ocrRows) {
          const mainText = (row.corrected_text || row.original_text || '').replace(/\s+/g, ' ').trim();
          const transText = (row.translated_text || '').replace(/\s+/g, ' ').trim();
          results.push({
            id: `ocr:${row.id}`,
            category: 'ocr',
            title: mainText.length > 80 ? `${mainText.slice(0, 80)}…` : mainText,
            description: transText.length > 120 ? `${transText.slice(0, 120)}…` : transText,
            icon: 'ScanText',
            path: 'OCR History',
            action: {
              type: 'navigate',
              payload: { page: 'history', ocrId: row.id },
            },
            metadata: { ocrId: row.id, createdAt: row.created_at },
          });
        }
      } catch {
        // Fallback
      }
    }

    // 4. Glossary
    if (categories.has('glossary')) {
      try {
        const glossaryRows = this.driver
          .prepare(
            `SELECT id, source_term, target_term, source_language, target_language, description
             FROM glossary
             WHERE source_term LIKE ? OR target_term LIKE ? OR (description IS NOT NULL AND description LIKE ?)
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(pattern, pattern, pattern, limit) as any[];

        for (const row of glossaryRows) {
          results.push({
            id: `glossary:${row.id}`,
            category: 'glossary',
            title: `${row.source_term} → ${row.target_term}`,
            description: row.description || `${(row.source_language || '').toUpperCase()} → ${(row.target_language || '').toUpperCase()}`,
            icon: 'BookA',
            path: 'Glossary',
            action: {
              type: 'navigate',
              payload: { page: 'providers', tab: 'glossary' },
            },
            metadata: { glossaryId: row.id },
          });
        }
      } catch {
        // Fallback
      }
    }

    return results.slice(0, limit);
  }

  // Helpers
  private mapOcrHistoryRow(r: any): OcrHistoryItem {
    return {
      id: r.id,
      createdAt: r.created_at,
      ocrProvider: r.ocr_provider,
      ocrLanguage: r.ocr_language,
      sourceLanguage: r.source_language,
      targetLanguage: r.target_language,
      originalText: r.original_text,
      correctedText: r.corrected_text || undefined,
      translatedText: r.translated_text,
      confidence: r.confidence,
      durationMs: r.duration_ms,
      sessionType: (r.session_type as 'single' | 'continuous') || 'single',
      imageData: r.image_data || undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    };
  }
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
