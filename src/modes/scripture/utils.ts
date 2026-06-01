import { DEFAULT_MOOD_CATEGORIES, SACRED_WORDS, type MoodCategory } from './constants';

export function detectMood(
  verseText: string,
  categories: MoodCategory[] = DEFAULT_MOOD_CATEGORIES
): string {
  const lower = verseText.toLowerCase();
  const wordSet = new Set(lower.match(/\b[a-z]+\b/g) ?? []);

  const scored = categories
    .filter((c) => c.id !== 'default')
    .map((c) => ({
      category: c,
      score: c.keywords.reduce((n, kw) => n + (wordSet.has(kw) || lower.includes(kw) ? 1 : 0), 0),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return scored[0].category.query;
  return categories.find((c) => c.id === 'default')?.query ?? 'peaceful nature serene landscape';
}

export interface VerseToken {
  text: string;
  highlight: boolean;
}

// Splits verse into word + non-word runs; marks sacred words for gold highlight
export function tokenizeVerse(verseText: string): VerseToken[] {
  const parts = verseText.match(/[A-Za-z']+|[^A-Za-z']+/g) ?? [verseText];
  return parts.map((part) => {
    const clean = part.replace(/[^a-z]/gi, '').toLowerCase();
    return { text: part, highlight: clean.length > 0 && SACRED_WORDS.has(clean) };
  });
}

// Picks a consistent index for today from a list — same pick all day, changes at midnight
export function daySeededIndex(length: number): number {
  if (length <= 1) return 0;
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return dayOfYear % length;
}
