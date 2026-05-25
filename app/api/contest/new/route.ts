import { NextRequest, NextResponse } from "next/server";
import { assembleContest } from "@/lib/contest-server";

export const runtime = "nodejs";
export const maxDuration = 90; // seconds

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const generatedCount = typeof body.generatedCount === "number" ? body.generatedCount : 1;
  const pattern = typeof body.pattern === "string" ? body.pattern : undefined;
  const durationMs = typeof body.durationMs === "number" ? body.durationMs : undefined;

  try {
    const contest = await assembleContest({ generatedCount, pattern, durationMs });
    return NextResponse.json({ contest });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
