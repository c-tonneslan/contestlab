import { NextRequest, NextResponse } from "next/server";
import { assembleContest } from "@/lib/contest-server";

export const runtime = "nodejs";
export const maxDuration = 90; // seconds

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const source =
    body.source === "codeforces" || body.source === "leetcode" || body.source === "mixed"
      ? body.source
      : "leetcode";
  const generatedCount = typeof body.generatedCount === "number" ? body.generatedCount : 0;
  const pattern = typeof body.pattern === "string" ? body.pattern : undefined;
  const durationMs = typeof body.durationMs === "number" ? body.durationMs : undefined;

  try {
    const contest = await assembleContest({ source, generatedCount, pattern, durationMs });
    return NextResponse.json({ contest });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
