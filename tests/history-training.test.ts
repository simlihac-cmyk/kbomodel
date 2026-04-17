import { describe, expect, it } from "vitest";

import { buildHistoryTrainingSeason } from "@/lib/data-sources/kbo/derive/build-history-training";

describe("history training season builder", () => {
  it("builds daily snapshots from official-like schedule rows and merges scoreboard detail", () => {
    const season = buildHistoryTrainingSeason({
      year: 2025,
      historicalSnapshotKey: "2026-04-17",
      historicalRows: [
        {
          year: 2025,
          franchiseId: "lg",
          brandLabel: "LG 트윈스",
          rank: 1,
          wins: 2,
          losses: 0,
          ties: 0,
          postseasonResult: null,
        },
        {
          year: 2025,
          franchiseId: "kia",
          brandLabel: "KIA 타이거즈",
          rank: 2,
          wins: 0,
          losses: 2,
          ties: 0,
          postseasonResult: null,
        },
      ],
      bundle: {
        teamBrands: [
          {
            brandId: "lg-twins",
            franchiseId: "lg",
            displayNameKo: "LG 트윈스",
            shortNameKo: "LG",
            shortCode: "LG",
            wordmarkText: "LG",
            logoPath: "/lg.svg",
            seasonStartYear: 1982,
            seasonEndYear: null,
            primaryColor: "#111111",
            secondaryColor: "#ffffff",
          },
          {
            brandId: "kia-tigers",
            franchiseId: "kia",
            displayNameKo: "KIA 타이거즈",
            shortNameKo: "KIA",
            shortCode: "KIA",
            wordmarkText: "KIA",
            logoPath: "/kia.svg",
            seasonStartYear: 1982,
            seasonEndYear: null,
            primaryColor: "#ff0000",
            secondaryColor: "#000000",
          },
        ],
      },
      snapshotDates: ["2025-03-01", "2025-03-02"],
      scheduleSnapshots: [
        {
          snapshotKey: "2025-03-01",
          rows: [
            {
              sourceGameKey: "20250301-KIA-LG-JAMSIL",
              date: "2025-03-01",
              scheduledAt: "2025-03-01T14:00:00+09:00",
              gameTimeLabel: "14:00",
              homeTeamName: "LG",
              awayTeamName: "KIA",
              venueName: "JAMSIL",
              status: "final",
              note: null,
              detailPath: null,
              homeScore: 3,
              awayScore: 1,
              innings: null,
              isTie: false,
            },
            {
              sourceGameKey: "20250302-KIA-LG-JAMSIL",
              date: "2025-03-02",
              scheduledAt: "2025-03-02T14:00:00+09:00",
              gameTimeLabel: "14:00",
              homeTeamName: "LG",
              awayTeamName: "KIA",
              venueName: "JAMSIL",
              status: "scheduled",
              note: null,
              detailPath: null,
              homeScore: null,
              awayScore: null,
              innings: null,
              isTie: false,
            },
          ],
        },
        {
          snapshotKey: "2025-03-02",
          rows: [
            {
              sourceGameKey: "20250301-KIA-LG-JAMSIL",
              date: "2025-03-01",
              scheduledAt: "2025-03-01T14:00:00+09:00",
              gameTimeLabel: "14:00",
              homeTeamName: "LG",
              awayTeamName: "KIA",
              venueName: "JAMSIL",
              status: "final",
              note: null,
              detailPath: null,
              homeScore: 3,
              awayScore: 1,
              innings: null,
              isTie: false,
            },
            {
              sourceGameKey: "20250302-KIA-LG-JAMSIL",
              date: "2025-03-02",
              scheduledAt: "2025-03-02T14:00:00+09:00",
              gameTimeLabel: "14:00",
              homeTeamName: "LG",
              awayTeamName: "KIA",
              venueName: "JAMSIL",
              status: "final",
              note: null,
              detailPath: null,
              homeScore: 5,
              awayScore: 2,
              innings: null,
              isTie: false,
            },
          ],
        },
      ],
      scoreboardSnapshots: [
        {
          snapshotKey: "2025-03-01",
          rows: [
            {
              sourceGameKey: "20250301-KIA-LG-JAMSIL",
              date: "2025-03-01",
              scheduledAt: "2025-03-01T14:00:00+09:00",
              gameTimeLabel: "14:00",
              homeTeamName: "LG",
              awayTeamName: "KIA",
              venueName: "JAMSIL",
              status: "final",
              note: null,
              detailPath: null,
              homeScore: 3,
              awayScore: 1,
              innings: 9,
              isTie: false,
              lineScore: [],
              winningPitcherName: "A",
              losingPitcherName: "B",
              savePitcherName: null,
              attendance: null,
            },
          ],
        },
      ],
    });

    expect(season.year).toBe(2025);
    expect(season.gameLedger).toHaveLength(2);
    expect(season.gameLedger[0]?.innings).toBe(9);
    expect(season.snapshots).toHaveLength(2);
    expect(season.snapshots[0]?.completedGames).toBe(1);
    expect(season.snapshots[0]?.remainingGames).toBe(1);
    expect(season.snapshots[0]?.teams[0]).toMatchObject({
      franchiseId: "lg",
      rank: 1,
      wins: 1,
      losses: 0,
      remainingGames: 1,
      winsRemainingToFinal: 1,
    });
    expect(season.snapshots[0]?.teams[1]).toMatchObject({
      franchiseId: "kia",
      rank: 2,
      wins: 0,
      losses: 1,
      remainingByOpponent: {
        lg: 1,
      },
    });
    expect(season.snapshots[1]?.teams[0]).toMatchObject({
      franchiseId: "lg",
      wins: 2,
      losses: 0,
      remainingGames: 0,
      finalRank: 1,
    });
  });
});
