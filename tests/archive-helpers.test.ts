import { describe, expect, it } from "vitest";

import {
  buildArchiveStandingsRows,
  buildArchiveHeadline,
  buildArchiveNarrative,
  getHistoricalRowsForFranchise,
  getHistoricalRowsForYear,
  hasCompleteHistoricalStandings,
  inferHistoricalGameCount,
  summarizeHistoricalCoverage,
} from "@/lib/archive/kbo-archive";

const rows = [
  {
    year: 2025,
    franchiseId: "lg",
    brandLabel: "LG 트윈스",
    rank: 1,
    wins: 87,
    losses: 53,
    ties: 4,
    postseasonResult: "우승",
  },
  {
    year: 2025,
    franchiseId: "doosan",
    brandLabel: "두산 베어스",
    rank: 4,
    wins: 72,
    losses: 67,
    ties: 5,
    postseasonResult: "준플레이오프",
  },
  {
    year: 2024,
    franchiseId: "kia",
    brandLabel: "KIA 타이거즈",
    rank: 1,
    wins: 86,
    losses: 56,
    ties: 2,
    postseasonResult: "우승",
  },
];

describe("archive helpers", () => {
  it("filters rows by year and rank order", () => {
    const seasonRows = getHistoricalRowsForYear(rows, 2025);
    expect(seasonRows).toHaveLength(2);
    expect(seasonRows[0]?.brandLabel).toBe("LG 트윈스");
  });

  it("builds archive headline and narrative from official rows", () => {
    const seasonRows = getHistoricalRowsForYear(rows, 2025);
    expect(buildArchiveHeadline(2025, seasonRows)).toBe("2025 LG 트윈스 우승 시즌");
    expect(buildArchiveNarrative(2025, seasonRows)[0]).toContain("정규시즌 1위");
  });

  it("filters franchise rows newest first", () => {
    const franchiseRows = getHistoricalRowsForFranchise(rows, "kia");
    expect(franchiseRows).toHaveLength(1);
    expect(franchiseRows[0]?.year).toBe(2024);
  });

  it("summarizes official coverage windows", () => {
    expect(summarizeHistoricalCoverage(rows)).toBe("2024-2025 공식 historical record");
    expect(summarizeHistoricalCoverage([])).toBe("공식 historical record 미확보");
  });

  it("builds archive standings rows from official historical records", () => {
    const standingsRows = buildArchiveStandingsRows(getHistoricalRowsForYear(rows, 2025), [
      {
        seasonTeamId: "kbo-2025:lg",
        brandId: "lg-twins",
        franchiseId: "lg",
        teamSlug: "lg",
        displayNameKo: "LG 트윈스",
        shortNameKo: "LG",
        shortCode: "LG",
        primaryColor: "#c30452",
        secondaryColor: "#111111",
      },
      {
        seasonTeamId: "kbo-2025:doosan",
        brandId: "doosan-bears",
        franchiseId: "doosan",
        teamSlug: "doosan",
        displayNameKo: "두산 베어스",
        shortNameKo: "두산",
        shortCode: "두산",
        primaryColor: "#0d2b6b",
        secondaryColor: "#111111",
      },
    ]);

    expect(standingsRows).toHaveLength(2);
    expect(standingsRows[0]).toMatchObject({
      seasonTeamId: "kbo-2025:lg",
      rank: 1,
      wins: 87,
      losses: 53,
      ties: 4,
      gamesBack: 0,
    });
    expect(standingsRows[1]?.gamesBack).toBeGreaterThan(0);
    expect(standingsRows[0]?.recent10).toBe("-");
  });

  it("checks archive standings and game coverage thresholds from official rows", () => {
    expect(hasCompleteHistoricalStandings(getHistoricalRowsForYear(rows, 2025), 2)).toBe(true);
    expect(hasCompleteHistoricalStandings(getHistoricalRowsForYear(rows, 2025), 3)).toBe(false);
    expect(inferHistoricalGameCount(getHistoricalRowsForYear(rows, 2025))).toBe(144);
  });
});
