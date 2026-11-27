/* Azm — Arabic/English text normalization + keyword tokenization.
 * Ported and adapted from azm-ai v0.2.2 (packages/shared/src/text.ts). */

const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const AR_STOPWORDS = new Set([
  "من", "في", "على", "عن", "الى", "إلى", "مع", "هذا", "هذه", "ذلك", "التي", "الذي",
  "و", "ثم", "أو", "او", "لا", "ما", "إن", "أن", "قد", "كان", "كانت", "يكون", "بين",
  "عند", "كل", "بعض", "هناك", "هل", "لكي", "حتى", "ايضا", "أيضا", "دراسة", "درس",
]);

const EN_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "with", "and", "or", "my", "me",
  "i", "is", "are", "was", "be", "this", "that", "it", "at", "by", "from", "as",
  "study", "lesson", "class", "review", "understand", "watch", "learn",
]);

export function normalizeArabic(s: string): string {
  return s
    .replace(AR_DIACRITICS, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .toLowerCase();
}

export function normalizeToken(t: string): string {
  const n = normalizeArabic(t);
  if (/^[\u0600-\u06FF]/.test(n) && n.startsWith("\u0627\u0644") && n.length > 4) {
    return n.slice(2);
  }
  return n;
}

export function tokenize(text: string): string[] {
  const cleaned = text
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\u060C\u061B\u061F.,:;!?"'()\u2013\u2014/\\|[\]{}<>\u00AB\u00BB\u2026%*+=~#@$^&_]/g, " ");
  return cleaned
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 3)
    .filter((t) => !AR_STOPWORDS.has(t) && !EN_STOPWORDS.has(t));
}

export function keywordOverlap(goalTokens: string[], titleTokens: string[]): { matched: string[]; ratio: number } {
  const titleSet = new Set(titleTokens);
  const matched = new Set<string>();
  for (const g of goalTokens) {
    if (titleSet.has(g)) matched.add(g);
  }
  return { matched: [...matched], ratio: goalTokens.length ? matched.size / goalTokens.length : 0 };
}
