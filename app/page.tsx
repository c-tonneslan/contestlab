"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteContest, listContests, saveContest } from "@/lib/storage";
import { contestScore, isContestExpired } from "@/lib/contest";
import type { Contest } from "@/types";

const PATTERNS = [
  { id: "", label: "Any" },
  { id: "implementation", label: "Implementation" },
  { id: "greedy", label: "Greedy" },
  { id: "dp", label: "DP" },
  { id: "graphs", label: "Graphs" },
  { id: "trees", label: "Trees" },
  { id: "binary search", label: "Binary search" },
  { id: "two pointers", label: "Two pointers" },
  { id: "strings", label: "Strings" },
  { id: "math", label: "Math" },
];

export default function Home() {
  const router = useRouter();
  const [history, setHistory] = useState<Contest[]>([]);
  const [source, setSource] = useState<"leetcode" | "codeforces" | "mixed">("leetcode");
  const [pattern, setPattern] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [durationMin, setDurationMin] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(listContests());
  }, []);

  async function startContest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contest/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source,
          generatedCount,
          pattern: pattern || undefined,
          durationMs: durationMin * 60 * 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contest");
      const contest = data.contest as Contest;
      saveContest(contest);
      router.push(`/contest/${contest.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">contestlab</h1>
        <p className="text-zinc-400 mt-1">
          LeetCode-style coding contests with a real judge. Codeforces problems +
          AI-generated novel problems, scored with time decay and wrong-attempt
          penalties.
        </p>
      </header>

      <section className="border border-zinc-800 rounded p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Start a new contest</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Problem source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
            >
              <option value="leetcode">LeetCode (function signature + full judge)</option>
              <option value="codeforces">Codeforces (stdio, full statements + tests)</option>
              <option value="mixed">Mixed (alternates LeetCode and Codeforces)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Pattern bias</label>
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
            >
              {PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              AI-generated problems (out of 4)
            </label>
            <input
              type="number"
              min={0}
              max={4}
              value={generatedCount}
              onChange={(e) => setGeneratedCount(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Generated problems fill the harder slots first. 0 = pure Codeforces,
              4 = pure novel problems.
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              max={240}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={startContest}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-medium rounded px-4 py-2"
          >
            {loading ? "Assembling contest..." : "Start"}
          </button>

          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Previous contests</h2>
        {history.length === 0 ? (
          <p className="text-zinc-500 text-sm">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((c) => {
              const score = c.finalScore ?? contestScore(c);
              const expired = isContestExpired(c);
              return (
                <li
                  key={c.id}
                  className="border border-zinc-800 rounded p-3 flex justify-between items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contest/${c.id}`}
                      className="text-emerald-400 hover:text-emerald-300 font-mono text-sm"
                    >
                      {c.id}
                    </Link>
                    <div className="text-xs text-zinc-500 mt-1">
                      {new Date(c.createdAt).toLocaleString()} · solved{" "}
                      {Object.keys(c.solvedAt).length}/4
                      {expired ? " · ended" : " · live"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-zinc-300 font-mono">{score}</div>
                    <button
                      onClick={() => {
                        if (!confirm("Delete this contest? This can't be undone.")) return;
                        deleteContest(c.id);
                        setHistory(listContests());
                      }}
                      className="text-zinc-500 hover:text-red-400 text-xs"
                      aria-label="delete contest"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
