import { KBO_POSTSEASON_CUTOFF } from "@/lib/domain/kbo/constants";
import { emptyPostseasonOdds, simulatePostseasonRun } from "@/lib/domain/kbo/postseason";
import { sortStandingRowsWithTiebreakers } from "@/lib/domain/kbo/tiebreakers";
import type {
  BucketOdds,
  ExpectedRecord,
  Game,
  GameProbabilitySnapshot,
  KboSeasonRuleset,
  PostseasonOdds,
  ScenarioOverride,
  SeasonTeam,
  SimulationInput,
  SimulationSnapshot,
  StandingRow,
  TeamDisplay,
  TeamSeasonStat,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";
import { buildGameProbabilitySnapshot } from "@/lib/sim/kbo/probabilities";
import { buildPregameEloDiffByGameId } from "@/lib/sim/kbo/direct-game/elo";
import { buildPlayerImpactContext } from "@/lib/sim/kbo/player-impact";
import { buildRestGapByGame } from "@/lib/sim/kbo/rest-gap";
import { resolveForcedOutcomeForGame } from "@/lib/sim/kbo/scenario";
import { buildTeamStrengthSnapshots } from "@/lib/sim/kbo/strength";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

type MutableRecord = {
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
};

function createInitialRecordMap(
  games: Game[],
  teamSeasonStats: TeamSeasonStat[],
  seasonTeams: SeasonTeam[],
): Record<string, MutableRecord> {
  const gamesCount = games.filter(
    (game) => game.status === "final" && game.homeScore !== null && game.awayScore !== null,
  ).length * 2;
  const officialCount = teamSeasonStats.reduce((sum, stat) => sum + stat.wins + stat.losses + stat.ties, 0);

  const shouldUseOfficialStats = officialCount > gamesCount;
  const statById = Object.fromEntries(teamSeasonStats.map((stat) => [stat.seasonTeamId, stat]));
  const records = Object.fromEntries(
    seasonTeams.map((seasonTeam) => {
      const stat = statById[seasonTeam.seasonTeamId];
      return [
        seasonTeam.seasonTeamId,
        shouldUseOfficialStats && stat
          ? {
              wins: stat.wins,
              losses: stat.losses,
              ties: stat.ties,
              runsScored: stat.runsScored,
              runsAllowed: stat.runsAllowed,
            }
          : { wins: 0, losses: 0, ties: 0, runsScored: 0, runsAllowed: 0 },
      ];
    }),
  );

  if (shouldUseOfficialStats) {
    return records;
  }

  for (const game of games) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) {
      continue;
    }

    const home = records[game.homeSeasonTeamId];
    const away = records[game.awaySeasonTeamId];
    home.runsScored += game.homeScore;
    home.runsAllowed += game.awayScore;
    away.runsScored += game.awayScore;
    away.runsAllowed += game.homeScore;

    if (game.isTie || game.homeScore === game.awayScore) {
      home.ties += 1;
      away.ties += 1;
      continue;
    }

    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return records;
}

function sampleOutcome(
  probability: GameProbabilitySnapshot,
  random: () => number,
): "homeWin" | "awayWin" | "tie" {
  const roll = random();
  if (roll < probability.homeWinProb) {
    return "homeWin";
  }
  if (roll < probability.homeWinProb + probability.tieProb) {
    return "tie";
  }
  return "awayWin";
}

function sampleStandardNormal(random: () => number): number {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function samplePoisson(lambda: number, random: () => number): number {
  if (lambda <= 0) {
    return 0;
  }

  if (lambda > 12) {
    return Math.max(
      0,
      Math.round(lambda + Math.sqrt(lambda) * sampleStandardNormal(random)),
    );
  }

  const limit = Math.exp(-lambda);
  let product = 1;
  let count = -1;

  do {
    count += 1;
    product *= random();
  } while (product > limit);

  return count;
}

function sampleGameScore(
  probability: GameProbabilitySnapshot,
  tiesAllowed: boolean,
  random: () => number,
) {
  const targetOutcome = sampleOutcome(probability, random);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const homeScore = samplePoisson(probability.expectedRunsHome, random);
    const awayScore = samplePoisson(probability.expectedRunsAway, random);

    if (targetOutcome === "tie" && tiesAllowed && homeScore === awayScore) {
      return { homeScore, awayScore, isTie: true, outcome: "tie" as const };
    }

    if (targetOutcome === "homeWin" && homeScore > awayScore) {
      return { homeScore, awayScore, isTie: false, outcome: "homeWin" as const };
    }

    if (targetOutcome === "awayWin" && awayScore > homeScore) {
      return { homeScore, awayScore, isTie: false, outcome: "awayWin" as const };
    }
  }

  const fallbackHome = samplePoisson(probability.expectedRunsHome, random);
  const fallbackAway = samplePoisson(probability.expectedRunsAway, random);

  if (targetOutcome === "tie" && tiesAllowed) {
    const tiedScore = Math.max(0, Math.round((fallbackHome + fallbackAway) / 2));
    return {
      homeScore: tiedScore,
      awayScore: tiedScore,
      isTie: true,
      outcome: "tie" as const,
    };
  }

  if (targetOutcome === "homeWin") {
    const awayScore = Math.max(0, Math.min(fallbackHome, fallbackAway));
    return {
      homeScore: Math.max(fallbackHome, awayScore + 1),
      awayScore,
      isTie: false,
      outcome: "homeWin" as const,
    };
  }

  const homeScore = Math.max(0, Math.min(fallbackHome, fallbackAway));
  return {
    homeScore,
    awayScore: Math.max(fallbackAway, homeScore + 1),
    isTie: false,
    outcome: "awayWin" as const,
  };
}

function applySimulatedGameResult(
  game: Game,
  probability: GameProbabilitySnapshot,
  recordMap: Record<string, MutableRecord>,
  simulatedGames: Game[],
  tiesAllowed: boolean,
  random: () => number,
) {
  const home = recordMap[game.homeSeasonTeamId];
  const away = recordMap[game.awaySeasonTeamId];
  const sampled = sampleGameScore(probability, tiesAllowed, random);

  if (sampled.isTie) {
    home.ties += 1;
    away.ties += 1;
  } else if (sampled.outcome === "homeWin") {
    home.wins += 1;
    away.losses += 1;
  } else {
    away.wins += 1;
    home.losses += 1;
  }

  home.runsScored += sampled.homeScore;
  home.runsAllowed += sampled.awayScore;
  away.runsScored += sampled.awayScore;
  away.runsAllowed += sampled.homeScore;

  simulatedGames.push({
    ...game,
    status: "final",
    homeScore: sampled.homeScore,
    awayScore: sampled.awayScore,
    innings: 9,
    isTie: sampled.isTie,
  });
}

function buildSimulationRow(
  seasonTeamId: string,
  record: MutableRecord,
  teamDisplay: TeamDisplay,
): StandingRow {
  const pct = record.wins + record.losses === 0 ? 0 : record.wins / (record.wins + record.losses);
  return {
    ...teamDisplay,
    rank: 0,
    games: record.wins + record.losses + record.ties,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    pct: Number(pct.toFixed(3)),
    gamesBack: 0,
    recent10: "-",
    streak: "-",
    home: "-",
    away: "-",
    runsScored: record.runsScored,
    runsAllowed: record.runsAllowed,
    offensePlus: 100,
    pitchingPlus: 100,
  };
}

function buildTeamStatForRanking(seasonId: string, seasonTeamId: string, record: MutableRecord): TeamSeasonStat {
  return {
    seasonId,
    seasonTeamId,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    runsScored: record.runsScored,
    runsAllowed: record.runsAllowed,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0,
    last10: "-",
    streak: "-",
    offensePlus: 100,
    pitchingPlus: 100,
    bullpenEra: 4,
    teamWar: 0,
  };
}

export type QualificationByWinsRow = {
  additionalWins: number;
  total: number;
  first: number;
  top2: number;
  postseason: number;
  ks: number;
  champion: number;
};

function buildSimulationEnvironment(input: SimulationInput) {
  const playerImpactContext = buildPlayerImpactContext({
    seasonTeams: input.seasonTeams,
    games: input.games,
    teamSeasonStats: input.teamSeasonStats,
    players: input.players,
    rosterEvents: input.rosterEvents,
    playerSeasonStats: input.playerSeasonStats,
    playerGameStats: input.playerGameStats,
  });
  const teamStrengths = buildTeamStrengthSnapshots(
    input.seasonTeams,
    input.teamSeasonStats,
    input.previousSeasonStats,
    input.games,
    playerImpactContext.byTeamId,
    input.ruleset.regularSeasonGamesPerTeam,
  );
  const strengthMap = Object.fromEntries(
    teamStrengths.map((item) => [item.seasonTeamId, item]),
  );
  const restGapByGameId = buildRestGapByGame(input.games);
  const eloDiffByGameId = buildPregameEloDiffByGameId({
    games: input.games,
    previousSeasonStats: input.previousSeasonStats,
  });
  const gameProbabilities = input.games
    .filter((game) => game.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    .map((game) =>
      buildGameProbabilitySnapshot(
        game,
        strengthMap[game.homeSeasonTeamId],
        strengthMap[game.awaySeasonTeamId],
        input.ruleset.tiesAllowed,
        playerImpactContext.starterByGameId[game.gameId],
        undefined,
        {
          restGap: restGapByGameId[game.gameId] ?? null,
          eloDiff: eloDiffByGameId[game.gameId] ?? null,
        },
      ),
    );

  return {
    strengthMap,
    teamStrengths,
    gameProbabilities,
  };
}

export function simulateSeason(input: SimulationInput, iterations = 1200): SimulationSnapshot {
  const { strengthMap, teamStrengths, gameProbabilities } = buildSimulationEnvironment(input);
  const probabilitiesById = Object.fromEntries(gameProbabilities.map((item) => [item.gameId, item]));
  const teamDisplays = input.seasonTeams.map((seasonTeam) => {
    const labelBits = seasonTeam.seasonTeamId.split(":");
    return {
      seasonTeamId: seasonTeam.seasonTeamId,
      franchiseId: seasonTeam.franchiseId,
      brandId: seasonTeam.brandId,
      teamSlug: seasonTeam.franchiseId,
      displayNameKo: labelBits[1].toUpperCase(),
      shortNameKo: labelBits[1].toUpperCase(),
      shortCode: labelBits[1].slice(0, 3).toUpperCase(),
      primaryColor: "#0f172a",
      secondaryColor: "#e2e8f0",
    };
  });
  const displayById = Object.fromEntries(teamDisplays.map((item) => [item.seasonTeamId, item]));

  const baseRecordMap = createInitialRecordMap(input.games, input.teamSeasonStats, input.seasonTeams);
  const remainingGames = input.games
    .filter((game) => game.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const seriesById = Object.fromEntries(input.series.map((item) => [item.seriesId, item]));

  const rankCounts = Object.fromEntries(
    input.seasonTeams.map((seasonTeam) => [seasonTeam.seasonTeamId, Array.from({ length: input.seasonTeams.length }, () => 0)]),
  ) as Record<string, number[]>;
  const bucketAccumulator = Object.fromEntries(
    input.seasonTeams.map((seasonTeam) => [
      seasonTeam.seasonTeamId,
      { first: 0, second: 0, third: 0, fourth: 0, fifth: 0, missPostseason: 0 },
    ]),
  ) as Record<string, Omit<BucketOdds, "seasonTeamId">>;
  const postseasonAccumulator = Object.fromEntries(
    input.seasonTeams.map((seasonTeam) => [seasonTeam.seasonTeamId, emptyPostseasonOdds(seasonTeam.seasonTeamId)]),
  ) as Record<string, PostseasonOdds>;
  const expectedAccumulator = Object.fromEntries(
    input.seasonTeams.map((seasonTeam) => [
      seasonTeam.seasonTeamId,
      { expectedWins: 0, expectedLosses: 0, expectedTies: 0, averageRank: 0 },
    ]),
  ) as Record<string, Omit<ExpectedRecord, "seasonTeamId">>;
  const tieAccumulator: Record<string, number> = {};

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const random = mulberry32(hashSeed(`${input.season.seasonId}:${iteration}`));
    const recordMap = Object.fromEntries(
      Object.entries(baseRecordMap).map(([seasonTeamId, record]) => [
        seasonTeamId,
        { ...record },
      ]),
    ) as Record<string, MutableRecord>;
    const simulatedGames: Game[] = input.games
      .filter((game) => game.status === "final")
      .map((game) => ({ ...game }));

    for (const game of remainingGames) {
      const probability = probabilitiesById[game.gameId];
      const forced = resolveForcedOutcomeForGame(
        game,
        remainingGames,
        seriesById,
        input.scenarioOverrides,
      );
      if (forced === "homeWin" || forced === "awayWin" || (forced === "tie" && input.ruleset.tiesAllowed)) {
        const home = recordMap[game.homeSeasonTeamId];
        const away = recordMap[game.awaySeasonTeamId];
        const baselineHome = samplePoisson(probability.expectedRunsHome, random);
        const baselineAway = samplePoisson(probability.expectedRunsAway, random);
        const sampled =
          forced === "tie"
            ? {
                homeScore: Math.max(
                  0,
                  Math.round((baselineHome + baselineAway) / 2),
                ),
                awayScore: Math.max(
                  0,
                  Math.round((baselineHome + baselineAway) / 2),
                ),
                isTie: true,
              }
            : forced === "homeWin"
              ? {
                  homeScore: Math.max(baselineHome, baselineAway + 1),
                  awayScore: Math.min(baselineAway, Math.max(baselineHome, baselineAway + 1) - 1),
                  isTie: false,
                }
              : {
                  awayScore: Math.max(baselineAway, baselineHome + 1),
                  homeScore: Math.min(baselineHome, Math.max(baselineAway, baselineHome + 1) - 1),
                  isTie: false,
                };

        if (sampled.isTie) {
          home.ties += 1;
          away.ties += 1;
        } else if (forced === "homeWin") {
          home.wins += 1;
          away.losses += 1;
        } else {
          away.wins += 1;
          home.losses += 1;
        }

        home.runsScored += sampled.homeScore;
        home.runsAllowed += sampled.awayScore;
        away.runsScored += sampled.awayScore;
        away.runsAllowed += sampled.homeScore;

        simulatedGames.push({
          ...game,
          status: "final",
          homeScore: sampled.homeScore,
          awayScore: sampled.awayScore,
          innings: 9,
          isTie: sampled.isTie,
        });
        continue;
      }

      applySimulatedGameResult(
        game,
        probability,
        recordMap,
        simulatedGames,
        input.ruleset.tiesAllowed,
        random,
      );
    }

    const rows = input.seasonTeams.map((seasonTeam) =>
      buildSimulationRow(
        seasonTeam.seasonTeamId,
        recordMap[seasonTeam.seasonTeamId],
        displayById[seasonTeam.seasonTeamId],
      ),
    );
    const rankingStats = input.seasonTeams.map((seasonTeam) =>
      buildTeamStatForRanking(
        input.season.seasonId,
        seasonTeam.seasonTeamId,
        recordMap[seasonTeam.seasonTeamId],
      ),
    );
    const { rows: rankedRows, tieAlerts } = sortStandingRowsWithTiebreakers(
      rows,
      simulatedGames,
      input.ruleset,
      rankingStats,
    );

    tieAlerts.forEach((alert) => {
      const key = JSON.stringify({
        positions: alert.positions,
        seasonTeamIds: alert.seasonTeamIds,
      });
      tieAccumulator[key] = (tieAccumulator[key] ?? 0) + 1;
    });

    rankedRows.forEach((row, index) => {
      rankCounts[row.seasonTeamId][index] += 1;
      expectedAccumulator[row.seasonTeamId].averageRank += index + 1;
      expectedAccumulator[row.seasonTeamId].expectedWins += recordMap[row.seasonTeamId].wins;
      expectedAccumulator[row.seasonTeamId].expectedLosses += recordMap[row.seasonTeamId].losses;
      expectedAccumulator[row.seasonTeamId].expectedTies += recordMap[row.seasonTeamId].ties;

      if (index === 0) {
        bucketAccumulator[row.seasonTeamId].first += 1;
      } else if (index === 1) {
        bucketAccumulator[row.seasonTeamId].second += 1;
      } else if (index === 2) {
        bucketAccumulator[row.seasonTeamId].third += 1;
      } else if (index === 3) {
        bucketAccumulator[row.seasonTeamId].fourth += 1;
      } else if (index === 4) {
        bucketAccumulator[row.seasonTeamId].fifth += 1;
      } else {
        bucketAccumulator[row.seasonTeamId].missPostseason += 1;
      }
    });

    const roundReached = simulatePostseasonRun(rankedRows, strengthMap, input.ruleset, random);
    Object.entries(roundReached).forEach(([seasonTeamId, reached]) => {
      const odds = postseasonAccumulator[seasonTeamId];
      if (reached >= 1) {
        odds.wildcard += 1;
      }
      if (reached >= 2) {
        odds.semipo += 1;
      }
      if (reached >= 3) {
        odds.po += 1;
      }
      if (reached >= 4) {
        odds.ks += 1;
      }
      if (reached >= 5) {
        odds.champion += 1;
      }
    });
  }

  return {
    seasonId: input.season.seasonId,
    generatedAt: new Date().toISOString(),
    iterations,
    rankDistributions: input.seasonTeams.map((seasonTeam) => ({
      seasonTeamId: seasonTeam.seasonTeamId,
      counts: rankCounts[seasonTeam.seasonTeamId],
      probabilities: rankCounts[seasonTeam.seasonTeamId].map((count) => Number((count / iterations).toFixed(4))),
    })),
    bucketOdds: input.seasonTeams.map((seasonTeam) => ({
      seasonTeamId: seasonTeam.seasonTeamId,
      first: Number((bucketAccumulator[seasonTeam.seasonTeamId].first / iterations).toFixed(4)),
      second: Number((bucketAccumulator[seasonTeam.seasonTeamId].second / iterations).toFixed(4)),
      third: Number((bucketAccumulator[seasonTeam.seasonTeamId].third / iterations).toFixed(4)),
      fourth: Number((bucketAccumulator[seasonTeam.seasonTeamId].fourth / iterations).toFixed(4)),
      fifth: Number((bucketAccumulator[seasonTeam.seasonTeamId].fifth / iterations).toFixed(4)),
      missPostseason: Number((bucketAccumulator[seasonTeam.seasonTeamId].missPostseason / iterations).toFixed(4)),
    })),
    postseasonOdds: input.seasonTeams.map((seasonTeam) => {
      const entry = postseasonAccumulator[seasonTeam.seasonTeamId];
      return {
        seasonTeamId: seasonTeam.seasonTeamId,
        wildcard: Number((entry.wildcard / iterations).toFixed(4)),
        semipo: Number((entry.semipo / iterations).toFixed(4)),
        po: Number((entry.po / iterations).toFixed(4)),
        ks: Number((entry.ks / iterations).toFixed(4)),
        champion: Number((entry.champion / iterations).toFixed(4)),
      };
    }),
    expectedRecords: input.seasonTeams.map((seasonTeam) => ({
      seasonTeamId: seasonTeam.seasonTeamId,
      expectedWins: Number((expectedAccumulator[seasonTeam.seasonTeamId].expectedWins / iterations).toFixed(1)),
      expectedLosses: Number((expectedAccumulator[seasonTeam.seasonTeamId].expectedLosses / iterations).toFixed(1)),
      expectedTies: Number((expectedAccumulator[seasonTeam.seasonTeamId].expectedTies / iterations).toFixed(1)),
      averageRank: Number((expectedAccumulator[seasonTeam.seasonTeamId].averageRank / iterations).toFixed(2)),
    })),
    tieAlerts: Object.entries(tieAccumulator)
      .map(([key, count]) => {
        const parsed = JSON.parse(key) as { positions: number[]; seasonTeamIds: string[] };
        return {
          positions: parsed.positions,
          seasonTeamIds: parsed.seasonTeamIds,
          probability: Number((count / iterations).toFixed(4)),
          note: `${parsed.positions.join("-")}위 선상 동률 가능성`,
        };
      })
      .sort((left, right) => right.probability - left.probability)
      .slice(0, 5),
    gameProbabilities,
    teamStrengths,
  };
}

export function simulateQualificationByWins(
  input: SimulationInput,
  selectedTeamId: string,
  iterations = 1200,
): QualificationByWinsRow[] {
  const { strengthMap, gameProbabilities } = buildSimulationEnvironment(input);
  const probabilitiesById = Object.fromEntries(gameProbabilities.map((item) => [item.gameId, item]));
  const teamDisplays = input.seasonTeams.map((seasonTeam) => {
    const labelBits = seasonTeam.seasonTeamId.split(":");
    return {
      seasonTeamId: seasonTeam.seasonTeamId,
      franchiseId: seasonTeam.franchiseId,
      brandId: seasonTeam.brandId,
      teamSlug: seasonTeam.franchiseId,
      displayNameKo: labelBits[1].toUpperCase(),
      shortNameKo: labelBits[1].toUpperCase(),
      shortCode: labelBits[1].slice(0, 3).toUpperCase(),
      primaryColor: "#0f172a",
      secondaryColor: "#e2e8f0",
    };
  });
  const displayById = Object.fromEntries(teamDisplays.map((item) => [item.seasonTeamId, item]));
  const baseRecordMap = createInitialRecordMap(input.games, input.teamSeasonStats, input.seasonTeams);
  const baseWins = baseRecordMap[selectedTeamId]?.wins ?? 0;
  const remainingGames = input.games
    .filter((game) => game.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const seriesById = Object.fromEntries(input.series.map((item) => [item.seriesId, item]));
  const accumulator: Record<number, Omit<QualificationByWinsRow, "additionalWins">> = {};

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const random = mulberry32(hashSeed(`${input.season.seasonId}:qualification:${selectedTeamId}:${iteration}`));
    const recordMap = Object.fromEntries(
      Object.entries(baseRecordMap).map(([seasonTeamId, record]) => [
        seasonTeamId,
        { ...record },
      ]),
    ) as Record<string, MutableRecord>;
    const simulatedGames: Game[] = input.games
      .filter((game) => game.status === "final")
      .map((game) => ({ ...game }));

    for (const game of remainingGames) {
      const probability = probabilitiesById[game.gameId];
      const forced = resolveForcedOutcomeForGame(
        game,
        remainingGames,
        seriesById,
        input.scenarioOverrides,
      );
      if (forced === "homeWin" || forced === "awayWin" || (forced === "tie" && input.ruleset.tiesAllowed)) {
        const home = recordMap[game.homeSeasonTeamId];
        const away = recordMap[game.awaySeasonTeamId];
        const baselineHome = samplePoisson(probability.expectedRunsHome, random);
        const baselineAway = samplePoisson(probability.expectedRunsAway, random);
        const sampled =
          forced === "tie"
            ? {
                homeScore: Math.max(
                  0,
                  Math.round((baselineHome + baselineAway) / 2),
                ),
                awayScore: Math.max(
                  0,
                  Math.round((baselineHome + baselineAway) / 2),
                ),
                isTie: true,
              }
            : forced === "homeWin"
              ? {
                  homeScore: Math.max(baselineHome, baselineAway + 1),
                  awayScore: Math.min(baselineAway, Math.max(baselineHome, baselineAway + 1) - 1),
                  isTie: false,
                }
              : {
                  awayScore: Math.max(baselineAway, baselineHome + 1),
                  homeScore: Math.min(baselineHome, Math.max(baselineAway, baselineHome + 1) - 1),
                  isTie: false,
                };

        if (sampled.isTie) {
          home.ties += 1;
          away.ties += 1;
        } else if (forced === "homeWin") {
          home.wins += 1;
          away.losses += 1;
        } else {
          away.wins += 1;
          home.losses += 1;
        }

        home.runsScored += sampled.homeScore;
        home.runsAllowed += sampled.awayScore;
        away.runsScored += sampled.awayScore;
        away.runsAllowed += sampled.homeScore;

        simulatedGames.push({
          ...game,
          status: "final",
          homeScore: sampled.homeScore,
          awayScore: sampled.awayScore,
          innings: 9,
          isTie: sampled.isTie,
        });
        continue;
      }

      applySimulatedGameResult(
        game,
        probability,
        recordMap,
        simulatedGames,
        input.ruleset.tiesAllowed,
        random,
      );
    }

    const rows = input.seasonTeams.map((seasonTeam) =>
      buildSimulationRow(
        seasonTeam.seasonTeamId,
        recordMap[seasonTeam.seasonTeamId],
        displayById[seasonTeam.seasonTeamId],
      ),
    );
    const rankingStats = input.seasonTeams.map((seasonTeam) =>
      buildTeamStatForRanking(
        input.season.seasonId,
        seasonTeam.seasonTeamId,
        recordMap[seasonTeam.seasonTeamId],
      ),
    );
    const { rows: rankedRows } = sortStandingRowsWithTiebreakers(
      rows,
      simulatedGames,
      input.ruleset,
      rankingStats,
    );
    const selectedRank = rankedRows.findIndex((row) => row.seasonTeamId === selectedTeamId);
    if (selectedRank < 0) {
      continue;
    }

    const roundReached = simulatePostseasonRun(rankedRows, strengthMap, input.ruleset, random);
    const additionalWins = recordMap[selectedTeamId].wins - baseWins;
    accumulator[additionalWins] ??= {
      total: 0,
      first: 0,
      top2: 0,
      postseason: 0,
      ks: 0,
      champion: 0,
    };

    const entry = accumulator[additionalWins];
    entry.total += 1;
    if (selectedRank === 0) {
      entry.first += 1;
    }
    if (selectedRank <= 1) {
      entry.top2 += 1;
    }
    if (selectedRank < KBO_POSTSEASON_CUTOFF) {
      entry.postseason += 1;
    }
    if ((roundReached[selectedTeamId] ?? 0) >= 4) {
      entry.ks += 1;
    }
    if ((roundReached[selectedTeamId] ?? 0) >= 5) {
      entry.champion += 1;
    }
  }

  return Object.entries(accumulator)
    .map(([additionalWins, entry]) => ({
      additionalWins: Number.parseInt(additionalWins, 10),
      ...entry,
    }))
    .sort((left, right) => left.additionalWins - right.additionalWins);
}
