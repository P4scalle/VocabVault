/**
 * Fuzzy string matching for quiz answers.
 * Uses Levenshtein distance + token overlap for flexible grading.
 */

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function tokenize(s: string): string[] {
  return normalize(s.toLowerCase()).replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = new Set(tokenize(b));
  if (tokensA.length === 0 || tokensB.size === 0) return 0;
  const matches = tokensA.filter((t) => tokensB.has(t)).length;
  return matches / Math.max(tokensA.length, tokensB.size);
}

export interface FuzzyResult {
  exact: boolean;
  close: boolean;
  similarity: number;
}

/**
 * Compare user input against the correct answer.
 * Returns { exact, close, similarity } where:
 * - exact: case-insensitive exact match
 * - close: within ~20% edit distance OR >60% token overlap
 * - similarity: 0-1 score (1 = perfect match)
 */
export function fuzzyMatch(input: string, answer: string): FuzzyResult {
  const a = normalize(input.trim().toLowerCase());
  const b = normalize(answer.trim().toLowerCase());

  if (a === b) return { exact: true, close: true, similarity: 1 };
  if (!a || !b) return { exact: false, close: false, similarity: 0 };

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const editSimilarity = 1 - dist / maxLen;
  const tokenSim = tokenOverlap(a, b);
  const similarity = Math.max(editSimilarity, tokenSim);
  const close = editSimilarity >= 0.8 || tokenSim >= 0.6;

  return { exact: false, close, similarity };
}
