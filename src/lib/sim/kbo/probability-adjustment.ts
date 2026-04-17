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
  month: number;
  restGap: number | null;
};

type FeatureInputs = {
  recent10Gap: number;
  pctGap: number;
  venueSplitGap: number;
  restGap: number | null;
  month: number;
  seasonProgress: number;
  offenseGap: number;
  starterGap: number;
  bullpenGap: number;
  confidenceGap: number;
  recentFormGap: number;
  currentWeightGap: number;
  homeFieldValue: number;
};

function buildFeatureVector(inputs: FeatureInputs): ProbabilityAdjustmentFeatureVector {
  const restGap = scaleRange(safeValue(inputs.restGap), 4, 1.25);
  const monthValue = scaleRange(inputs.month - 6.5, 3.5, 1.2);
  const seasonProgress = clamp(inputs.seasonProgress, 0, 1);
  const recent10Gap = clamp(inputs.recent10Gap, -1, 1);
  const pctGap = clamp(inputs.pctGap, -1, 1);
  const venueSplitGap = clamp(inputs.venueSplitGap, -1, 1);
  const offenseGap = scaleRange(inputs.offenseGap, 12);
  const starterGap = scaleRange(inputs.starterGap, 12);
  const bullpenGap = scaleRange(inputs.bullpenGap, 10);
  const confidenceGap = clamp(inputs.confidenceGap, -1, 1);
  const recentFormGap = scaleRange(inputs.recentFormGap, 0.45);
  const currentWeightGap = clamp(inputs.currentWeightGap, -1, 1);
  const homeFieldValue = scaleRange(inputs.homeFieldValue, 0.3);

  return {
    recent10Gap,
    pctGap,
    venueSplitGap,
    restGap,
    monthValue,
    seasonProgress,
    offenseGap,
    starterGap,
    bullpenGap,
    confidenceGap,
    recentFormGap,
    currentWeightGap,
    homeFieldValue,
    recent10ByProgress: recent10Gap * (1 - seasonProgress),
    pctByProgress: pctGap * seasonProgress,
    offenseByProgress: offenseGap * seasonProgress,
    bullpenByRest: bullpenGap * restGap,
    homeFieldByRecent10: homeFieldValue * recent10Gap,
    confidenceByRecent10: confidenceGap * recent10Gap,
  };
}

export function buildProbabilityAdjustmentFeaturesFromRuntime(args: {
  game: Game;
  homeStrength: TeamStrengthSnapshot;
  awayStrength: TeamStrengthSnapshot;
  context: ProbabilityAdjustmentRuntimeContext;
}): ProbabilityAdjustmentFeatureVector {
  return buildFeatureVector({
    recent10Gap: args.homeStrength.recent10WinRate - args.awayStrength.recent10WinRate,
    pctGap: args.homeStrength.winPct - args.awayStrength.winPct,
    venueSplitGap: args.homeStrength.homePct - args.awayStrength.awayPct,
    restGap: args.context.restGap,
    month: args.context.month,
    seasonProgress: (args.homeStrength.seasonProgress + args.awayStrength.seasonProgress) / 2,
    offenseGap: args.homeStrength.offenseRating - args.awayStrength.offenseRating,
    starterGap: args.homeStrength.starterRating - args.awayStrength.starterRating,
    bullpenGap: args.homeStrength.bullpenRating - args.awayStrength.bullpenRating,
    confidenceGap: args.homeStrength.confidenceScore - args.awayStrength.confidenceScore,
    recentFormGap: args.homeStrength.recentFormAdjustment - args.awayStrength.recentFormAdjustment,
    currentWeightGap: args.homeStrength.currentWeight - args.awayStrength.currentWeight,
    homeFieldValue: args.homeStrength.homeFieldAdjustment,
  });
}

export function buildProbabilityAdjustmentFeaturesFromTrainingExample(
  example: GameOutcomeTrainingExample,
): ProbabilityAdjustmentFeatureVector {
  return buildFeatureVector({
    recent10Gap: example.recent10Gap,
    pctGap: example.pctGap,
    venueSplitGap: example.venueSplitGap,
    restGap: example.restGap,
    month: example.month,
    seasonProgress: (example.homeSeasonProgress + example.awaySeasonProgress) / 2,
    offenseGap: example.offenseRatingGap,
    starterGap: example.starterRatingGap,
    bullpenGap: example.bullpenRatingGap,
    confidenceGap: example.confidenceScoreGap,
    recentFormGap: example.recentFormAdjustmentGap,
    currentWeightGap: example.currentWeightGap,
    homeFieldValue: example.homeDerivedHomeFieldAdjustment,
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
  const homeLogit =
    Math.log(Math.max(args.homeWinProb, 1e-9)) +
    scoreWithWeights(parameters.homeBias, parameters.homeWeights, args.features);
  const awayLogit =
    Math.log(Math.max(args.awayWinProb, 1e-9)) +
    scoreWithWeights(parameters.awayBias, parameters.awayWeights, args.features);
  const tieLogit =
    Math.log(Math.max(args.tieProb, 1e-9)) +
    scoreWithWeights(parameters.tieBias, parameters.tieWeights, args.features);
  const maxLogit = Math.max(homeLogit, awayLogit, tieLogit);
  const homeExp = Math.exp(homeLogit - maxLogit);
  const awayExp = Math.exp(awayLogit - maxLogit);
  const tieExp = Math.exp(tieLogit - maxLogit);
  const total = homeExp + awayExp + tieExp;

  return {
    homeWinProb: homeExp / total,
    awayWinProb: awayExp / total,
    tieProb: tieExp / total,
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
