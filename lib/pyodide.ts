/**
 * Client-side Python execution via Pyodide (Python compiled to WebAssembly).
 *
 * We load Pyodide once per session from the CDN and reuse it. Each run
 * happens in a fresh sub-namespace so module-level state from one run
 * doesn't leak into the next.
 *
 * Why client-side: the free Piston API went whitelist-only in Feb 2026,
 * Judge0 needs an API key with daily limits, and self-hosting code
 * execution is heavyweight. Pyodide runs in the user's browser — no
 * backend, no rate limits, no API keys.
 *
 * Tradeoff: ~10MB initial Pyodide download (cached after first load), and
 * only Python is supported. Both fine for an interview-prep tool.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>;
  }
}

let pyodidePromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function getPyodide(onProgress?: (msg: string) => void): Promise<any> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    onProgress?.("Loading Pyodide runtime...");
    if (!window.loadPyodide) {
      await loadScript(PYODIDE_URL);
    }
    if (!window.loadPyodide) {
      throw new Error("Pyodide failed to register on window");
    }
    onProgress?.("Initializing Python interpreter...");
    const py = await window.loadPyodide({ indexURL: PYODIDE_INDEX });
    onProgress?.("Ready");
    return py;
  })();
  return pyodidePromise;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  ok: boolean;
  durationMs: number;
}

/**
 * Run user code with the given stdin. Captures stdout and stderr. Caps
 * execution wall time via a Web Worker termination (TODO — currently no
 * hard timeout; long-running code will hang the tab. Move to a worker
 * runner for v2).
 */
export async function runPython(source: string, stdin: string): Promise<RunResult> {
  const py = await getPyodide();
  const start = performance.now();

  py.runPython(`
import sys, io
sys.stdin = io.StringIO(${JSON.stringify(stdin)})
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);

  let exitCode = 0;
  let errorMsg = "";

  try {
    py.runPython(source);
  } catch (e) {
    exitCode = 1;
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  const stdout: string = py.runPython("sys.stdout.getvalue()");
  let stderr: string = py.runPython("sys.stderr.getvalue()");
  if (errorMsg && !stderr) stderr = errorMsg;

  // Reset stdin/stdout/stderr so the next run starts fresh.
  py.runPython(`
sys.stdin = sys.__stdin__
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

  return {
    stdout,
    stderr,
    exitCode,
    ok: exitCode === 0 && !stderr,
    durationMs: performance.now() - start,
  };
}

/**
 * Run a LeetCode-style submission against the bundled test harness.
 * Returns { passed: true } if all assertions pass, otherwise extracts
 * the first failing assertion's information.
 */
export interface LcRunResult {
  passed: boolean;
  totalTests: number; // number of `assert` lines we saw in the harness
  passedTests: number; // best-effort: count of asserts that ran before first failure
  failure?: { message: string; testLine: string };
  stderr: string;
  durationMs: number;
}

export async function runLeetCodeSubmit(
  prompt: string,
  source: string,
  entryPoint: string,
  test: string,
): Promise<LcRunResult> {
  const py = await getPyodide();
  const start = performance.now();
  const totalTests = (test.match(/^\s*assert /gm) || []).length;

  // We wrap each `assert ...` line so we count how many ran before failure.
  // The wrapper increments a global counter before each assert.
  const instrumentedTest = instrumentTest(test);
  const fullSource = `${prompt}\n${source}\n${instrumentedTest}\n_passed = 0\ntry:\n    check(${entryPoint})\n    _result = ("ok", _passed, "")\nexcept AssertionError as _e:\n    _result = ("assert", _passed, str(_e) or "assertion failed")\nexcept Exception as _e:\n    _result = ("error", _passed, f"{type(_e).__name__}: {_e}")\n`;

  // Capture stderr in case the user prints during a run.
  py.runPython(`import sys, io\nsys.stderr = io.StringIO()`);

  let exception = "";
  let stderr = "";
  let verdict = "";
  let passedCount = 0;
  let message = "";

  try {
    py.runPython(fullSource);
    verdict = py.runPython("_result[0]");
    passedCount = py.runPython("_result[1]");
    message = py.runPython("_result[2]");
    stderr = py.runPython("sys.stderr.getvalue()");
  } catch (e) {
    exception = e instanceof Error ? e.message : String(e);
  } finally {
    try {
      py.runPython("sys.stderr = sys.__stderr__");
    } catch {}
  }

  if (exception) {
    return {
      passed: false,
      totalTests,
      passedTests: 0,
      failure: { message: exception, testLine: "" },
      stderr,
      durationMs: performance.now() - start,
    };
  }

  if (verdict === "ok") {
    return {
      passed: true,
      totalTests,
      passedTests: totalTests,
      stderr,
      durationMs: performance.now() - start,
    };
  }
  const testLine = extractAssertLine(test, passedCount);
  return {
    passed: false,
    totalTests,
    passedTests: passedCount,
    failure: { message: String(message), testLine },
    stderr,
    durationMs: performance.now() - start,
  };
}

/**
 * Run a LeetCode function with custom arguments and return the result.
 * `argsExpr` is the user-typed args, e.g. `nums = [2,7,11,15], target = 9`.
 */
export async function runLeetCodeCustom(
  prompt: string,
  source: string,
  entryPoint: string,
  argsExpr: string,
): Promise<{ result: string; stderr: string; durationMs: number; ok: boolean }> {
  const py = await getPyodide();
  const start = performance.now();
  const fullSource =
    `${prompt}\n${source}\n` +
    `import sys, io, json\n` +
    `sys.stderr = io.StringIO()\n` +
    `try:\n` +
    `    _val = ${entryPoint}(${argsExpr})\n` +
    `    _out = repr(_val)\n` +
    `    _err = ""\n` +
    `except Exception as _e:\n` +
    `    _out = ""\n` +
    `    _err = f"{type(_e).__name__}: {_e}"\n`;
  let result = "";
  let err = "";
  let stderr = "";
  try {
    py.runPython(fullSource);
    result = py.runPython("_out");
    err = py.runPython("_err");
    stderr = py.runPython("sys.stderr.getvalue()");
  } catch (e) {
    // The source itself failed to compile/run (syntax error in user code,
    // missing reference, etc). The JS-side exception has the traceback.
    err = e instanceof Error ? e.message : String(e);
  } finally {
    try {
      py.runPython("sys.stderr = sys.__stderr__");
    } catch {}
  }
  return {
    result,
    stderr: err || stderr,
    durationMs: performance.now() - start,
    ok: !err,
  };
}

function instrumentTest(test: string): string {
  // Replace each `    assert X` line with a pair that increments a
  // counter, then asserts. Done with a simple regex on indented `assert `.
  return test.replace(
    /^( +)assert (.+)$/gm,
    "$1global _passed; assert $2; _passed = _passed + 1",
  );
}

function extractAssertLine(test: string, passedCount: number): string {
  // The (passedCount + 1)-th assert in the test is the one that failed.
  const lines = test.split(/\r?\n/);
  let seen = 0;
  for (const line of lines) {
    if (/^\s*assert\b/.test(line)) {
      if (seen === passedCount) return line.trim();
      seen++;
    }
  }
  return "";
}

export function normalizeOutput(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, i, arr) => !(line === "" && i === arr.length - 1))
    .join("\n")
    .replace(/\n+$/, "");
}
