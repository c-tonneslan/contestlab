"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { loadContest } from "@/lib/storage";
import { contestScore, problemScore } from "@/lib/contest";
import Timer from "@/components/Timer";
import type { Contest } from "@/types";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400",
  "easy-medium": "text-yellow-400",
  medium: "text-orange-400",
  hard: "text-red-400",
};

export default function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contest, setContest] = useState<Contest | null>(null);

  useEffect(() => {
    setContest(loadContest(id));
    const onFocus = () => setContest(loadContest(id));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id]);

  if (!contest) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Link href="/" className="text-emerald-400">
          ← home
        </Link>
        <p className="mt-4 text-zinc-400">Contest not found in this browser.</p>
      </div>
    );
  }

  const totalScore = contestScore(contest);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-emerald-400 text-sm">
          ← home
        </Link>
        <Timer startedAt={contest.createdAt} durationMs={contest.durationMs} />
      </div>

      <h1 className="text-2xl font-bold mb-1">Contest</h1>
      <p className="text-sm text-zinc-500 font-mono mb-6">{contest.id}</p>

      <div className="border border-zinc-800 rounded p-4 mb-6 flex justify-between">
        <div>
          <div className="text-xs text-zinc-500">Score</div>
          <div className="text-3xl font-mono">{totalScore}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Solved</div>
          <div className="text-3xl font-mono">
            {Object.keys(contest.solvedAt).length}/4
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {contest.problems.map((p, i) => {
          const solvedAt = contest.solvedAt[p.id];
          const wrong = contest.wrongAttempts[p.id] ?? 0;
          const score =
            solvedAt !== undefined
              ? problemScore(p.difficulty, solvedAt, wrong, contest.durationMs)
              : null;
          return (
            <li
              key={p.id}
              className="border border-zinc-800 rounded p-4 hover:border-zinc-600"
            >
              <Link
                href={`/contest/${contest.id}/${p.id}`}
                className="flex justify-between items-start"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-zinc-500">
                      Q{i + 1}
                    </span>
                    <span
                      className={`text-xs uppercase font-semibold ${
                        DIFFICULTY_COLORS[p.difficulty]
                      }`}
                    >
                      {p.difficulty}
                    </span>
                    <span className="text-xs text-zinc-500">
                      ({p.source} · rating {p.rating})
                    </span>
                  </div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {p.tags.slice(0, 5).join(", ")}
                  </div>
                </div>
                <div className="text-right">
                  {score !== null ? (
                    <>
                      <div className="text-emerald-400 font-mono">{score} pts</div>
                      {wrong > 0 && (
                        <div className="text-xs text-red-400">
                          −{wrong} WA
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-zinc-500">unsolved</div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
