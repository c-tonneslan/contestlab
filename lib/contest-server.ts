/**
 * Server-only contest assembly. Calls problem-bank loaders + Anthropic.
 * Never import this from a client component.
 */

import "server-only";
import type { Contest, Difficulty, Problem } from "@/types";
import { pickProblem as pickCodeforcesProblem } from "./codeforces";
import { pickLeetCodeProblem } from "./leetcode";
import { generateProblem } from "./generate";

const DIFFICULTIES: Difficulty[] = ["easy", "easy-medium", "medium", "hard"];
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

export type ContestSource = "codeforces" | "leetcode" | "mixed";

export interface AssembleOptions {
  /** Where the non-generated problems come from. Default "leetcode". */
  source?: ContestSource;
  /** Number of generated problems out of 4. Default 0. */
  generatedCount?: number;
  pattern?: string;
  durationMs?: number;
}

export async function assembleContest(opts: AssembleOptions = {}): Promise<Contest> {
  const source = opts.source ?? "leetcode";
  const generatedCount = Math.min(4, Math.max(0, opts.generatedCount ?? 0));
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;

  // Generated problems fill the harder slots first.
  const generatedSlots = new Set(
    DIFFICULTIES.slice(4 - generatedCount).map((d) => d),
  );

  const problems: Problem[] = await Promise.all(
    DIFFICULTIES.map(async (difficulty, idx) => {
      if (generatedSlots.has(difficulty)) {
        return generateProblem(difficulty, { pattern: opts.pattern });
      }
      const tagFilter = opts.pattern ? { tags: [opts.pattern] } : {};
      if (source === "codeforces") return pickCodeforcesProblem(difficulty, tagFilter);
      if (source === "leetcode") return pickLeetCodeProblem(difficulty, tagFilter);
      // mixed: alternate sources across the 4 problems
      return idx % 2 === 0
        ? pickLeetCodeProblem(difficulty, tagFilter)
        : pickCodeforcesProblem(difficulty, tagFilter);
    }),
  );

  return {
    id: `contest-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    createdAt: Date.now(),
    durationMs,
    problems,
    submissions: [],
    solvedAt: {},
    wrongAttempts: {},
  };
}
