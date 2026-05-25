export type Difficulty = "easy" | "easy-medium" | "medium" | "hard";

export type ProblemSource = "codeforces" | "leetcode" | "generated";
export type ProblemKind = "stdio" | "function";

export interface TestCase {
  input: string;
  expected: string;
}

export interface Problem {
  id: string;
  source: ProblemSource;
  kind: ProblemKind;
  title: string;
  difficulty: Difficulty;
  rating: number;
  tags: string[];
  statement: string; // markdown
  examples: TestCase[];
  hiddenTests?: TestCase[];
  starterCode?: string;
  url?: string;
  // LeetCode (function-style) only:
  entryPoint?: string; // e.g. "Solution().twoSum"
  testPrompt?: string; // imports + helper classes (ListNode etc)
  testHarness?: string; // full `def check(candidate): assert ...` block
}

export interface Submission {
  problemId: string;
  language: "python" | "javascript" | "typescript";
  source: string;
  verdict: "accepted" | "wrong_answer" | "runtime_error" | "timeout" | "compile_error";
  timeMs: number;
  passedTests: number;
  totalTests: number;
  failures?: { input: string; expected: string; actual: string }[];
  submittedAt: number; // ms since contest start
}

export interface Contest {
  id: string;
  createdAt: number;
  durationMs: number; // typically 90 minutes
  problems: Problem[]; // 4 problems: easy, easy-medium, medium, hard
  submissions: Submission[];
  solvedAt: Record<string, number>; // problemId -> ms since start when first AC
  wrongAttempts: Record<string, number>; // problemId -> count of WA before AC
  finishedAt?: number;
  finalScore?: number;
}

export const DIFFICULTY_RATING_RANGES: Record<Difficulty, [number, number]> = {
  easy: [800, 1200],
  "easy-medium": [1300, 1500],
  medium: [1600, 1900],
  hard: [2000, 2600],
};

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 500,
  "easy-medium": 1000,
  medium: 1500,
  hard: 2500,
};
