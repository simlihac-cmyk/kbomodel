import type { TeamStrengthSnapshot } from "@/lib/domain/kbo/types";
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

export type DirectGameRuntimeFeatureArgs = {
  homeStrength: TeamStrengthSnapshot;
  awayStrength: TeamStrengthSnapshot;
  context?: {
    restGap?: number | null;
    eloDiff?: number | null;
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
  const restGap = args.context?.restGap ?? 0;
  const eloDiff = args.context?.eloDiff ?? 0;

  return directGameFeatureVectorSchema.parse({
    eloDiff: roundFeature(eloDiff),
    pctGap: roundFeature(pctGap),
    recent10Gap: roundFeature(
      args.homeStrength.recent10WinRate - args.awayStrength.recent10WinRate,
    ),
    opponentAdjustedRecent10Gap: roundFeature(opponentAdjustedRecent10Gap),
    venueSplitGap: roundFeature(
      args.homeStrength.homePct - args.awayStrength.awayPct,
    ),
    restGap: roundFeature(restGap),
    seasonProgress: roundFeature(seasonProgress),
    progressXEloDiff: roundFeature(seasonProgress * eloDiff),
    progressXPctGap: roundFeature(seasonProgress * pctGap),
    progressXOpponentAdjustedRecent10Gap: roundFeature(
      seasonProgress * opponentAdjustedRecent10Gap,
    ),
  });
}

export function buildDirectGameFeaturesFromTrainingExample(
  example: GameOutcomeTrainingExample,
  context?: {
    eloDiff?: number | null;
  },
): DirectGameFeatureVector {
  const seasonProgress = clamp(
    (example.homeSeasonProgress + example.awaySeasonProgress) / 2,
    0,
    1,
  );
  const eloDiff = context?.eloDiff ?? 0;

  return directGameFeatureVectorSchema.parse({
    eloDiff: roundFeature(eloDiff),
    pctGap: roundFeature(example.pctGap),
    recent10Gap: roundFeature(example.recent10Gap),
    opponentAdjustedRecent10Gap: roundFeature(
      example.opponentAdjustedRecent10Gap,
    ),
    venueSplitGap: roundFeature(example.venueSplitGap),
    restGap: roundFeature(example.restGap ?? 0),
    seasonProgress: roundFeature(seasonProgress),
    progressXEloDiff: roundFeature(seasonProgress * eloDiff),
    progressXPctGap: roundFeature(seasonProgress * example.pctGap),
    progressXOpponentAdjustedRecent10Gap: roundFeature(
      seasonProgress * example.opponentAdjustedRecent10Gap,
    ),
  });
}
