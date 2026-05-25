"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeEditor from "@/components/Editor";
import Timer from "@/components/Timer";
import { loadContest, saveContest } from "@/lib/storage";
import { applySubmission } from "@/lib/contest";
import { getPyodide, normalizeOutput, runPython } from "@/lib/pyodide";
import type { Contest, Problem, Submission, TestCase } from "@/types";

const DEFAULT_STARTER = `import sys
input = sys.stdin.readline

def solve():
    # read input, write output
    pass

solve()
`;

export default function ProblemPage({
  params,
}: {
  params: Promise<{ id: string; problemId: string }>;
}) {
  const { id, problemId } = use(params);
  const [contest, setContest] = useState<Contest | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [source, setSource] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<Submission | null>(null);
  const [pyodideStatus, setPyodideStatus] = useState<string>("Loading Python runtime...");

  useEffect(() => {
    getPyodide(setPyodideStatus).then(() => setPyodideStatus("ready"));
  }, []);

  useEffect(() => {
    const c = loadContest(id);
    if (!c) return;
    setContest(c);
    const p = c.problems.find((x) => x.id === problemId);
    if (p) {
      setProblem(p);
      setSource(p.starterCode ?? DEFAULT_STARTER);
      if (p.examples[0]) setStdin(p.examples[0].input);
    }
  }, [id, problemId]);

  async function runOnce() {
    setRunning(true);
    setOutput("");
    try {
      const result = await runPython(source, stdin);
      setOutput(
        `exit ${result.exitCode} · ${result.durationMs.toFixed(0)}ms\n` +
          `--- stdout ---\n${result.stdout}\n` +
          `--- stderr ---\n${result.stderr}`,
      );
    } catch (e) {
      setOutput(`error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!contest || !problem) return;
    setSubmitting(true);
    setVerdict(null);
    const submittedAt = Date.now() - contest.createdAt;
    const tests: TestCase[] = [...problem.examples, ...(problem.hiddenTests ?? [])];

    if (tests.length === 0) {
      setOutput(
        "This problem has no built-in test bank (Codeforces problems require external tests). Use the Run panel to test with custom input, or open the problem URL.",
      );
      setSubmitting(false);
      return;
    }

    let passed = 0;
    const failures: { input: string; expected: string; actual: string }[] = [];
    let verdictType: Submission["verdict"] = "accepted";
    const startJudge = performance.now();

    for (const test of tests) {
      try {
        const result = await runPython(source, test.input);
        if (!result.ok) {
          verdictType = result.stderr ? "runtime_error" : "wrong_answer";
          failures.push({
            input: test.input,
            expected: test.expected,
            actual: result.stderr || result.stdout,
          });
          break;
        }
        const actual = normalizeOutput(result.stdout);
        const expected = normalizeOutput(test.expected);
        if (actual === expected) {
          passed++;
        } else {
          verdictType = "wrong_answer";
          failures.push({ input: test.input, expected, actual });
          break;
        }
      } catch (e) {
        verdictType = "runtime_error";
        failures.push({
          input: test.input,
          expected: test.expected,
          actual: e instanceof Error ? e.message : "unknown",
        });
        break;
      }
    }

    const submission: Submission = {
      problemId: problem.id,
      language: "python",
      source,
      verdict: verdictType,
      timeMs: performance.now() - startJudge,
      passedTests: passed,
      totalTests: tests.length,
      failures: failures.length > 0 ? failures : undefined,
      submittedAt,
    };
    setVerdict(submission);
    const updated = applySubmission(contest, submission);
    saveContest(updated);
    setContest({ ...updated });
    setSubmitting(false);
  }

  if (!contest || !problem) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Link href="/" className="text-emerald-400">
          ← home
        </Link>
        <p className="mt-4 text-zinc-400">Loading...</p>
      </div>
    );
  }

  const solvedAt = contest.solvedAt[problem.id];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/contest/${contest.id}`}
          className="text-emerald-400 text-sm"
        >
          ← contest
        </Link>
        <div className="flex items-center gap-4">
          {pyodideStatus !== "ready" && (
            <span className="text-xs text-zinc-500">{pyodideStatus}</span>
          )}
          <Timer startedAt={contest.createdAt} durationMs={contest.durationMs} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4 overflow-y-auto max-h-[80vh] pr-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-semibold text-emerald-400">
                {problem.difficulty}
              </span>
              <span className="text-xs text-zinc-500">
                rating {problem.rating}
              </span>
              <span className="text-xs text-zinc-500">· {problem.source}</span>
            </div>
            <h1 className="text-xl font-bold">{problem.title}</h1>
            <div className="text-xs text-zinc-500 mt-1">
              {problem.tags.join(", ")}
            </div>
          </div>

          <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {problem.statement}
            </ReactMarkdown>
          </div>

          {problem.examples.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 mb-2">Examples</h2>
              {problem.examples.map((ex, i) => (
                <div key={i} className="border border-zinc-800 rounded p-3 mb-2">
                  <div className="text-xs text-zinc-500">Input</div>
                  <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                    {ex.input}
                  </pre>
                  <div className="text-xs text-zinc-500 mt-2">Expected</div>
                  <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                    {ex.expected}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {solvedAt !== undefined && (
            <div className="border border-emerald-700 bg-emerald-950 rounded p-3 text-emerald-200 text-sm">
              Solved at {formatTime(solvedAt)} ({contest.wrongAttempts[problem.id] ?? 0}{" "}
              wrong attempts).
            </div>
          )}
        </div>

        <div className="space-y-3">
          <CodeEditor value={source} onChange={setSource} language="python" height="50vh" />

          <div className="flex gap-2">
            <button
              onClick={runOnce}
              disabled={running || pyodideStatus !== "ready"}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 rounded px-3 py-2 text-sm"
            >
              {running ? "Running..." : "Run"}
            </button>
            <button
              onClick={submit}
              disabled={submitting || pyodideStatus !== "ready"}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-2 text-sm font-medium"
            >
              {submitting ? "Judging..." : "Submit"}
            </button>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Custom stdin</label>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              className="w-full h-20 bg-zinc-900 border border-zinc-800 rounded p-2 font-mono text-xs"
            />
          </div>

          {output && (
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-xs text-zinc-500 mb-1">Run output</div>
              <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300">
                {output}
              </pre>
            </div>
          )}

          {verdict && (
            <div
              className={`border rounded p-3 ${
                verdict.verdict === "accepted"
                  ? "border-emerald-700 bg-emerald-950"
                  : "border-red-700 bg-red-950"
              }`}
            >
              <div className="text-sm font-semibold uppercase">
                {verdict.verdict.replace("_", " ")}
              </div>
              <div className="text-xs mt-1">
                {verdict.passedTests}/{verdict.totalTests} tests passed
                · {verdict.timeMs.toFixed(0)}ms
              </div>
              {verdict.failures && verdict.failures[0] && (
                <div className="mt-2 text-xs font-mono">
                  <div className="text-zinc-400">Input</div>
                  <pre className="whitespace-pre-wrap">{verdict.failures[0].input}</pre>
                  <div className="text-zinc-400 mt-1">Expected</div>
                  <pre className="whitespace-pre-wrap">
                    {verdict.failures[0].expected}
                  </pre>
                  <div className="text-zinc-400 mt-1">Actual</div>
                  <pre className="whitespace-pre-wrap">
                    {verdict.failures[0].actual}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
