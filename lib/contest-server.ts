/**
 * Server-only contest assembly. Calls Codeforces API + Anthropic. Never
 * import this from a client component or shared lib file — it pulls in
 * the Anthropic SDK which has Node-only dependencies.
 */

import "server-only";
import type { Contest, Difficulty, Problem } from "@/types";
import { pickProblem } from "./codeforces";
import { generateProblem } from "./generate";

const DIFFICULTIES: Difficulty[] = ["easy", "easy-medium", "medium", "hard"];
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

export interface AssembleOptions {
  generatedCount?: number;
  pattern?: string;
  durationMs?: number;
}

export async function assembleContest(opts: AssembleOptions = {}): Promise<Contest> {
  const generatedCount = Math.min(4, Math.max(0, opts.generatedCount ?? 1));
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;

  const generatedSlots = new Set(
    DIFFICULTIES.slice(4 - generatedCount).map((d) => d),
  );

  const problems: Problem[] = await Promise.all(
    DIFFICULTIES.map(async (difficulty) => {
      if (generatedSlots.has(difficulty)) {
        return generateProblem(difficulty, { pattern: opts.pattern });
      }
      return pickProblem(difficulty, opts.pattern ? { tags: [opts.pattern] } : {});
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
