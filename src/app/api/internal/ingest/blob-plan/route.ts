import { NextResponse } from "next/server";

import {
  blobUploadPlanRequestItemSchema,
  type BlobUploadPlanRequestItem,
} from "@/lib/publish/contracts";
import { buildBlobUploadPlan } from "@/lib/publish/blob-plan";
import { buildS3PresignedUploadPlan, getS3PresignConfigFromEnv } from "@/lib/publish/s3-presign";

function assertAuthorized(request: Request) {
  const secret = process.env.INGEST_BLOB_PLAN_SECRET ?? process.env.INGEST_PUBLISH_SECRET;
  if (!secret) {
    throw new Error("Blob plan secret is not configured.");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new Error("Unauthorized blob plan request.");
  }
}

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = (await request.json()) as {
      entries?: BlobUploadPlanRequestItem[];
    };
    const entries = (body.entries ?? []).map((entry) => blobUploadPlanRequestItemSchema.parse(entry));
    const s3Config = getS3PresignConfigFromEnv();
    const plan = s3Config
      ? buildS3PresignedUploadPlan({
          entries,
          config: s3Config,
        })
      : (() => {
          const baseUrl = process.env.INGEST_BLOB_BASE_URL;
          if (!baseUrl) {
            throw new Error("Either S3 presign envs or INGEST_BLOB_BASE_URL is required to build upload plans.");
          }
          return buildBlobUploadPlan({
            entries,
            baseUrl,
            pathPrefix: process.env.INGEST_BLOB_PATH_PREFIX,
            publicBaseUrl: process.env.INGEST_BLOB_PUBLIC_BASE_URL,
            authHeaderName: process.env.INGEST_BLOB_AUTH_HEADER,
            authHeaderValue: process.env.INGEST_BLOB_AUTH_VALUE,
          });
        })();

    return NextResponse.json({
      ok: true,
      plan,
      signer: s3Config ? "s3-presign" : "deterministic",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown blob plan error" },
      { status: 500 },
    );
  }
}
