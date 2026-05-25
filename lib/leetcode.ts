/**
 * LeetCode problem bank — bundled subset of newfacade/LeetCodeDataset
 * from Hugging Face.
 *
 * Unlike Codeforces problems (which are stdio-based), LeetCode problems
 * use function signatures. Each bundled problem includes:
 * - starterCode: the `class Solution: def methodName(...)` skeleton
 * - entryPoint: the callable expression, e.g. "Solution().twoSum"
 * - prompt: imports + helper classes (ListNode, TreeNode, list_node())
 * - test: a complete `def check(candidate): assert ...` block
 *
 * Submit runs prompt + user code + test + check(eval(entryPoint)) in
 * Pyodide. An uncaught AssertionError = wrong answer; clean exit = AC.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Difficulty, Problem } from "@/types";

interface BundledLcProblem {
  id: string;
  questionId: number;
  taskId: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  problemDescription: string;
  starterCode: string;
  entryPoint: string;
  prompt: string;
  test: string;
  examples: { input: string; expected: string }[];
  url: string;
}

const cache: Partial<Record<"easy" | "medium" | "hard", BundledLcProblem[]>> = {};

async function loadBand(band: "easy" | "medium" | "hard"): Promise<BundledLcProblem[]> {
  if (cache[band]) return cache[band]!;
  const file = path.join(process.cwd(), "public", "data", `lc-${band}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const arr = JSON.parse(raw) as BundledLcProblem[];
  cache[band] = arr;
  return arr;
}

/**
 * Map contestlab's 4-tier difficulty to LeetCode's 3-tier. We use easy
 * for both easy and easy-medium slots since LC doesn't have a finer split.
 */
function lcBandFor(difficulty: Difficulty): "easy" | "medium" | "hard" {
  if (difficulty === "easy" || difficulty === "easy-medium") return "easy";
  if (difficulty === "medium") return "medium";
  return "hard";
}

export async function pickLeetCodeProblem(
  difficulty: Difficulty,
  opts: { tags?: string[]; exclude?: string[] } = {},
): Promise<Problem> {
  const band = lcBandFor(difficulty);
  const pool = await loadBand(band);
  let candidates = pool;
  if (opts.tags && opts.tags.length > 0) {
    const wanted = opts.tags.map((t) => t.toLowerCase());
    const filtered = candidates.filter((p) =>
      p.tags.some((t) => wanted.includes(t.toLowerCase())),
    );
    if (filtered.length > 0) candidates = filtered;
  }
  if (opts.exclude && opts.exclude.length > 0) {
    const exclude = new Set(opts.exclude);
    candidates = candidates.filter((p) => !exclude.has(p.id));
  }
  if (candidates.length === 0) {
    throw new Error(`No LeetCode problems for ${band}`);
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return toProblem(picked, difficulty);
}

function toProblem(p: BundledLcProblem, difficulty: Difficulty): Problem {
  return {
    id: p.id,
    source: "leetcode",
    kind: "function",
    title: p.title,
    difficulty,
    rating: ratingFor(p.difficulty),
    tags: p.tags,
    statement: `${p.problemDescription}\n\n---\n_From LeetCode ([original](${p.url})), via the newfacade/LeetCodeDataset on Hugging Face._`,
    examples: p.examples,
    starterCode: p.starterCode,
    entryPoint: p.entryPoint,
    testPrompt: p.prompt,
    testHarness: p.test,
    url: p.url,
  };
}

function ratingFor(lcDifficulty: "easy" | "medium" | "hard"): number {
  // Rough LeetCode-to-Codeforces difficulty mapping for display.
  if (lcDifficulty === "easy") return 1000;
  if (lcDifficulty === "medium") return 1600;
  return 2200;
}
