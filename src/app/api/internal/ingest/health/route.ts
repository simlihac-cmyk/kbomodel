import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/session";
import { getPublishStorageRepository } from "@/lib/publish/storage";

async function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const sharedSecrets = [
    process.env.INGEST_PUBLISH_SECRET,
    process.env.INGEST_BLOB_PLAN_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (authHeader && sharedSecrets.some((secret) => authHeader === `Bearer ${secret}`)) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(`${ADMIN_SESSION_COOKIE}=`.length);

  if (!token) {
    return false;
  }

  const session = await verifyAdminSessionToken(token);
  return session !== null;
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const repository = getPublishStorageRepository();
  const [current, today, simulation] = await Promise.all([
    repository.getManifest("current"),
    repository.getManifest("today"),
    repository.getManifest("simulation"),
  ]);

  return NextResponse.json({
    ok: true,
    manifests: {
      current,
      today,
      simulation,
    },
    env: {
      timezone: process.env.KBO_TIMEZONE ?? "Asia/Seoul",
      publishMode: process.env.INGEST_PUBLISH_MODE ?? "file",
      storageConfigured: Boolean(repository.getStorageRoot()),
      s3PresignEnabled: Boolean(
        process.env.INGEST_S3_ACCESS_KEY_ID &&
          process.env.INGEST_S3_SECRET_ACCESS_KEY &&
          process.env.INGEST_S3_REGION &&
          process.env.INGEST_S3_BUCKET &&
          process.env.INGEST_S3_ENDPOINT,
      ),
      officialKboOnly: process.env.OFFICIAL_KBO_ONLY !== "false",
      enableStatizEnrichment: process.env.ENABLE_STATIZ_ENRICHMENT === "true",
    },
  });
}
