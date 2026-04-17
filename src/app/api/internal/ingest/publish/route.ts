import { NextResponse } from "next/server";

import { FilePublisher } from "@/lib/publish/file-publisher";
import { publishManifestSchema } from "@/lib/publish/contracts";
import { getPublishStorageRepository } from "@/lib/publish/storage";

function assertAuthorized(request: Request) {
  const secret = process.env.INGEST_PUBLISH_SECRET;
  if (!secret) {
    throw new Error("INGEST_PUBLISH_SECRET is not configured.");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new Error("Unauthorized publish request.");
  }
}

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = (await request.json()) as {
      artifacts?: Array<{ dataset: string; payload: unknown; version: string }>;
      manifests?: unknown[];
    };
    const publisher = new FilePublisher(getPublishStorageRepository());
    const manifests = (body.manifests ?? []).map((manifest) => publishManifestSchema.parse(manifest));
    const artifacts = (body.artifacts ?? []).map((artifact) => ({
      dataset: artifact.dataset as never,
      payload: artifact.payload,
      version: artifact.version,
    }));
    const result = await publisher.publishArtifacts(artifacts, manifests);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown publish error" },
      { status: 500 },
    );
  }
}
