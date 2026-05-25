/**
 * Codeforces API client.
 *
 * Uses the public problemset.problems endpoint. No auth needed. The whole
 * problemset (~9000 problems) is one fetch; we cache it in memory for the
 * lifetime of the process.
 *
 * Docs: https://codeforces.com/apiHelp/methods#problemset.problems
 */

import type { Difficulty, Problem } from "@/types";
import { DIFFICULTY_RATING_RANGES } from "@/types";

interface CfProblem {
  contestId?: number;
  index: string;
  name: string;
  type: string;
  rating?: number;
  tags: string[];
}

interface CfProblemset {
  status: string;
  result: { problems: CfProblem[] };
}

let cache: CfProblem[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function fetchProblemset(): Promise<CfProblem[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;

  const res = await fetch("https://codeforces.com/api/problemset.problems", {
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) throw new Error(`Codeforces returned ${res.status}`);
  const data = (await res.json()) as CfProblemset;
  if (data.status !== "OK") throw new Error("Codeforces returned non-OK");

  cache = data.result.problems.filter((p) => p.rating && p.contestId);
  cacheTime = now;
  return cache;
}

/**
 * Pick a random problem matching the difficulty band. Optionally filter by
 * tags (e.g. ["dp", "graphs"]) to bias toward a pattern.
 */
export async function pickProblem(
  difficulty: Difficulty,
  opts: { tags?: string[]; exclude?: string[] } = {},
): Promise<CfProblem> {
  const all = await fetchProblemset();
  const [lo, hi] = DIFFICULTY_RATING_RANGES[difficulty];

  let pool = all.filter((p) => p.rating! >= lo && p.rating! <= hi);
  if (opts.tags && opts.tags.length > 0) {
    pool = pool.filter((p) => opts.tags!.some((t) => p.tags.includes(t)));
  }
  if (opts.exclude && opts.exclude.length > 0) {
    pool = pool.filter((p) => !opts.exclude!.includes(cfId(p)));
  }
  if (pool.length === 0) {
    throw new Error(`No Codeforces problem found for ${difficulty}`);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function cfId(p: CfProblem): string {
  return `cf-${p.contestId}-${p.index}`;
}

export function cfUrl(p: CfProblem): string {
  return `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
}

/**
 * Convert a Codeforces problem to our internal Problem shape.
 * We don't fetch the full statement (no API for that) — the user clicks
 * through to the Codeforces page. We do generate a stub for our own UI.
 */
export function toProblem(p: CfProblem, difficulty: Difficulty): Problem {
  return {
    id: cfId(p),
    source: "codeforces",
    title: `${p.contestId}${p.index}. ${p.name}`,
    difficulty,
    rating: p.rating!,
    tags: p.tags,
    statement:
      `**Codeforces problem.** Open the original statement on Codeforces ` +
      `to see input/output specs and constraints. Solve in Python; submit ` +
      `here to test against your own custom inputs (the contest grader ` +
      `runs your code with the inputs you paste).\n\n` +
      `[View on Codeforces](${cfUrl(p)})`,
    examples: [],
    url: cfUrl(p),
  };
}
