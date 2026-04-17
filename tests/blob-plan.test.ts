import { describe, expect, it } from "vitest";

import { buildBlobUploadPlan } from "@/lib/publish/blob-plan";

describe("blob upload plan", () => {
  it("builds deterministic upload targets from entries", () => {
    const plan = buildBlobUploadPlan({
      entries: [
        {
          path: "publish/current-state.json",
          contentType: "application/json",
        },
      ],
      baseUrl: "https://blob.example.com/base",
      pathPrefix: "kbo/live",
      publicBaseUrl: "https://cdn.example.com/base",
      authHeaderName: "x-api-key",
      authHeaderValue: "secret",
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.uploadUrl).toBe(
      "https://blob.example.com/base/kbo/live/publish/current-state.json",
    );
    expect(plan.items[0]?.publicUrl).toBe(
      "https://cdn.example.com/base/kbo/live/publish/current-state.json",
    );
    expect(plan.items[0]?.headers["x-api-key"]).toBe("secret");
  });
});
