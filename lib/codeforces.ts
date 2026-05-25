/**
 * Codeforces problem bank — bundled subset of open-r1/codeforces from
 * Hugging Face (CC-BY-4.0).
 *
 * The dataset has full problem statements, examples, and official tests.
 * We pre-fetched ~700 problems across difficulty bands via
 * scripts/fetch-problems.mjs and bundled them into public/data/cf-*.json.
 * At runtime we read from those JSON files — no live API call to
 * Codeforces, no Cloudflare worries, no rate limits, statements + judge
 * tests work for every problem.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Difficulty, Problem } from "@/types";

interface BundledProblem {
  id: string;
  contestId: string;
  index: string;
  title: string;
  rating: number;
  tags: string[];
  timeLimit: number | null;
  memoryLimit: number | null;
  statement: string;
  examples: { input: string; expected: string }[];
  hiddenTests: { input: string; expected: string }[];
  url: string;
}

const cache: Partial<Record<Difficulty, BundledProblem[]>> = {};

async function loadBand(difficulty: Difficulty): Promise<BundledProblem[]> {
  if (cache[difficulty]) return cache[difficulty]!;
  const file = path.join(process.cwd(), "public", "data", `cf-${difficulty}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const arr = JSON.parse(raw) as BundledProblem[];
  cache[difficulty] = arr;
  return arr;
}

export async function pickProblem(
  difficulty: Difficulty,
  opts: { tags?: string[]; exclude?: string[] } = {},
): Promise<Problem> {
  const pool = await loadBand(difficulty);
  let candidates = pool;
  if (opts.tags && opts.tags.length > 0) {
    const wanted = opts.tags.map((t) => t.toLowerCase());
    const filtered = candidates.filter((p) =>
      p.tags.some((t) => wanted.includes(t.toLowerCase())),
    );
    if (filtered.length > 0) candidates = filtered;
    // If the tag filter empties the pool, fall back to the full band so
    // the user still gets a contest (just without the pattern bias).
  }
  if (opts.exclude && opts.exclude.length > 0) {
    const exclude = new Set(opts.exclude);
    candidates = candidates.filter((p) => !exclude.has(p.id));
  }
  if (candidates.length === 0) {
    throw new Error(`No problems for ${difficulty}`);
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return toProblem(picked, difficulty);
}

function toProblem(p: BundledProblem, difficulty: Difficulty): Problem {
  const statement = appendAttribution(p.statement, p.url, p.timeLimit, p.memoryLimit);
  return {
    id: p.id,
    source: "codeforces",
    title: p.title,
    difficulty,
    rating: p.rating,
    tags: p.tags,
    statement,
    examples: p.examples,
    hiddenTests: p.hiddenTests,
    url: p.url,
  };
}

function appendAttribution(
  statement: string,
  url: string,
  timeLimit: number | null,
  memoryLimit: number | null,
): string {
  const limits: string[] = [];
  if (timeLimit) limits.push(`time limit: ${timeLimit}s`);
  if (memoryLimit) limits.push(`memory: ${memoryLimit}MB`);
  const limitsLine = limits.length > 0 ? `\n\n_${limits.join(", ")}_` : "";
  return `${statement}${limitsLine}\n\n---\n_From Codeforces ([original](${url})), via the open-r1/codeforces dataset (CC-BY-4.0)._`;
}
