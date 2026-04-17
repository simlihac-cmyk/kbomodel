import { NextResponse } from "next/server";

import { runAutomationMode } from "@/lib/scheduler/kbo/runtime";

function assertAuthorized(request: Request) {
  const secret = process.env.INGEST_PUBLISH_SECRET;
  if (!secret) {
    throw new Error("INGEST_PUBLISH_SECRET is not configured.");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new Error("Unauthorized finalize request.");
  }
}

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const summary = await runAutomationMode("nightly");
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown finalize error" },
      { status: 500 },
    );
  }
}
