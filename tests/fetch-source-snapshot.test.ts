import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchHtmlMock, fetchHistoricalMock } = vi.hoisted(() => ({
  fetchHtmlMock: vi.fn(),
  fetchHistoricalMock: vi.fn(),
}));

vi.mock("@/lib/data-sources/kbo/fetch/fetch-html", () => ({
  fetchHtml: fetchHtmlMock,
}));

vi.mock("@/lib/data-sources/kbo/fetch/historical-team-record-pages", () => ({
  fetchOfficialHistoricalTeamRecordPages: fetchHistoricalMock,
}));

import { fetchSnapshotForKboDataset } from "@/lib/data-sources/kbo/fetch/fetch-source-snapshot";

describe("fetchSnapshotForKboDataset", () => {
  beforeEach(() => {
    fetchHtmlMock.mockReset();
    fetchHistoricalMock.mockReset();
  });

  it("uses the merged multi-page fetcher for historical team records", async () => {
    fetchHistoricalMock.mockResolvedValue({
      html: "<html></html>",
      fetchedAt: "2026-04-17T01:00:00.000Z",
      httpStatus: 200,
      checksum: "history",
      sourceUrl: "joined-history-pages",
    });

    const result = await fetchSnapshotForKboDataset(
      "historical-team-record",
      "https://www.koreabaseball.com/Record/History/Team/Record.aspx",
    );

    expect(fetchHistoricalMock).toHaveBeenCalledTimes(1);
    expect(fetchHtmlMock).not.toHaveBeenCalled();
    expect(result.checksum).toBe("history");
  });

  it("uses the plain HTML fetcher for other datasets", async () => {
    fetchHtmlMock.mockResolvedValue({
      html: "<html></html>",
      fetchedAt: "2026-04-17T01:00:00.000Z",
      httpStatus: 200,
      checksum: "generic",
      sourceUrl: "scoreboard",
    });

    const result = await fetchSnapshotForKboDataset(
      "scoreboard",
      "https://eng.koreabaseball.com/Schedule/Scoreboard.aspx",
    );

    expect(fetchHtmlMock).toHaveBeenCalledWith("https://eng.koreabaseball.com/Schedule/Scoreboard.aspx");
    expect(fetchHistoricalMock).not.toHaveBeenCalled();
    expect(result.checksum).toBe("generic");
  });
});
