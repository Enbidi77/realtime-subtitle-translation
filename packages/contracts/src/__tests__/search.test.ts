import { describe, it, expect } from 'vitest';
import {
  SearchResultItemSchema,
  SearchDatabaseRequestSchema,
  SearchDatabaseResponseSchema,
  SearchResultCategorySchema,
} from '../search.js';

describe('Search Contracts & Zod Schemas', () => {
  it('validates SearchResultCategorySchema values', () => {
    expect(SearchResultCategorySchema.safeParse('navigation').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('command').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('settings').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('session').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('ocr').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('glossary').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('help').success).toBe(true);
    expect(SearchResultCategorySchema.safeParse('invalid_category').success).toBe(false);
  });

  it('validates SearchDatabaseRequestSchema', () => {
    const valid = {
      query: 'meeting notes',
      categories: ['session', 'ocr'],
      limit: 30,
    };
    const parsed = SearchDatabaseRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    // Empty query rejected
    expect(SearchDatabaseRequestSchema.safeParse({ query: '' }).success).toBe(false);

    // Limit out of range clamped or rejected
    expect(SearchDatabaseRequestSchema.safeParse({ query: 'ok', limit: 0 }).success).toBe(false);
    expect(SearchDatabaseRequestSchema.safeParse({ query: 'ok', limit: 101 }).success).toBe(false);
  });

  it('validates SearchResultItemSchema', () => {
    const validItem = {
      id: 'cmd:test',
      category: 'command',
      title: 'Start Listening',
      description: 'Begin real-time speech recognition',
      icon: 'Mic',
      path: 'Commands > Speech',
      action: {
        type: 'command',
        payload: { commandId: 'session:start' },
      },
      titleHighlights: [{ start: 0, end: 5 }],
    };

    const parsed = SearchResultItemSchema.safeParse(validItem);
    expect(parsed.success).toBe(true);

    // Missing action type rejected
    const invalidItem = { ...validItem, action: { type: 'unknown_type' } };
    expect(SearchResultItemSchema.safeParse(invalidItem).success).toBe(false);
  });

  it('validates SearchDatabaseResponseSchema', () => {
    const validResponse = {
      items: [
        {
          id: 'session:1',
          category: 'session',
          title: 'Daily Standup',
          icon: 'FolderKanban',
          action: { type: 'open-session', payload: { sessionId: '1' } },
        },
      ],
      durationMs: 12,
    };

    const parsed = SearchDatabaseResponseSchema.safeParse(validResponse);
    expect(parsed.success).toBe(true);
  });
});

