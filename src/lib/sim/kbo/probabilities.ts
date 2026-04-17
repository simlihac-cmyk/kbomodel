import type {
  ExplanationReason,
  Game,
  GameProbabilitySnapshot,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";
import {
  type GameModelParameterSet,
} from "@/lib/sim/kbo/model-parameters";
import { CURRENT_GAME_MODEL_PARAMETERS } from "@/lib/sim/kbo/current-model-parameters";
import {
  applyProbabilityAdjustment,
  buildProbabilityAdjustmentFeaturesFromRuntime,
  type ProbabilityAdjustmentRuntimeContext,
} from "@/lib/sim/kbo/probability-adjustment";
import type {
  GameStarterProjection,
  ProjectedStarterAssignment,
} from "@/lib/sim/kbo/player-impact";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shrinkRatingByConfidence(
  rating: number,
  confidenceScore: number,
  parameters: GameModelParameterSet,
): number {
  const confidenceFactor = clamp(
    parameters.confidenceBase + confidenceScore * parameters.confidenceScale,
    0.05,
    1.25,
  );
  return 100 + (rating - 100) * confidenceFactor;
}

function buildPoissonDistribution(lambda: number): number[] {
  const maxRuns = Math.max(14, Math.ceil(lambda + 6 * Math.sqrt(lambda)));
  const probabilities = Array.from({ length: maxRuns + 1 }, () => 0);

  probabilities[0] = Math.exp(-lambda);
  let cumulative = probabilities[0];

  for (let runs = 1; runs < maxRuns; runs += 1) {
    probabilities[runs] = probabilities[runs - 1] * lambda / runs;
    cumulative += probabilities[runs];
  }

  probabilities[maxRuns] = Math.max(0, 1 - cumulative);
  return probabilities;
}

function buildRunOutcomeProbabilities(
  expectedRunsHome: number,
  expectedRunsAway: number,
): { homeWin: number; awayWin: number; tie: number } {
  const homeDistribution = buildPoissonDistribution(expectedRunsHome);
  const awayDistribution = buildPoissonDistribution(expectedRunsAway);
  let homeWin = 0;
  let awayWin = 0;
  let tie = 0;

  for (let homeRuns = 0; homeRuns < homeDistribution.length; homeRuns += 1) {
    for (let awayRuns = 0; awayRuns < awayDistribution.length; awayRuns += 1) {
      const probability = homeDistribution[homeRuns] * awayDistribution[awayRuns];
      if (homeRuns > awayRuns) {
        homeWin += probability;
      } else if (homeRuns < awayRuns) {
        awayWin += probability;
      } else {
        tie += probability;
      }
    }
  }

  const total = homeWin + awayWin + tie;
  if (total <= 0) {
    return { homeWin: 0.5, awayWin: 0.5, tie: 0 };
  }

  return {
    homeWin: homeWin / total,
    awayWin: awayWin / total,
    tie: tie / total,
  };
}

function buildExpectedRuns(
  homeStrength: TeamStrengthSnapshot,
  awayStrength: TeamStrengthSnapshot,
  parameters: GameModelParameterSet,
  starterProjection?: GameStarterProjection,
) {
  const effectiveHomeStrength = starterProjection?.home
    ? {
        ...homeStrength,
        starterRating: homeStrength.starterRating + starterProjection.home.starterDelta,
      }
    : homeStrength;
  const effectiveAwayStrength = starterProjection?.away
    ? {
        ...awayStrength,
        starterRating: awayStrength.starterRating + starterProjection.away.starterDelta,
      }
    : awayStrength;
  const homeOffense = shrinkRatingByConfidence(
    effectiveHomeStrength.offenseRating,
    effectiveHomeStrength.confidenceScore,
    parameters,
  );
  const awayOffense = shrinkRatingByConfidence(
    effectiveAwayStrength.offenseRating,
    effectiveAwayStrength.confidenceScore,
    parameters,
  );
  const homeStarter = shrinkRatingByConfidence(
    effectiveHomeStrength.starterRating,
    effectiveHomeStrength.confidenceScore,
    parameters,
  );
  const awayStarter = shrinkRatingByConfidence(
    effectiveAwayStrength.starterRating,
    effectiveAwayStrength.confidenceScore,
    parameters,
  );
  const homeBullpen = shrinkRatingByConfidence(
    effectiveHomeStrength.bullpenRating,
    effectiveHomeStrength.confidenceScore,
    parameters,
  );
  const awayBullpen = shrinkRatingByConfidence(
    effectiveAwayStrength.bullpenRating,
    effectiveAwayStrength.confidenceScore,
    parameters,
  );
  const recentEdge =
    effectiveHomeStrength.recentFormAdjustment * effectiveHomeStrength.confidenceScore -
    effectiveAwayStrength.recentFormAdjustment * effectiveAwayStrength.confidenceScore;
  const homeAttack = (homeOffense - 100) * parameters.offenseWeight;
  const awayAttack = (awayOffense - 100) * parameters.offenseWeight;
  const homePitchSuppression =
    (homeStarter - 100) * parameters.starterWeight +
    (homeBullpen - 100) * parameters.bullpenWeight;
  const awayPitchSuppression =
    (awayStarter - 100) * parameters.starterWeight +
    (awayBullpen - 100) * parameters.bullpenWeight;
  const expectedRunsHome = clamp(
    parameters.leagueRunEnvironment *
      Math.exp(
          homeAttack -
          awayPitchSuppression +
          recentEdge * parameters.recentFormWeight +
          effectiveHomeStrength.homeFieldAdjustment * parameters.homeFieldWeightHome,
      ),
    2,
    8.2,
  );
  const expectedRunsAway = clamp(
    (parameters.leagueRunEnvironment - parameters.awayRunEnvironmentOffset) *
      Math.exp(
          awayAttack -
          homePitchSuppression -
          recentEdge * parameters.recentFormWeight -
          effectiveHomeStrength.homeFieldAdjustment * parameters.homeFieldWeightAway,
      ),
    1.8,
    7.8,
  );

  return {
    expectedRunsHome,
    expectedRunsAway,
    recentEdge,
    bullpenEdge: homeBullpen - awayBullpen,
    offenseEdge: homeOffense - awayStarter,
    averageConfidence:
      (effectiveHomeStrength.confidenceScore + effectiveAwayStrength.confidenceScore) / 2,
    projectedStarterEdge:
      (starterProjection?.home?.starterDelta ?? 0) -
      (starterProjection?.away?.starterDelta ?? 0),
  };
}

export type GameProbabilityCoreSnapshot = {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  expectedRunsHome: number;
  expectedRunsAway: number;
  recentEdge: number;
  bullpenEdge: number;
  offenseEdge: number;
  averageConfidence: number;
  projectedStarterEdge: number;
};

function buildProjectedStarterSentence(
  homeStarter: ProjectedStarterAssignment | null,
  awayStarter: ProjectedStarterAssignment | null,
  projectedStarterEdge: number,
) {
  if (homeStarter && awayStarter) {
    if (projectedStarterEdge > 0) {
      return `예상 선발은 홈 ${homeStarter.playerName}, 원정 ${awayStarter.playerName}으로 보고 홈 선발 우위를 추가 반영했습니다.`;
    }
    if (projectedStarterEdge < 0) {
      return `예상 선발은 홈 ${homeStarter.playerName}, 원정 ${awayStarter.playerName}으로 보고 원정 선발 우위를 추가 반영했습니다.`;
    }
    return `예상 선발은 홈 ${homeStarter.playerName}, 원정 ${awayStarter.playerName}으로 보고 선발 격차는 작은 폭으로만 반영했습니다.`;
  }

  if (homeStarter) {
    return `홈 예상 선발 ${homeStarter.playerName}의 등판 턴을 반영해 홈 선발 전력을 경기 단위로 조정했습니다.`;
  }

  if (awayStarter) {
    return `원정 예상 선발 ${awayStarter.playerName}의 등판 턴을 반영해 원정 선발 전력을 경기 단위로 조정했습니다.`;
  }

  return "예상 선발 보정은 적용되지 않았습니다.";
}

export function buildGameProbabilityCoreSnapshot(
  homeStrength: TeamStrengthSnapshot,
  awayStrength: TeamStrengthSnapshot,
  tiesAllowed = true,
  starterProjection?: GameStarterProjection,
  parameters: GameModelParameterSet = CURRENT_GAME_MODEL_PARAMETERS,
): GameProbabilityCoreSnapshot {
  const {
    expectedRunsHome,
    expectedRunsAway,
    recentEdge,
    bullpenEdge,
    offenseEdge,
    averageConfidence,
    projectedStarterEdge,
  } = buildExpectedRuns(
    homeStrength,
    awayStrength,
    parameters,
    starterProjection,
  );
  const regulation = buildRunOutcomeProbabilities(
    expectedRunsHome,
    expectedRunsAway,
  );
  const tieProb = tiesAllowed
    ? clamp(
        regulation.tie * parameters.tieCarryRate,
        parameters.minTieProbability,
        parameters.maxTieProbability,
      )
    : 0;
  const decisiveProbability = Math.max(
    regulation.homeWin + regulation.awayWin,
    0.0001,
  );
  const roundedHomeWinProb = Number(
    (regulation.homeWin / decisiveProbability * (1 - tieProb)).toFixed(4),
  );
  const awayWinProb = Number(
    Math.max(0, 1 - tieProb - roundedHomeWinProb).toFixed(4),
  );
  const homeWinProb = Number(
    Math.max(0, 1 - tieProb - awayWinProb).toFixed(4),
  );

  return {
    homeWinProb,
    awayWinProb,
    tieProb,
    expectedRunsHome,
    expectedRunsAway,
    recentEdge,
    bullpenEdge,
    offenseEdge,
    averageConfidence,
    projectedStarterEdge,
  };
}

export function buildGameProbabilitySnapshot(
  game: Game,
  homeStrength: TeamStrengthSnapshot,
  awayStrength: TeamStrengthSnapshot,
  tiesAllowed = true,
  starterProjection?: GameStarterProjection,
  parameters: GameModelParameterSet = CURRENT_GAME_MODEL_PARAMETERS,
  adjustmentContext?: Partial<ProbabilityAdjustmentRuntimeContext>,
): GameProbabilitySnapshot {
  const {
    homeWinProb: baseHomeWinProb,
    awayWinProb: baseAwayWinProb,
    tieProb: baseTieProb,
    expectedRunsHome,
    expectedRunsAway,
    recentEdge,
    bullpenEdge,
    offenseEdge,
    averageConfidence,
    projectedStarterEdge,
  } = buildGameProbabilityCoreSnapshot(
    homeStrength,
    awayStrength,
    tiesAllowed,
    starterProjection,
    parameters,
  );
  const adjustedProbabilities = applyProbabilityAdjustment({
    homeWinProb: baseHomeWinProb,
    awayWinProb: baseAwayWinProb,
    tieProb: baseTieProb,
    features: buildProbabilityAdjustmentFeaturesFromRuntime({
      game,
      homeStrength,
      awayStrength,
      context: {
        restGap: adjustmentContext?.restGap ?? null,
      },
    }),
  });
  const { homeWinProb, awayWinProb, tieProb } = adjustedProbabilities;

  const explanationReasons: ExplanationReason[] = [
    {
      key: "offense-edge",
      label: "득점 기대값",
      direction:
        expectedRunsHome > expectedRunsAway ? "positive" : "negative",
      magnitude: Number(
        Math.abs(expectedRunsHome - expectedRunsAway).toFixed(3),
      ),
      sentence:
        expectedRunsHome > expectedRunsAway
          ? "홈팀의 기대 득점이 더 높아 기본 승률도 홈 쪽으로 기울어 있습니다."
          : "원정팀의 기대 득점이 더 높아 기본 승률도 원정 쪽으로 기울어 있습니다.",
    },
    {
      key: "offense-vs-starter",
      label: "타선 vs 선발",
      direction: offenseEdge > 0 ? "positive" : "negative",
      magnitude: Number(Math.abs(offenseEdge / 10).toFixed(3)),
      sentence:
        offenseEdge > 0
          ? "홈팀 타선이 원정 선발 조합 상대로 더 많은 득점을 낼 여지가 있습니다."
          : "원정 선발 조합이 홈팀 타선을 억제할 여지가 더 큽니다.",
    },
    {
      key: "bullpen-edge",
      label: "불펜 영향",
      direction: bullpenEdge > 0 ? "positive" : "negative",
      magnitude: Number(Math.abs(bullpenEdge / 10).toFixed(3)),
      sentence:
        bullpenEdge > 0
          ? "후반 이닝으로 갈수록 홈팀 불펜이 조금 더 버틸 가능성이 높습니다."
          : "접전이 길어질수록 원정팀 불펜 쪽이 조금 더 안정적입니다.",
    },
    {
      key: "recent-form",
      label: "최근 폼",
      direction:
        recentEdge > 0 ? "positive" : recentEdge < 0 ? "negative" : "neutral",
      magnitude: Number(Math.abs(recentEdge).toFixed(3)),
      sentence:
        recentEdge > 0
          ? "최근 흐름은 홈팀 쪽이 조금 더 좋고, 이 보정은 작은 폭으로만 반영됩니다."
          : recentEdge < 0
            ? "최근 흐름은 원정팀 쪽이 조금 더 좋고, 이 보정은 작은 폭으로만 반영됩니다."
            : "최근 흐름 차이는 크지 않아 기본 전력 중심으로 계산됩니다.",
    },
  ];

  if (averageConfidence < 0.65) {
    explanationReasons.push({
      key: "confidence",
      label: "표본 안정도",
      direction: "neutral",
      magnitude: Number((1 - averageConfidence).toFixed(3)),
      sentence:
        "표본 안정도가 아직 높지 않아 극단적인 승률 차이 대신 리그 평균 쪽으로 조금 더 수축해 계산합니다.",
    });
  }

  if (starterProjection?.home || starterProjection?.away) {
    explanationReasons.push({
      key: "projected-starter",
      label: "예상 선발",
      direction:
        projectedStarterEdge > 0
          ? "positive"
          : projectedStarterEdge < 0
            ? "negative"
            : "neutral",
      magnitude: Number((Math.abs(projectedStarterEdge) / 6).toFixed(3)),
      sentence: buildProjectedStarterSentence(
        starterProjection?.home ?? null,
        starterProjection?.away ?? null,
        projectedStarterEdge,
      ),
    });
  }

  return {
    gameId: game.gameId,
    homeSeasonTeamId: game.homeSeasonTeamId,
    awaySeasonTeamId: game.awaySeasonTeamId,
    homeLikelyStarterId: starterProjection?.home?.playerId ?? null,
    awayLikelyStarterId: starterProjection?.away?.playerId ?? null,
    homeWinProb,
    awayWinProb,
    tieProb: Number(tieProb.toFixed(4)),
    expectedRunsHome: Number(expectedRunsHome.toFixed(2)),
    expectedRunsAway: Number(expectedRunsAway.toFixed(2)),
    starterAdjustmentApplied: Boolean(starterProjection?.home || starterProjection?.away),
    explanationReasons,
  };
}
