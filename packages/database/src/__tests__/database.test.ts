import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeSqliteDriver, runMigrations, DatabaseRepository } from '@echo-lingo/database';
import { SessionMetadata, SubtitleSegment, GlossaryEntry } from '@echo-lingo/contracts';

describe('Database Module', () => {
  let driver: NodeSqliteDriver;
  let repo: DatabaseRepository;

  beforeEach(() => {
    driver = new NodeSqliteDriver(':memory:');
    runMigrations(driver);
    repo = new DatabaseRepository(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('runs migrations and creates tables successfully', () => {
    // Calling runMigrations a second time should be idempotent
    expect(() => runMigrations(driver)).not.toThrow();
  });

  it('creates, retrieves, and updates sessions', () => {
    const session: SessionMetadata = {
      id: 'sess-100',
      title: 'English to Vietnamese Meeting',
      status: 'active',
      createdAt: 10000,
      updatedAt: 10000,
      durationSeconds: 120,
      sourceLanguage: 'en',
      targetLanguages: ['vi'],
      segmentCount: 0,
      speechProvider: 'whisper-local',
      translationProvider: 'google-web',
      audioSourceType: 'microphone',
    };

    repo.createSession(session);
    const retrieved = repo.getSession('sess-100');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('English to Vietnamese Meeting');
    expect(retrieved?.targetLanguages).toEqual(['vi']);

    // Update session
    repo.updateSession('sess-100', { title: 'Updated Title', durationSeconds: 240 });
    const updated = repo.getSession('sess-100');
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.durationSeconds).toBe(240);
  });

  it('persists and retrieves subtitle segments belonging to session', () => {
    const session: SessionMetadata = {
      id: 'sess-200',
      title: 'Lecture',
      status: 'active',
      createdAt: 1000,
      updatedAt: 1000,
      durationSeconds: 0,
      sourceLanguage: 'en',
      targetLanguages: ['vi'],
      segmentCount: 0,
      speechProvider: 'whisper',
      translationProvider: 'google',
      audioSourceType: 'microphone',
    };
    repo.createSession(session);

    const segment: SubtitleSegment = {
      id: 'seg-1',
      sessionId: 'sess-200',
      startTime: 0,
      endTime: 2500,
      originalText: 'Welcome everyone',
      translations: { vi: 'Chào mừng mọi người' },
      sourceLanguage: 'en',
      targetLanguages: ['vi'],
      status: 'final',
      confidence: 0.98,
      speechProvider: 'whisper',
      translationProvider: 'google',
      createdAt: 1000,
      updatedAt: 1000,
    };

    repo.insertSegment(segment);
    const segments = repo.getSegmentsBySessionId('sess-200');
    expect(segments).toHaveLength(1);
    expect(segments[0].originalText).toBe('Welcome everyone');
    expect(segments[0].translations.vi).toBe('Chào mừng mọi người');

    // Check that session segmentCount was updated
    const sess = repo.getSession('sess-200');
    expect(sess?.segmentCount).toBe(1);
  });

  it('manages glossary entries', () => {
    const entry: GlossaryEntry = {
      id: 'gloss-1',
      sourceTerm: 'API',
      targetTerm: 'Giao diện lập trình ứng dụng',
      sourceLanguage: 'en',
      targetLanguage: 'vi',
      caseSensitive: true,
      description: 'Tech term',
      createdAt: Date.now(),
    };

    repo.addGlossaryEntry(entry);
    const list = repo.getGlossary();
    expect(list).toHaveLength(1);
    expect(list[0].sourceTerm).toBe('API');

    repo.deleteGlossaryEntry('gloss-1');
    expect(repo.getGlossary()).toHaveLength(0);
  });

  it('saves and reads app settings', () => {
    repo.setSetting('theme', 'dark');
    expect(repo.getSetting('theme', 'light')).toBe('dark');
    expect(repo.getSetting('non_existing', 'fallback')).toBe('fallback');
  });

  it('manages OCR history persistence, search, and deletion', () => {
    const item1 = {
      id: 'ocr-1',
      createdAt: 1000,
      ocrProvider: 'windows-native',
      ocrLanguage: 'en',
      sourceLanguage: 'en',
      targetLanguage: 'vi',
      originalText: 'Press start to begin the game',
      correctedText: 'Press Start to begin the game',
      translatedText: 'Nhấn Bắt đầu để vào trò chơi',
      confidence: 0.95,
      durationMs: 42,
      sessionType: 'single' as const,
    };

    const item2 = {
      id: 'ocr-2',
      createdAt: 2000,
      ocrProvider: 'tesseract',
      ocrLanguage: 'ja',
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      originalText: 'ゲームオーバー',
      translatedText: 'Game Over',
      confidence: 0.99,
      durationMs: 120,
      sessionType: 'continuous' as const,
    };

    repo.insertOcrHistoryItem(item1);
    repo.insertOcrHistoryItem(item2);

    expect(repo.getOcrHistoryItem('ocr-1')?.originalText).toBe('Press start to begin the game');
    expect(repo.getOcrHistoryItem('ocr-1')?.correctedText).toBe('Press Start to begin the game');
    expect(repo.getOcrHistoryItem('ocr-2')?.translatedText).toBe('Game Over');

    const all = repo.getAllOcrHistory();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('ocr-2'); // ordered by created_at DESC

    const searchRes = repo.searchOcrHistory('Game Over');
    expect(searchRes).toHaveLength(1);
    expect(searchRes[0].id).toBe('ocr-2');

    repo.deleteOcrHistoryItem('ocr-1');
    expect(repo.getAllOcrHistory()).toHaveLength(1);

    repo.clearAllOcrHistory();
    expect(repo.getAllOcrHistory()).toHaveLength(0);
  });
});
