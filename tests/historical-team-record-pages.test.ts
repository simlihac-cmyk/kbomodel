import { describe, expect, it } from "vitest";

import { mergeHistoricalTeamRecordPages } from "@/lib/data-sources/kbo/fetch/historical-team-record-pages";

describe("historical team record page fetch helpers", () => {
  it("merges decade pages into a single parser-friendly html document", () => {
    const merged = mergeHistoricalTeamRecordPages([
      {
        html: `
          <html><body>
            <table class="tData"><thead><tr><th scope="col">2025</th></tr></thead><tbody></tbody></table>
          </body></html>
        `,
        fetchedAt: "2026-04-17T01:00:00.000Z",
        httpStatus: 200,
        checksum: "one",
        sourceUrl: "https://example.com/2020s",
      },
      {
        html: `
          <html><body>
            <table class="tData"><thead><tr><th scope="col">2017</th></tr></thead><tbody></tbody></table>
          </body></html>
        `,
        fetchedAt: "2026-04-17T01:05:00.000Z",
        httpStatus: 200,
        checksum: "two",
        sourceUrl: "https://example.com/2010s",
      },
    ]);

    expect(merged.html).toContain('<table class="tData">');
    expect(merged.html).toContain(">2025<");
    expect(merged.html).toContain(">2017<");
    expect(merged.fetchedAt).toBe("2026-04-17T01:05:00.000Z");
    expect(merged.httpStatus).toBe(200);
  });
});
