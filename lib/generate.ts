/**
 * LLM problem generator using Anthropic Claude.
 *
 * Generates novel algorithmic problems by pattern + difficulty. Returns a
 * full Problem with statement, example tests, and hidden tests. We ask
 * the model to also output a reference Python solution so we can validate
 * its own test cases.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Difficulty, Problem, TestCase } from "@/types";
import { DIFFICULTY_RATING_RANGES } from "@/types";

const ANTHROPIC_MODEL = "claude-opus-4-7";

interface GeneratedProblem {
  title: string;
  statement: string; // markdown
  examples: TestCase[];
  hiddenTests: TestCase[];
  starterCode: string;
  tags: string[];
  reference_solution: string; // Python
}

const PATTERNS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "trees",
  "graphs",
  "backtracking",
  "dp-1d",
  "dp-2d",
  "greedy",
  "intervals",
  "bit-manipulation",
];

export async function generateProblem(
  difficulty: Difficulty,
  opts: { pattern?: string } = {},
): Promise<Problem> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in environment");
  }
  const client = new Anthropic({ apiKey });

  const pattern = opts.pattern ?? PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  const [lo, hi] = DIFFICULTY_RATING_RANGES[difficulty];

  const prompt = buildPrompt(difficulty, pattern, lo, hi);

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const generated = parseJsonBlock(text);

  return {
    id: `gen-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    source: "generated",
    title: generated.title,
    difficulty,
    rating: Math.floor((lo + hi) / 2),
    tags: [pattern, ...generated.tags],
    statement: generated.statement,
    examples: generated.examples,
    hiddenTests: generated.hiddenTests,
    starterCode: generated.starterCode,
  };
}

function buildPrompt(
  difficulty: Difficulty,
  pattern: string,
  lo: number,
  hi: number,
): string {
  return `You are an algorithm problem author for a coding interview practice platform.

Generate ONE original problem matching:
- Difficulty: ${difficulty} (roughly Codeforces rating ${lo}-${hi})
- Pattern/topic: ${pattern}

Rules:
- The problem must be SOLVABLE with standard input/output (stdin/stdout). Solutions read input from stdin and print to stdout. NO function-based signatures.
- Provide a clear statement with input/output format and constraints.
- Provide 2-3 example test cases visible to the solver.
- Provide 5-8 hidden test cases that exercise edge cases (empty input, max bounds, off-by-one, all-same values, etc.).
- Test inputs and outputs must be exact strings the program will read/write. No leading/trailing blank lines.
- Provide starter Python code that reads input and is ready to be filled in.
- Provide a complete reference solution in Python that you've verified solves the problem correctly.
- Tags: 1-3 additional descriptive tags beyond "${pattern}".

Output ONLY a single JSON object wrapped in a \`\`\`json code block. No preamble, no commentary. Schema:

{
  "title": "Short problem title (no number prefix)",
  "statement": "Full problem statement in markdown. Include ## Input, ## Output, ## Constraints sections.",
  "examples": [
    {"input": "exact stdin", "expected": "exact stdout"}
  ],
  "hiddenTests": [
    {"input": "...", "expected": "..."}
  ],
  "starterCode": "import sys\\ninput = sys.stdin.readline\\n\\n# your code here",
  "tags": ["tag1", "tag2"],
  "reference_solution": "Complete working Python solution that reads stdin and writes stdout"
}

Verify mentally that your reference_solution produces exactly the expected output for every example AND every hidden test before responding.`;
}

function parseJsonBlock(text: string): GeneratedProblem {
  // Try fenced ```json block first, then fall back to any { ... } block.
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Generator returned no JSON object");
  }
  const json = raw.slice(start, end + 1);
  return JSON.parse(json) as GeneratedProblem;
}
