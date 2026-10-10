import { GlossaryEntry } from '@echo-lingo/contracts';

export class GlossaryEngine {
  private entries: GlossaryEntry[] = [];

  constructor(entries: GlossaryEntry[] = []) {
    this.entries = [...entries];
  }

  public setEntries(entries: GlossaryEntry[]): void {
    this.entries = [...entries];
  }

  public addEntry(entry: GlossaryEntry): void {
    this.entries.push(entry);
  }

  public removeEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  /**
   * Apply glossary replacements to text for a given language pair.
   * Matches terms considering word boundaries and case sensitivity.
   */
  public apply(text: string, sourceLang: string, targetLang: string): string {
    if (!text || this.entries.length === 0) return text;

    const matching = this.entries.filter(
      (e) =>
        (e.sourceLanguage === 'auto' || e.sourceLanguage.toLowerCase() === sourceLang.toLowerCase()) &&
        e.targetLanguage.toLowerCase() === targetLang.toLowerCase()
    );

    if (matching.length === 0) return text;

    let result = text;
    for (const entry of matching) {
      const flags = entry.caseSensitive ? 'g' : 'gi';
      // Escape special regex characters in sourceTerm
      const escaped = entry.sourceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      result = result.replace(regex, entry.targetTerm);
    }

    return result;
  }
}
