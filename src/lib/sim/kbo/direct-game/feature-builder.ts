import type { Game, TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
import type { GameOutcomeTrainingExample } from "@/lib/data-sources/kbo/training-corpus-types";
import {
  directGameFeatureVectorSchema,
  type DirectGameFeatureVector,
} from "@/lib/sim/kbo/direct-game/model-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundFeature(value: number) {
  return Number(value.toFixed(6));
}

function normalizeMonth(month: number) {
  return clamp((month - 6.5) / 5.5, -1, 1);
}

function readMonthFromScheduledAt(value: string) {
  const month = Number.parseInt(value.slice(5, 7), 10);
  return Number.isFinite(month) ? clamp(month, 1, 12) : 6;
}

export type DirectGameRuntimeFeatureArgs = {
  game: Game;
  homeStrength: TeamStrengthSnapshot;
  awayStrength: TeamStrengthSnapshot;
  context?: {
    restGap?: number | null;
  };
};

export function buildDirectGameFeaturesFromRuntime(
  args: DirectGameRuntimeFeatureArgs,
): DirectGameFeatureVector {
  const seasonProgress = clamp(
    (args.homeStrength.seasonProgress + args.awayStrength.seasonProgress) / 2,
    0,
    1,
  );
  const pctGap = args.homeStrength.winPct - args.awayStrength.winPct;
  const opponentAdjustedRecent10Gap =
    args.homeStrength.opponentAdjustedRecent10WinRate -
    args.awayStrength.opponentAdjustedRecent10WinRate;
  const bullpenRatingGap =
    args.homeStrength.bullpenRating - args.awayStrength.bullpenRating;
  const restGap = args.context?.restGap ?? 0;

  return directGameFeatureVectorSchema.parse({
    pctGap: roundFeature(pctGap),
    recent10Gap: roundFeature(
      args.homeStrength.recent10WinRate - args.awayStrength.recent10WinRate,
    ),
    opponentAdjustedRecent10Gap: roundFeature(opponentAdjustedRecent10Gap),
    offenseRatingGap: roundFeature(
      args.homeStrength.offenseRating - args.awayStrength.offenseRating,
    ),
    starterRatingGap: roundFeature(
      args.homeStrength.starterRating - args.awayStrength.starterRating,
    ),
    bullpenRatingGap: roundFeature(bullpenRatingGap),
    confidenceGap: roundFeature(
      args.homeStrength.confidenceScore - args.awayStrength.confidenceScore,
    ),
    venueSplitGap: roundFeature(
      args.homeStrength.homePct - args.awayStrength.awayPct,
    ),
    restGap: roundFeature(restGap),
    seasonProgress: roundFeature(seasonProgress),
    monthNormalized: roundFeature(
      normalizeMonth(readMonthFromScheduledAt(args.game.scheduledAt)),
    ),
    progressXPctGap: roundFeature(seasonProgress * pctGap),
    progressXOpponentAdjustedRecent10Gap: roundFeature(
      seasonProgress * opponentAdjustedRecent10Gap,
    ),
    restXBullpenGap: roundFeature(restGap * bullpenRatingGap),
  });
}

export function buildDirectGameFeaturesFromTrainingExample(
  example: GameOutcomeTrainingExample,
): DirectGameFeatureVector {
  const seasonProgress = clamp(
    (example.homeSeasonProgress + example.awaySeasonProgress) / 2,
    0,
    1,
  );

  return directGameFeatureVectorSchema.parse({
    pctGap: roundFeature(example.pctGap),
    recent10Gap: roundFeature(example.recent10Gap),
    opponentAdjustedRecent10Gap: roundFeature(
      example.opponentAdjustedRecent10Gap,
    ),
    offenseRatingGap: roundFeature(example.offenseRatingGap),
    starterRatingGap: roundFeature(example.starterRatingGap),
    bullpenRatingGap: roundFeature(example.bullpenRatingGap),
    confidenceGap: roundFeature(example.confidenceScoreGap),
    venueSplitGap: roundFeature(example.venueSplitGap),
    restGap: roundFeature(example.restGap ?? 0),
    seasonProgress: roundFeature(seasonProgress),
    monthNormalized: roundFeature(normalizeMonth(example.month)),
    progressXPctGap: roundFeature(seasonProgress * example.pctGap),
    progressXOpponentAdjustedRecent10Gap: roundFeature(
      seasonProgress * example.opponentAdjustedRecent10Gap,
    ),
    restXBullpenGap: roundFeature(
      (example.restGap ?? 0) * example.bullpenRatingGap,
    ),
  });
}
