import { publishModeSchema, type Publisher } from "@/lib/publish/contracts";
import { PlannedBlobPublisher } from "@/lib/publish/planned-blob-publisher";
import { BlobPutPublisher } from "@/lib/publish/blob-put-publisher";
import { FilePublisher } from "@/lib/publish/file-publisher";
import { GitPublisher } from "@/lib/publish/git-publisher";
import { SignedHttpPublisher } from "@/lib/publish/signed-http-publisher";

export function getPublisherFromEnv(): Publisher {
  const mode = publishModeSchema.parse(process.env.INGEST_PUBLISH_MODE ?? "file");

  if (mode === "signed-http") {
    const publishUrl = process.env.INGEST_PUBLISH_URL;
    const secret = process.env.INGEST_PUBLISH_SECRET;
    if (!publishUrl || !secret) {
      throw new Error("INGEST_PUBLISH_URL and INGEST_PUBLISH_SECRET are required for signed-http publish mode.");
    }
    return new SignedHttpPublisher({
      publishUrl,
      secret,
    });
  }

  if (mode === "blob-put") {
    const baseUrl = process.env.INGEST_BLOB_BASE_URL;
    if (!baseUrl) {
      throw new Error("INGEST_BLOB_BASE_URL is required for blob-put publish mode.");
    }

    return new BlobPutPublisher({
      baseUrl,
      authHeaderName: process.env.INGEST_BLOB_AUTH_HEADER,
      authHeaderValue: process.env.INGEST_BLOB_AUTH_VALUE,
      pathPrefix: process.env.INGEST_BLOB_PATH_PREFIX,
    });
  }

  if (mode === "blob-plan") {
    const planUrl = process.env.INGEST_BLOB_PLAN_URL;
    const secret = process.env.INGEST_BLOB_PLAN_SECRET ?? process.env.INGEST_PUBLISH_SECRET;
    if (!planUrl || !secret) {
      throw new Error("INGEST_BLOB_PLAN_URL and blob plan secret are required for blob-plan publish mode.");
    }

    return new PlannedBlobPublisher({
      planUrl,
      secret,
    });
  }

  if (mode === "git") {
    return new GitPublisher();
  }

  return new FilePublisher();
}
