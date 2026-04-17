import { afterEach, describe, expect, it } from "vitest";

import { getPublisherFromEnv } from "@/lib/publish";

const ORIGINAL_ENV = { ...process.env };

describe("publisher selection", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to file publisher", () => {
    delete process.env.INGEST_PUBLISH_MODE;
    const publisher = getPublisherFromEnv();
    expect(publisher.mode).toBe("file");
  });

  it("selects git publisher when configured", () => {
    process.env.INGEST_PUBLISH_MODE = "git";
    const publisher = getPublisherFromEnv();
    expect(publisher.mode).toBe("git");
  });

  it("selects signed HTTP publisher when URL and secret are provided", () => {
    process.env.INGEST_PUBLISH_MODE = "signed-http";
    process.env.INGEST_PUBLISH_URL = "https://example.com/internal/publish";
    process.env.INGEST_PUBLISH_SECRET = "secret";
    const publisher = getPublisherFromEnv();
    expect(publisher.mode).toBe("signed-http");
  });

  it("selects blob-put publisher when blob base URL is provided", () => {
    process.env.INGEST_PUBLISH_MODE = "blob-put";
    process.env.INGEST_BLOB_BASE_URL = "https://blob.example.com/kbo";
    const publisher = getPublisherFromEnv();
    expect(publisher.mode).toBe("blob-put");
  });

  it("selects blob-plan publisher when plan URL is provided", () => {
    process.env.INGEST_PUBLISH_MODE = "blob-plan";
    process.env.INGEST_BLOB_PLAN_URL = "https://app.example.com/api/internal/ingest/blob-plan";
    process.env.INGEST_BLOB_PLAN_SECRET = "secret";
    const publisher = getPublisherFromEnv();
    expect(publisher.mode).toBe("blob-plan");
  });
});
