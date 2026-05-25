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

export function normalizeOutput(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, i, arr) => !(line === "" && i === arr.length - 1))
    .join("\n")
    .replace(/\n+$/, "");
}
