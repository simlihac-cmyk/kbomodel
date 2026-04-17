import { getPostseasonRound } from "@/lib/domain/kbo/rules";
import type {
  KboSeasonRuleset,
  PostseasonOdds,
  StandingRow,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";

type RoundOutcome = {
  winnerSeasonTeamId: string;
  loserSeasonTeamId: string;
  gamesNeeded: number;
};

export type PostseasonBracket = {
  wildcard: [StandingRow, StandingRow] | null;
  semipo: [StandingRow, StandingRow] | null;
  po: [StandingRow, StandingRow] | null;
  ks: [StandingRow, StandingRow] | null;
};

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function singleGameWinProbability(
  higherSeed: TeamStrengthSnapshot,
  lowerSeed: TeamStrengthSnapshot,
): number {
  const edge =
    (higherSeed.offenseRating - lowerSeed.starterRating) * 0.012 +
    (higherSeed.starterRating - lowerSeed.offenseRating) * 0.008 +
    (higherSeed.bullpenRating - lowerSeed.bullpenRating) * 0.006 +
    higherSeed.homeFieldAdjustment;

  return Math.max(0.35, Math.min(0.78, logistic(edge)));
}

function simulateSeries(
  higherSeed: TeamStrengthSnapshot,
  lowerSeed: TeamStrengthSnapshot,
  bestOf: number,
  higherSeedAdvantageWins: number,
  random: () => number,
): RoundOutcome {
  let higherWins = higherSeedAdvantageWins;
  let lowerWins = 0;
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const higherWinProb = singleGameWinProbability(higherSeed, lowerSeed);

  while (higherWins < winsNeeded && lowerWins < winsNeeded) {
    if (random() < higherWinProb) {
      higherWins += 1;
    } else {
      lowerWins += 1;
    }
  }

  return higherWins >= winsNeeded
    ? {
        winnerSeasonTeamId: higherSeed.seasonTeamId,
        loserSeasonTeamId: lowerSeed.seasonTeamId,
        gamesNeeded: higherWins + lowerWins,
      }
    : {
        winnerSeasonTeamId: lowerSeed.seasonTeamId,
        loserSeasonTeamId: higherSeed.seasonTeamId,
        gamesNeeded: higherWins + lowerWins,
      };
}

export function createProjectedBracket(rows: StandingRow[]): PostseasonBracket {
  if (rows.length < 5) {
    return { wildcard: null, semipo: null, po: null, ks: null };
  }

  return {
    wildcard: [rows[3], rows[4]],
    semipo: [rows[2], rows[3]],
    po: [rows[1], rows[2]],
    ks: [rows[0], rows[1]],
  };
}

export function simulatePostseasonRun(
  rows: StandingRow[],
  strengthMap: Record<string, TeamStrengthSnapshot>,
  ruleset: KboSeasonRuleset,
  random: () => number,
): Record<string, number> {
  const topFive = rows.slice(0, 5);
  const roundReached: Record<string, number> = {};

  if (topFive.length < 5) {
    return roundReached;
  }

  for (const row of topFive) {
    roundReached[row.seasonTeamId] = 0;
  }

  const wildcardConfig = getPostseasonRound(ruleset, "wildcard");
  const semipoConfig = getPostseasonRound(ruleset, "semipo");
  const poConfig = getPostseasonRound(ruleset, "po");
  const ksConfig = getPostseasonRound(ruleset, "ks");

  const fourth = topFive[3];
  const fifth = topFive[4];
  roundReached[fourth.seasonTeamId] = Math.max(roundReached[fourth.seasonTeamId], 1);
  roundReached[fifth.seasonTeamId] = Math.max(roundReached[fifth.seasonTeamId], 1);
  const wildcard = simulateSeries(
    strengthMap[fourth.seasonTeamId],
    strengthMap[fifth.seasonTeamId],
    wildcardConfig.bestOf,
    wildcardConfig.higherSeedAdvantageWins,
    random,
  );
  roundReached[wildcard.winnerSeasonTeamId] = Math.max(roundReached[wildcard.winnerSeasonTeamId], 2);

  const third = topFive[2];
  roundReached[third.seasonTeamId] = Math.max(roundReached[third.seasonTeamId], 2);
  const semipo = simulateSeries(
    strengthMap[third.seasonTeamId],
    strengthMap[wildcard.winnerSeasonTeamId],
    semipoConfig.bestOf,
    semipoConfig.higherSeedAdvantageWins,
    random,
  );
  roundReached[semipo.winnerSeasonTeamId] = Math.max(roundReached[semipo.winnerSeasonTeamId], 3);

  const second = topFive[1];
  roundReached[second.seasonTeamId] = Math.max(roundReached[second.seasonTeamId], 3);
  const po = simulateSeries(
    strengthMap[second.seasonTeamId],
    strengthMap[semipo.winnerSeasonTeamId],
    poConfig.bestOf,
    poConfig.higherSeedAdvantageWins,
    random,
  );
  roundReached[po.winnerSeasonTeamId] = Math.max(roundReached[po.winnerSeasonTeamId], 4);

  const first = topFive[0];
  roundReached[first.seasonTeamId] = Math.max(roundReached[first.seasonTeamId], 4);
  const ks = simulateSeries(
    strengthMap[first.seasonTeamId],
    strengthMap[po.winnerSeasonTeamId],
    ksConfig.bestOf,
    ksConfig.higherSeedAdvantageWins,
    random,
  );
  roundReached[ks.winnerSeasonTeamId] = Math.max(roundReached[ks.winnerSeasonTeamId], 5);

  return roundReached;
}

export function emptyPostseasonOdds(seasonTeamId: string): PostseasonOdds {
  return {
    seasonTeamId,
    wildcard: 0,
    semipo: 0,
    po: 0,
    ks: 0,
    champion: 0,
  };
}
