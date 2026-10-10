import { SubtitleSegment } from '@echo-lingo/contracts';

export class SubtitleTimeline {
  private segments: SubtitleSegment[] = [];
  private activePartial: SubtitleSegment | null = null;
  private maxRetention: number;

  constructor(initialSegments: SubtitleSegment[] = [], maxRetention = 5000) {
    this.segments = [...initialSegments];
    this.maxRetention = maxRetention;
  }

  /**
   * Set or update the current active streaming partial segment
   */
  public updatePartial(partial: SubtitleSegment): void {
    if (partial.status !== 'partial') {
      this.addFinal(partial);
      return;
    }
    this.activePartial = { ...partial };
  }

  /**
   * Finalize the current active partial or add a new final segment
   */
  public addFinal(segment: SubtitleSegment): void {
    const finalSegment: SubtitleSegment = {
      ...segment,
      status: 'final',
      updatedAt: Date.now(),
    };

    // If an active partial matches this text or time range, clear it
    if (this.activePartial && this.activePartial.id === finalSegment.id) {
      this.activePartial = null;
    }

    // Deduplication check: check last segment for near-identical duplicate
    const last = this.segments[this.segments.length - 1];
    if (
      last &&
      last.originalText.trim().toLowerCase() === finalSegment.originalText.trim().toLowerCase() &&
      Math.abs(last.startTime - finalSegment.startTime) < 1500
    ) {
      // Merge translations if any
      last.translations = { ...last.translations, ...finalSegment.translations };
      last.endTime = Math.max(last.endTime, finalSegment.endTime);
      last.updatedAt = Date.now();
      return;
    }

    this.segments.push(finalSegment);

    // Prune if retention limit exceeded
    if (this.segments.length > this.maxRetention) {
      this.segments = this.segments.slice(this.segments.length - this.maxRetention);
    }
  }

  /**
   * Clear active partial
   */
  public clearPartial(): void {
    this.activePartial = null;
  }

  /**
   * Return all finalized segments, optionally including the currently active partial
   */
  public getSegments(includeActivePartial = true): SubtitleSegment[] {
    if (includeActivePartial && this.activePartial) {
      return [...this.segments, this.activePartial];
    }
    return [...this.segments];
  }

  /**
   * Find a segment by ID
   */
  public getSegmentById(id: string): SubtitleSegment | undefined {
    if (this.activePartial && this.activePartial.id === id) {
      return this.activePartial;
    }
    return this.segments.find((s) => s.id === id);
  }

  /**
   * Update text or translation of a segment
   */
  public updateSegment(id: string, updates: Partial<SubtitleSegment>): boolean {
    const index = this.segments.findIndex((s) => s.id === id);
    if (index === -1) return false;

    this.segments[index] = {
      ...this.segments[index],
      ...updates,
      updatedAt: Date.now(),
    };
    return true;
  }

  /**
   * Delete a segment by ID
   */
  public deleteSegment(id: string): boolean {
    const index = this.segments.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.segments.splice(index, 1);
    return true;
  }

  /**
   * Search segments by query string across original and translations
   */
  public search(query: string): SubtitleSegment[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getSegments(false);

    return this.segments.filter((s) => {
      if (s.originalText.toLowerCase().includes(q)) return true;
      for (const trans of Object.values(s.translations)) {
        if (trans.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }

  /**
   * Export all text as a single concatenated transcript
   */
  public getFullTranscript(options?: { includeTranslation?: boolean; targetLanguage?: string }): string {
    const includeTranslation = options?.includeTranslation ?? true;
    const targetLang = options?.targetLanguage;

    return this.segments
      .map((s) => {
        let line = s.originalText;
        if (includeTranslation) {
          const trans = targetLang
            ? s.translations[targetLang]
            : Object.values(s.translations)[0];
          if (trans) {
            line += ` (${trans})`;
          }
        }
        return line;
      })
      .join('\n');
  }

  /**
   * Clear all segments
   */
  public clear(): void {
    this.segments = [];
    this.activePartial = null;
  }

  public get count(): number {
    return this.segments.length;
  }
}
