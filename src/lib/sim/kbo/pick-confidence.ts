import type { DirectGameFeatureVector } from "@/lib/sim/kbo/direct-game/model-types";

export type PickConfidenceLevel = "pass" | "lean" | "pick" | "strong";

export type PickConfidenceSnapshot = {
  favoriteSide: "home" | "away";
  score: number;
  level: PickConfidenceLevel;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signWithFloor(value: number, floor: number) {
  if (value > floor) {
    return 1;
  }
  if (value < -floor) {
    return -1;
  }
  return 0;
}

export function buildPickConfidenceSnapshot(args: {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  features: DirectGameFeatureVector;
}): PickConfidenceSnapshot {
  const decisiveTotal = Math.max(args.homeWinProb + args.awayWinProb, 1e-9);
  const homeDecisiveProb = args.homeWinProb / decisiveTotal;
  const awayDecisiveProb = args.awayWinProb / decisiveTotal;
  const favoriteSide = homeDecisiveProb >= awayDecisiveProb ? "home" : "away";
  const favoriteShare = Math.max(homeDecisiveProb, awayDecisiveProb);
  const decisiveMarginSignal = clamp((favoriteShare - 0.5) / 0.18, 0, 1);
  const eloSignal = clamp(Math.abs(args.features.eloDiff) / 180, 0, 1);
  const pctSignal = clamp(Math.abs(args.features.pctGap) / 0.28, 0, 1);
  const recentSignal = clamp(
    Math.abs(args.features.opponentAdjustedRecent10Gap) / 0.24,
    0,
    1,
  );
  const venueSignal = clamp(Math.abs(args.features.venueSplitGap) / 0.22, 0, 1);
  const restSignal = clamp(Math.abs(args.features.restGap) / 2, 0, 1);
  const tiePenalty = clamp(args.tieProb / 0.06, 0, 1);

  const signs = [
    signWithFloor(args.features.eloDiff, 18),
    signWithFloor(args.features.pctGap, 0.05),
    signWithFloor(args.features.opponentAdjustedRecent10Gap, 0.04),
    signWithFloor(args.features.venueSplitGap, 0.05),
  ].filter((value) => value !== 0);
  const agreementCount = signs.filter((value) => value === signs[0]).length;
  const agreementSignal =
    signs.length <= 1 ? 0.5 : clamp((agreementCount - 1) / Math.max(1, signs.length - 1), 0, 1);

  const rawScore =
    decisiveMarginSignal * 0.34 +
    eloSignal * 0.18 +
    pctSignal * 0.18 +
    recentSignal * 0.12 +
    agreementSignal * 0.1 +
    venueSignal * 0.05 +
    restSignal * 0.03;
  const score = clamp(rawScore * (1 - tiePenalty * 0.35), 0, 1);

  const level: PickConfidenceLevel =
    score >= 0.78
      ? "strong"
      : score >= 0.6
        ? "pick"
        : score >= 0.42
          ? "lean"
          : "pass";

  return {
    favoriteSide,
    score: Number(score.toFixed(4)),
    level,
  };
}
