import type { Game, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
import type { GameOutcomeTrainingExample } from "@/lib/data-sources/kbo/training-corpus-types";
import {
  CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS,
} from "@/lib/sim/kbo/current-probability-adjustment-parameters";
import {
  PROBABILITY_ADJUSTMENT_FEATURE_KEYS,
  type ProbabilityAdjustmentFeatureKey,
  type ProbabilityAdjustmentFeatureWeights,
  type ProbabilityAdjustmentParameterSet,
} from "@/lib/sim/kbo/probability-adjustment-parameters";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeValue(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function scaleRange(value: number, divisor: number, cap = 1.5) {
  return clamp(value / divisor, -cap, cap);
}

export type ProbabilityAdjustmentFeatureVector = Record<ProbabilityAdjustmentFeatureKey, number>;

export type ProbabilityAdjustmentRuntimeContext = {
  restGap: number | null;
};

type FeatureInputs = {
  recent10Gap: number;
  pctGap: number;
  venueSplitGap: number;
  restGap: number | null;
  seasonProgress: number;
};

function buildFeatureVector(inputs: FeatureInputs): ProbabilityAdjustmentFeatureVector {
  const restGap = scaleRange(safeValue(inputs.restGap), 4, 1.25);
  const seasonProgress = clamp(inputs.seasonProgress, 0, 1);
  const recent10Gap = clamp(inputs.recent10Gap, -1, 1);
  const pctGap = clamp(inputs.pctGap, -1, 1);
  const venueSplitGap = clamp(inputs.venueSplitGap, -1, 1);

  return {
    recent10Gap,
    pctGap,
    venueSplitGap,
    restGap,
    seasonProgress,
    recent10ByProgress: recent10Gap * (1 - seasonProgress),
    pctByProgress: pctGap * seasonProgress,
  };
}

export function buildProbabilityAdjustmentFeaturesFromRuntime(args: {
  game: Game;
  homeStrength: TeamStrengthSnapshot;
  awayStrength: TeamStrengthSnapshot;
  context: ProbabilityAdjustmentRuntimeContext;
}): ProbabilityAdjustmentFeatureVector {
  return buildFeatureVector({
    recent10Gap:
      args.homeStrength.opponentAdjustedRecent10WinRate -
      args.awayStrength.opponentAdjustedRecent10WinRate,
    pctGap: args.homeStrength.winPct - args.awayStrength.winPct,
    venueSplitGap: args.homeStrength.homePct - args.awayStrength.awayPct,
    restGap: args.context.restGap,
    seasonProgress: (args.homeStrength.seasonProgress + args.awayStrength.seasonProgress) / 2,
  });
}

export function buildProbabilityAdjustmentFeaturesFromTrainingExample(
  example: GameOutcomeTrainingExample,
): ProbabilityAdjustmentFeatureVector {
  return buildFeatureVector({
    recent10Gap: example.opponentAdjustedRecent10Gap,
    pctGap: example.pctGap,
    venueSplitGap: example.venueSplitGap,
    restGap: example.restGap,
    seasonProgress: (example.homeSeasonProgress + example.awaySeasonProgress) / 2,
  });
}

function scoreWithWeights(
  bias: number,
  weights: ProbabilityAdjustmentFeatureWeights,
  features: ProbabilityAdjustmentFeatureVector,
) {
  let total = bias;
  for (const key of PROBABILITY_ADJUSTMENT_FEATURE_KEYS) {
    total += weights[key] * features[key];
  }
  return total;
}

export function applyProbabilityAdjustment(args: {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  features: ProbabilityAdjustmentFeatureVector;
  parameters?: ProbabilityAdjustmentParameterSet;
}) {
  const parameters = args.parameters ?? CURRENT_PROBABILITY_ADJUSTMENT_PARAMETERS;
  const decisiveTotal = Math.max(1 - args.tieProb, 1e-9);
  const homeDecisiveProb = Math.max(args.homeWinProb / decisiveTotal, 1e-9);
  const awayDecisiveProb = Math.max(args.awayWinProb / decisiveTotal, 1e-9);
  const homeLogit =
    Math.log(homeDecisiveProb) +
    scoreWithWeights(parameters.homeBias, parameters.homeWeights, args.features);
  const awayLogit =
    Math.log(awayDecisiveProb) +
    scoreWithWeights(parameters.awayBias, parameters.awayWeights, args.features);
  const maxLogit = Math.max(homeLogit, awayLogit);
  const homeExp = Math.exp(homeLogit - maxLogit);
  const awayExp = Math.exp(awayLogit - maxLogit);
  const total = homeExp + awayExp;

  return {
    homeWinProb: decisiveTotal * (homeExp / total),
    awayWinProb: decisiveTotal * (awayExp / total),
    tieProb: args.tieProb,
  };
}

export function buildRestGapByGame(games: Game[]) {
  const sortedGames = [...games].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const lastGameAtByTeam = new Map<string, number>();
  const restGapByGameId: Record<string, number | null> = {};

  for (const game of sortedGames) {
    const scheduledAt = new Date(game.scheduledAt).getTime();
    const homeLast = lastGameAtByTeam.get(game.homeSeasonTeamId);
    const awayLast = lastGameAtByTeam.get(game.awaySeasonTeamId);
    const homeRest =
      homeLast === undefined ? null : clamp(Math.round((scheduledAt - homeLast) / 86_400_000) - 1, 0, 30);
    const awayRest =
      awayLast === undefined ? null : clamp(Math.round((scheduledAt - awayLast) / 86_400_000) - 1, 0, 30);
    restGapByGameId[game.gameId] =
      homeRest === null || awayRest === null ? null : homeRest - awayRest;
    lastGameAtByTeam.set(game.homeSeasonTeamId, scheduledAt);
    lastGameAtByTeam.set(game.awaySeasonTeamId, scheduledAt);
  }

  return restGapByGameId;
}
