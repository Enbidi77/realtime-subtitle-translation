import { z } from 'zod';

export const SearchResultCategorySchema = z.enum([
  'navigation',
  'command',
  'settings',
  'session',
  'ocr',
  'glossary',
  'help',
]);

export type SearchResultCategory = z.infer<typeof SearchResultCategorySchema>;

export const SearchActionTypeSchema = z.enum([
  'navigate',
  'command',
  'open-session',
  'setting',
  'copy',
  'link',
]);

export type SearchActionType = z.infer<typeof SearchActionTypeSchema>;

export const SearchActionSchema = z.object({
  type: SearchActionTypeSchema,
  payload: z.record(z.string(), z.any()).optional(),
});

export type SearchAction = z.infer<typeof SearchActionSchema>;

export const SearchHighlightRangeSchema = z.object({
  start: z.number(),
  end: z.number(),
});

export type SearchHighlightRange = z.infer<typeof SearchHighlightRangeSchema>;

export const SearchResultItemSchema = z.object({
  id: z.string(),
  category: SearchResultCategorySchema,
  title: z.string(),
  description: z.string().optional(),
  subtitle: z.string().optional(),
  icon: z.string(), // Name of Lucide icon e.g. "LayoutDashboard", "Settings", etc.
  path: z.string().optional(), // Breadcrumb or location e.g. "Settings > Audio"
  badge: z.string().optional(),
  shortcut: z.string().optional(), // e.g. "Ctrl+Shift+O"
  keywords: z.array(z.string()).optional(),
  score: z.number().optional(),
  action: SearchActionSchema,
  titleHighlights: z.array(SearchHighlightRangeSchema).optional(),
  descHighlights: z.array(SearchHighlightRangeSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

export const SearchDatabaseRequestSchema = z.object({
  query: z.string().min(1).max(200),
  categories: z.array(z.enum(['session', 'segment', 'ocr', 'glossary'])).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type SearchDatabaseRequest = z.infer<typeof SearchDatabaseRequestSchema>;

export const SearchDatabaseResponseSchema = z.object({
  items: z.array(SearchResultItemSchema),
  durationMs: z.number(),
});

export type SearchDatabaseResponse = z.infer<typeof SearchDatabaseResponseSchema>;

