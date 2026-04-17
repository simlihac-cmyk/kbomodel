import { describe, expect, it } from "vitest";

import { buildS3PresignedUploadPlan } from "@/lib/publish/s3-presign";

describe("s3 presign upload plan", () => {
  it("builds presigned PUT URLs with SigV4 query parameters", () => {
    const plan = buildS3PresignedUploadPlan({
      entries: [
        {
          path: "publish/current-state.json",
          contentType: "application/json",
        },
      ],
      config: {
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "secret-example-key",
        region: "auto",
        bucket: "kbo-live",
        endpoint: "https://123456.r2.cloudflarestorage.com",
        publicBaseUrl: "https://cdn.example.com/kbo-live",
        expiresInSeconds: 900,
        forcePathStyle: true,
      },
      now: new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.uploadUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(plan.items[0]?.uploadUrl).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(plan.items[0]?.uploadUrl).toContain("X-Amz-Signature=");
    expect(plan.items[0]?.uploadUrl).toContain("/kbo-live/publish/current-state.json?");
    expect(plan.items[0]?.headers["content-type"]).toBe("application/json");
    expect(plan.items[0]?.publicUrl).toBe("https://cdn.example.com/kbo-live/publish/current-state.json");
  });

  it("supports virtual-hosted style URLs when path style is disabled", () => {
    const plan = buildS3PresignedUploadPlan({
      entries: [
        {
          path: "manifests/current.json",
          contentType: "application/json",
        },
      ],
      config: {
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "secret-example-key",
        region: "us-east-1",
        bucket: "kbo-live",
        endpoint: "https://s3.example.com",
        expiresInSeconds: 300,
        forcePathStyle: false,
      },
      now: new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(plan.items[0]?.uploadUrl.startsWith("https://kbo-live.s3.example.com/manifests/current.json?")).toBe(true);
  });
});
