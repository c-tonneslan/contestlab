/**
 * localStorage-backed contest persistence. Contests don't survive across
 * devices but that's fine for an MVP — single-user practice tool.
 */

import type { Contest } from "@/types";

const PREFIX = "contestlab:contest:";

export function saveContest(contest: Contest): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + contest.id, JSON.stringify(contest));
}

export function loadContest(id: string): Contest | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Contest;
  } catch {
    return null;
  }
}

export function listContests(): Contest[] {
  if (typeof window === "undefined") return [];
  const out: Contest[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        try {
          out.push(JSON.parse(raw) as Contest);
        } catch {}
      }
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
