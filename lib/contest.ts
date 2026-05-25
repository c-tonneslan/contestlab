/**
 * Client-safe contest helpers: scoring math, applying submissions.
 * No network or LLM calls here — those live in contest-server.ts.
 *
 * Scoring approximates LeetCode weekly contest:
 * - Each problem has base points by difficulty.
 * - Full credit if solved within 10 min; linear decay to 30% at contest end.
 * - Each wrong submission adds a 5-minute penalty to the solve time.
 */

import type { Contest, Difficulty, Submission } from "@/types";
import { DIFFICULTY_POINTS } from "@/types";

const PENALTY_MS = 5 * 60 * 1000;
const FULL_CREDIT_WINDOW_MS = 10 * 60 * 1000;
const FLOOR_FRACTION = 0.3;

export function problemScore(
  difficulty: Difficulty,
  solvedAtMs: number,
  wrongAttempts: number,
  durationMs: number,
): number {
  const base = DIFFICULTY_POINTS[difficulty];
  const effectiveTime = solvedAtMs + wrongAttempts * PENALTY_MS;

  if (effectiveTime <= FULL_CREDIT_WINDOW_MS) return base;

  const decayWindow = durationMs - FULL_CREDIT_WINDOW_MS;
  const overrun = Math.min(decayWindow, effectiveTime - FULL_CREDIT_WINDOW_MS);
  const fraction = 1 - (overrun / decayWindow) * (1 - FLOOR_FRACTION);

  return Math.round(base * fraction);
}

export function contestScore(contest: Contest): number {
  let total = 0;
  for (const problem of contest.problems) {
    const solvedAt = contest.solvedAt[problem.id];
    if (solvedAt === undefined) continue;
    total += problemScore(
      problem.difficulty,
      solvedAt,
      contest.wrongAttempts[problem.id] ?? 0,
      contest.durationMs,
    );
  }
  return total;
}

export function applySubmission(contest: Contest, submission: Submission): Contest {
  contest.submissions.push(submission);

  if (submission.verdict === "accepted") {
    if (contest.solvedAt[submission.problemId] === undefined) {
      contest.solvedAt[submission.problemId] = submission.submittedAt;
    }
  } else {
    if (contest.solvedAt[submission.problemId] === undefined) {
      contest.wrongAttempts[submission.problemId] =
        (contest.wrongAttempts[submission.problemId] ?? 0) + 1;
    }
  }

  return contest;
}
