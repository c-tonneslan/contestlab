#!/usr/bin/env node
/**
 * Fetch a curated subset of the open-r1/codeforces dataset from
 * Hugging Face's datasets-server. Filters to stdio problems with
 * statements, examples, and reasonable test cases. Outputs JSON
 * bundles per difficulty band into public/data/.
 *
 * Run once locally, commit the result. Don't run on Vercel.
 */

import { writeFile } from "node:fs/promises";

const PAGE_SIZE = 100;
const PER_BAND_TARGET = {
  easy: 200, // 800-1200
  "easy-medium": 200, // 1300-1500
  medium: 200, // 1600-1900
  hard: 100, // 2000-2600
};
const MAX_HIDDEN_TESTS_PER_PROBLEM = 8;
const MAX_TEST_INPUT_BYTES = 5000;
const MAX_TEST_OUTPUT_BYTES = 2000;
const MAX_PAGES = 200; // safety cap on scanning

function bandOf(rating) {
  if (rating >= 800 && rating <= 1200) return "easy";
  if (rating >= 1300 && rating <= 1500) return "easy-medium";
  if (rating >= 1600 && rating <= 1900) return "medium";
  if (rating >= 2000 && rating <= 2600) return "hard";
  return null;
}

function buildStatement(row) {
  const parts = [];
  if (row.description) parts.push(row.description.trim());
  if (row.input_format) {
    parts.push(`\n## Input\n\n${row.input_format.trim()}`);
  }
  if (row.output_format) {
    parts.push(`\n## Output\n\n${row.output_format.trim()}`);
  }
  if (row.note) {
    parts.push(`\n## Note\n\n${row.note.trim()}`);
  }
  return parts.join("\n").trim();
}

function trimTests(tests, maxCount) {
  if (!Array.isArray(tests)) return [];
  const out = [];
  for (const t of tests) {
    if (out.length >= maxCount) break;
    if (!t.input || !t.output) continue;
    if (t.input.length > MAX_TEST_INPUT_BYTES) continue;
    if (t.output.length > MAX_TEST_OUTPUT_BYTES) continue;
    out.push({ input: t.input, expected: t.output });
  }
  return out;
}

async function fetchPage(offset) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=open-r1%2Fcodeforces&config=default&split=train&offset=${offset}&length=${PAGE_SIZE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.rows.map((r) => r.row);
}

async function main() {
  const collected = { easy: [], "easy-medium": [], medium: [], hard: [] };
  const seen = new Set();
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
      const rating = row.rating;
      if (!rating) continue;
      const band = bandOf(rating);
      if (!band) continue;
      if (collected[band].length >= PER_BAND_TARGET[band]) continue;
      if (!row.description || !row.input_format || !row.output_format) continue;
      if (row.input_mode && row.input_mode !== "stdio") continue;
      if (!Array.isArray(row.examples) || row.examples.length === 0) continue;
      if (row.interaction_format) continue; // skip interactive problems

      const id = `cf-${row.contest_id}-${row.index}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const hidden = trimTests(row.official_tests, MAX_HIDDEN_TESTS_PER_PROBLEM);
      const examples = trimTests(row.examples, 4);
      if (examples.length === 0) continue;

      const problem = {
        id,
        contestId: String(row.contest_id),
        index: row.index,
        title: `${row.contest_id}${row.index}. ${row.title}`,
        rating,
        tags: Array.isArray(row.tags) ? row.tags : [],
        timeLimit: row.time_limit ?? null,
        memoryLimit: row.memory_limit ?? null,
        statement: buildStatement(row),
        examples,
        hiddenTests: hidden,
        url: `https://codeforces.com/problemset/problem/${row.contest_id}/${row.index}`,
      };

      collected[band].push(problem);
      added++;
    }

    console.log(
      `+${added} (easy ${collected.easy.length}/${PER_BAND_TARGET.easy}, em ${collected["easy-medium"].length}/${PER_BAND_TARGET["easy-medium"]}, med ${collected.medium.length}/${PER_BAND_TARGET.medium}, hard ${collected.hard.length}/${PER_BAND_TARGET.hard})`,
    );

    offset += PAGE_SIZE;
    pages++;
  }

  for (const [band, problems] of Object.entries(collected)) {
    const path = `public/data/cf-${band}.json`;
    await writeFile(path, JSON.stringify(problems));
    console.log(`wrote ${path} (${problems.length} problems)`);
  }

  const sample = Object.values(collected).flat()[0];
  if (sample) {
    console.log(
      `sample problem: ${sample.title}, rating ${sample.rating}, ${sample.examples.length} examples, ${sample.hiddenTests.length} hidden`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
