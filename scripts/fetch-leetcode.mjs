#!/usr/bin/env node
/**
 * Fetch a curated subset of the newfacade/LeetCodeDataset from
 * Hugging Face. The dataset has problem statements, function-signature
 * starter code, an `entry_point` like "Solution().twoSum", a `prompt`
 * with imports + helpers (ListNode, TreeNode, etc), and a complete
 * `test` function with assertions for grading.
 *
 * Run once locally, commit the result. Don't run on Vercel.
 */

import { writeFile } from "node:fs/promises";

const PAGE_SIZE = 100;
const PER_BAND_TARGET = {
  easy: 250,
  medium: 350,
  hard: 150,
};
const MAX_PAGES = 100;

async function fetchPage(offset) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=newfacade%2FLeetCodeDataset&config=default&split=train&offset=${offset}&length=${PAGE_SIZE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.rows.map((r) => r.row);
}

function difficultyBand(d) {
  const s = (d || "").toLowerCase();
  if (s === "easy") return "easy";
  if (s === "medium") return "medium";
  if (s === "hard") return "hard";
  return null;
}

async function main() {
  const collected = { easy: [], medium: [], hard: [] };
  let offset = 0;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const need = Object.entries(collected).filter(
      ([k, v]) => v.length < PER_BAND_TARGET[k],
    );
    if (need.length === 0) break;

    process.stdout.write(`page ${pages} (offset ${offset})... `);
    let rows;
    try {
      rows = await fetchPage(offset);
    } catch (e) {
      console.log(`error: ${e.message}, retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (rows.length === 0) {
      console.log("end of dataset");
      break;
    }

    let added = 0;
    for (const row of rows) {
      const band = difficultyBand(row.difficulty);
      if (!band) continue;
      if (collected[band].length >= PER_BAND_TARGET[band]) continue;
      if (!row.problem_description || !row.starter_code || !row.test || !row.entry_point) continue;
      if (!Array.isArray(row.input_output) || row.input_output.length === 0) continue;

      // Limit example display to first 3 entries from input_output.
      const examples = row.input_output.slice(0, 3).map((io) => ({
        input: io.input,
        expected: io.output,
      }));

      const problem = {
        id: `lc-${row.question_id}-${row.task_id}`,
        questionId: row.question_id,
        taskId: row.task_id,
        title: `${row.question_id}. ${formatTitle(row.task_id)}`,
        difficulty: band,
        tags: Array.isArray(row.tags) ? row.tags : [],
        problemDescription: row.problem_description,
        starterCode: row.starter_code,
        entryPoint: row.entry_point,
        prompt: row.prompt,
        test: row.test,
        examples,
        url: `https://leetcode.com/problems/${row.task_id}/`,
      };

      collected[band].push(problem);
      added++;
    }

    console.log(
      `+${added} (easy ${collected.easy.length}/${PER_BAND_TARGET.easy}, med ${collected.medium.length}/${PER_BAND_TARGET.medium}, hard ${collected.hard.length}/${PER_BAND_TARGET.hard})`,
    );

    offset += PAGE_SIZE;
    pages++;
  }

  for (const [band, problems] of Object.entries(collected)) {
    const path = `public/data/lc-${band}.json`;
    await writeFile(path, JSON.stringify(problems));
    console.log(`wrote ${path} (${problems.length} problems)`);
  }
}

function formatTitle(taskId) {
  return taskId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
