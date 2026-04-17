import { describe, expect, it } from "vitest";

import type { SeasonTeam, TeamSeasonStat } from "@/lib/domain/kbo/types";
import { buildTeamStrengthSnapshots } from "@/lib/sim/kbo/strength";

describe("buildTeamStrengthSnapshots", () => {
  const seasonTeams: SeasonTeam[] = [
    {
      seasonTeamId: "season:lg",
      seasonId: "kbo-2026",
      franchiseId: "lg",
      brandId: "lg",
      venueId: "jamsil",
      managerNameKo: "감독",
      preseasonPriors: {
        offenseRating: 104,
        starterRating: 103,
        bullpenRating: 102,
      },
      manualAdjustments: [],
      preseasonOutlook: "우승 후보",
    },
  ];

  const earlyStat: TeamSeasonStat = {
    seasonId: "kbo-2026",
    seasonTeamId: "season:lg",
    wins: 9,
    losses: 5,
    ties: 0,
    runsScored: 85,
    runsAllowed: 60,
    homeWins: 5,
    homeLosses: 2,
    awayWins: 4,
    awayLosses: 3,
    last10: "7-3-0",
    streak: "승3",
    offensePlus: 126,
    pitchingPlus: 118,
    bullpenEra: 3.05,
    teamWar: 6.2,
  };

  const lateStat: TeamSeasonStat = {
    ...earlyStat,
    wins: 67,
    losses: 41,
    ties: 0,
    runsScored: 590,
    runsAllowed: 470,
  };

  it("keeps current-season weight conservative early and opens up later", () => {
    const early = buildTeamStrengthSnapshots(
      seasonTeams,
      [earlyStat],
      [],
      [],
      {},
      144,
    )[0]!;
    const late = buildTeamStrengthSnapshots(
      seasonTeams,
      [lateStat],
      [],
      [],
      {},
      144,
    )[0]!;

    expect(early.currentWeight).toBeLessThan(0.2);
    expect(late.currentWeight).toBeGreaterThan(early.currentWeight);
    expect(early.confidenceScore).toBeLessThan(late.confidenceScore);
    expect(
      Math.abs(early.offenseRating - seasonTeams[0]!.preseasonPriors.offenseRating),
    ).toBeLessThan(
      Math.abs(late.offenseRating - seasonTeams[0]!.preseasonPriors.offenseRating),
    );
  });

  it("leans on shared team state more than team-plus summary metrics", () => {
    const stateDriven = buildTeamStrengthSnapshots(
      seasonTeams,
      [earlyStat],
      [],
      [],
      {},
      144,
    )[0]!;
    const noisyPlus = buildTeamStrengthSnapshots(
      seasonTeams,
      [
        {
          ...earlyStat,
          offensePlus: 89,
          pitchingPlus: 87,
          bullpenEra: 5.4,
        },
      ],
      [],
      [],
      {},
      144,
    )[0]!;

    expect(Math.abs(stateDriven.offenseRating - noisyPlus.offenseRating)).toBeLessThan(1);
    expect(Math.abs(stateDriven.starterRating - noisyPlus.starterRating)).toBeLessThan(1.2);
    expect(Math.abs(stateDriven.bullpenRating - noisyPlus.bullpenRating)).toBeLessThan(1.2);
  });
});
