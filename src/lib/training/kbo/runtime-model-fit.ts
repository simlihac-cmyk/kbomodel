import { BASE_HOME_FIELD_ADVANTAGE } from "@/lib/domain/kbo/constants";
import type {
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";
import type {
  TeamSnapshotTrainingExample,
  TrainingCorpusSeason,
} from "@/lib/data-sources/kbo/training-corpus-types";
import {
  buildCalibrationSummary,
  fitGameModelParametersFromPreparedExamples,
  scorePreparedExamples,
  splitTrainYears,
  type PreparedGameExample,
} from "@/lib/training/kbo/game-model-fit";
import {
  CURRENT_GAME_MODEL_PARAMETERS,
} from "@/lib/sim/kbo/current-model-parameters";
import type { GameModelParameterSet } from "@/lib/sim/kbo/model-parameters";
import {
  CURRENT_STRENGTH_MODEL_PARAMETERS,
} from "@/lib/sim/kbo/current-strength-model-parameters";
import type {
  GamePredictionMetrics,
  RuntimeModelBacktestSummary,
  RuntimeModelParameterArtifact,
} from "@/lib/training/kbo/model-types";
import {
  DEFAULT_STRENGTH_MODEL_PARAMETERS,
  strengthModelParameterSetSchema,
  type StrengthModelParameterSet,
} from "@/lib/sim/kbo/strength-model-parameters";
import {
  buildBullpenProxySignal,
  buildConfidenceScore,
  buildCurrentWeight,
  buildHomeFieldAdjustmentFromState,
  buildOffenseSignal,
  buildRecentFormAdjustment,
  buildRunPreventionSignal,
  buildTeamStateLeagueAverages,
  type TeamStateLeagueAverages,
  type TeamStateSnapshot,
} from "@/lib/sim/kbo/shared-team-state";

type HistoricalGameContextExample = {
  sampleId: string;
  year: number;
  regularSeasonGamesPerTeam: number;
  homeFranchiseId: string;
  awayFranchiseId: string;
  homeState: TeamStateSnapshot;
  awayState: TeamStateSnapshot;
  league: TeamStateLeagueAverages;
  actualIndex: 0 | 1 | 2;
  actualHomeWin: number;
  actualAwayWin: number;
  actualTie: number;
};

type StageEvaluation = {
  fit: GamePredictionMetrics;
  tune: GamePredictionMetrics | null;
  validation: GamePredictionMetrics | null;
  selectionScore: number;
};

type StrengthFitResult = {
  fittedParameters: StrengthModelParameterSet;
  baselineEvaluation: StageEvaluation;
  fittedEvaluation: StageEvaluation;
  evaluations: number;
};

type RuntimeFitOptions = {
  iterations?: number;
  strengthMaxRounds?: number;
  gameMaxRounds?: number;
  initialStrength?: StrengthModelParameterSet;
};

type RuntimeFitResult = {
  artifact: RuntimeModelParameterArtifact;
  backtest: RuntimeModelBacktestSummary;
};

type StrengthTunableKey =
  | "currentWeightProgressExponent"
  | "currentWeightProgressMix"
  | "currentWeightShrinkageMultiplier"
  | "currentWeightMin"
  | "currentWeightMax"
  | "offenseRunsWeight"
  | "offenseRunDiffWeight"
  | "offenseRecentWeight"
  | "runPreventionRunsAllowedWeight"
  | "runPreventionRunDiffWeight"
  | "runPreventionWinPctWeight"
  | "bullpenRunsAllowedWeight"
  | "bullpenRecentWeight"
  | "bullpenStreakWeight"
  | "homeFieldSplitWeight"
  | "recentFormWinRateWeight"
  | "recentFormStreakWeight"
  | "confidenceBase"
  | "confidenceCurrentWeightWeight"
  | "confidenceRunDiffWeight"
  | "confidenceRunDiffCap";

type StrengthParameterSpec = {
  key: StrengthTunableKey;
  min: number;
  max: number;
  step: number;
  decay: number;
};

const STRENGTH_PARAMETER_SPECS: StrengthParameterSpec[] = [
  { key: "currentWeightProgressExponent", min: 0.75, max: 2.6, step: 0.12, decay: 0.62 },
  { key: "currentWeightProgressMix", min: 0.15, max: 0.85, step: 0.05, decay: 0.65 },
  { key: "currentWeightShrinkageMultiplier", min: 0.8, max: 4.4, step: 0.2, decay: 0.62 },
  { key: "currentWeightMin", min: 0.01, max: 0.18, step: 0.012, decay: 0.72 },
  { key: "currentWeightMax", min: 0.58, max: 0.95, step: 0.02, decay: 0.72 },
  { key: "offenseRunsWeight", min: 4.5, max: 14.5, step: 0.55, decay: 0.62 },
  { key: "offenseRunDiffWeight", min: 0.6, max: 5.6, step: 0.3, decay: 0.62 },
  { key: "offenseRecentWeight", min: 0, max: 8.5, step: 0.35, decay: 0.65 },
  { key: "runPreventionRunsAllowedWeight", min: 4.5, max: 14.5, step: 0.55, decay: 0.62 },
  { key: "runPreventionRunDiffWeight", min: 0.6, max: 5.8, step: 0.3, decay: 0.62 },
  { key: "runPreventionWinPctWeight", min: 0, max: 12.5, step: 0.5, decay: 0.62 },
  { key: "bullpenRunsAllowedWeight", min: 2.5, max: 10.5, step: 0.35, decay: 0.65 },
  { key: "bullpenRecentWeight", min: 0, max: 10.5, step: 0.35, decay: 0.65 },
  { key: "bullpenStreakWeight", min: 0, max: 1.2, step: 0.06, decay: 0.68 },
  { key: "homeFieldSplitWeight", min: 0.04, max: 0.42, step: 0.02, decay: 0.68 },
  { key: "recentFormWinRateWeight", min: 0, max: 1.4, step: 0.08, decay: 0.68 },
  { key: "recentFormStreakWeight", min: 0, max: 0.22, step: 0.01, decay: 0.68 },
  { key: "confidenceBase", min: 0.08, max: 0.45, step: 0.02, decay: 0.7 },
  { key: "confidenceCurrentWeightWeight", min: 0.25, max: 1.1, step: 0.05, decay: 0.7 },
  { key: "confidenceRunDiffWeight", min: 0, max: 0.08, step: 0.004, decay: 0.7 },
  { key: "confidenceRunDiffCap", min: 0.02, max: 0.16, step: 0.01, decay: 0.7 },
];

function roundMetric(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function normalizeStrengthParameterSet(parameters: StrengthModelParameterSet): StrengthModelParameterSet {
  const next = { ...parameters };

  for (const spec of STRENGTH_PARAMETER_SPECS) {
    next[spec.key] = Math.max(spec.min, Math.min(spec.max, next[spec.key]));
  }

  next.currentWeightMax = Math.max(next.currentWeightMax, next.currentWeightMin + 0.05);
  next.homeFieldMax = Math.max(next.homeFieldMax, next.homeFieldMin + 0.04);
  next.confidenceMax = Math.max(next.confidenceMax, next.confidenceMin + 0.05);

  return strengthModelParameterSetSchema.parse(next);
}

function buildStateFromTeamExample(example: TeamSnapshotTrainingExample): TeamStateSnapshot {
  return {
    seasonTeamId: `${example.seasonId}:${example.franchiseId}`,
    gamesPlayed: example.gamesPlayed,
    wins: example.wins,
    losses: example.losses,
    ties: example.ties,
    winPct: example.pct,
    runsScoredPerGame: example.runsScoredPerGame,
    runsAllowedPerGame: example.runsAllowedPerGame,
    runDiffPerGame: example.runDiffPerGame,
    homePct: example.homePct,
    awayPct: example.awayPct,
    splitGap: example.splitPctGap,
    recent10WinRate: example.recent10WinRate,
    streakValue: example.streakValue,
  };
}

function inferRegularSeasonGamesPerTeam(season: TrainingCorpusSeason) {
  return season.teamExamples.reduce(
    (maxGames, example) => Math.max(maxGames, example.gamesPlayed + example.gamesRemaining),
    144,
  );
}

function findPregameSnapshotDate(snapshotDates: string[], gameDate: string) {
  let candidate: string | null = null;
  for (const snapshotDate of snapshotDates) {
    if (snapshotDate < gameDate) {
      candidate = snapshotDate;
      continue;
    }
    break;
  }
  return candidate;
}

function prepareHistoricalGameExamples(
  seasons: TrainingCorpusSeason[],
): Record<number, HistoricalGameContextExample[]> {
  return Object.fromEntries(
    seasons.map((season) => {
      const snapshotDates = Array.from(
        new Set(season.teamExamples.map((example) => example.asOfDate)),
      ).sort();
      const regularSeasonGamesPerTeam = inferRegularSeasonGamesPerTeam(season);
      const statesByDate = new Map<string, Record<string, TeamStateSnapshot>>();
      const leaguesByDate = new Map<string, TeamStateLeagueAverages>();

      for (const snapshotDate of snapshotDates) {
        const teamExamples = season.teamExamples.filter((example) => example.asOfDate === snapshotDate);
        const states = teamExamples.map(buildStateFromTeamExample);
        statesByDate.set(
          snapshotDate,
          Object.fromEntries(teamExamples.map((example, index) => [example.franchiseId, states[index]!])),
        );
        leaguesByDate.set(snapshotDate, buildTeamStateLeagueAverages(states));
      }

      const contexts = season.gameExamples.flatMap((gameExample) => {
        const snapshotDate = findPregameSnapshotDate(snapshotDates, gameExample.date);
        if (!snapshotDate) {
          return [];
        }

        const states = statesByDate.get(snapshotDate);
        const league = leaguesByDate.get(snapshotDate);
        const homeState = states?.[gameExample.homeFranchiseId];
        const awayState = states?.[gameExample.awayFranchiseId];

        if (!states || !league || !homeState || !awayState) {
          return [];
        }

        return [{
          sampleId: gameExample.sampleId,
          year: season.year,
          regularSeasonGamesPerTeam,
          homeFranchiseId: gameExample.homeFranchiseId,
          awayFranchiseId: gameExample.awayFranchiseId,
          homeState,
          awayState,
          league,
          actualIndex: gameExample.homeWin ? 0 : gameExample.awayWin ? 1 : 2,
          actualHomeWin: gameExample.homeWin ? 1 : 0,
          actualAwayWin: gameExample.awayWin ? 1 : 0,
          actualTie: gameExample.tie ? 1 : 0,
        }];
      });

      return [season.year, contexts];
    }),
  ) as Record<number, HistoricalGameContextExample[]>;
}

function buildStrengthSnapshot(
  seasonTeamId: string,
  state: TeamStateSnapshot,
  league: TeamStateLeagueAverages,
  regularSeasonGamesPerTeam: number,
  isHome: boolean,
  parameters: StrengthModelParameterSet,
): TeamStrengthSnapshot {
  const currentWeight = buildCurrentWeight(state.gamesPlayed, regularSeasonGamesPerTeam, parameters);
  const offenseSignal = buildOffenseSignal(state, league, parameters);
  const runPreventionSignal = buildRunPreventionSignal(state, league, parameters);
  const bullpenSignal = buildBullpenProxySignal(state, league, parameters);

  return {
    seasonTeamId,
    offenseRating: Number((100 + offenseSignal * currentWeight).toFixed(4)),
    starterRating: Number((100 + runPreventionSignal * currentWeight * 0.92).toFixed(4)),
    bullpenRating: Number((100 + bullpenSignal * currentWeight).toFixed(4)),
    homeFieldAdjustment: isHome
      ? Number(buildHomeFieldAdjustmentFromState(state, league, BASE_HOME_FIELD_ADVANTAGE, parameters).toFixed(4))
      : 0,
    recentFormAdjustment: Number(buildRecentFormAdjustment(state, parameters).toFixed(4)),
    confidenceScore: Number(buildConfidenceScore(state, currentWeight, parameters).toFixed(4)),
    currentWeight: Number(currentWeight.toFixed(4)),
    priorWeight: Number((1 - currentWeight).toFixed(4)),
    scheduleDifficulty: 0,
    headToHeadLeverage: 0,
    explanationReasons: [],
  };
}

function prepareGameExamplesForStrengthParameters(
  contexts: HistoricalGameContextExample[],
  parameters: StrengthModelParameterSet,
): PreparedGameExample[] {
  return contexts.map((context) => ({
    sampleId: context.sampleId,
    year: context.year,
    homeStrength: buildStrengthSnapshot(
      context.homeFranchiseId,
      context.homeState,
      context.league,
      context.regularSeasonGamesPerTeam,
      true,
      parameters,
    ),
    awayStrength: buildStrengthSnapshot(
      context.awayFranchiseId,
      context.awayState,
      context.league,
      context.regularSeasonGamesPerTeam,
      false,
      parameters,
    ),
    actualIndex: context.actualIndex,
    actualHomeWin: context.actualHomeWin,
    actualAwayWin: context.actualAwayWin,
    actualTie: context.actualTie,
  }));
}

function isFitMetricBetter(next: GamePredictionMetrics, current: GamePredictionMetrics) {
  if (next.logLoss !== current.logLoss) {
    return next.logLoss < current.logLoss;
  }
  if (next.brierScore !== current.brierScore) {
    return next.brierScore < current.brierScore;
  }
  return next.accuracy > current.accuracy;
}

function isSelectionBetter(next: StageEvaluation, current: StageEvaluation) {
  if (next.selectionScore !== current.selectionScore) {
    return next.selectionScore < current.selectionScore;
  }
  return isFitMetricBetter(next.fit, current.fit);
}

function evaluateStrengthParameterSet(
  fitContexts: HistoricalGameContextExample[],
  tuneContexts: HistoricalGameContextExample[],
  validationContexts: HistoricalGameContextExample[],
  strengthParameters: StrengthModelParameterSet,
  gameParameters: GameModelParameterSet,
): StageEvaluation {
  const fitExamples = prepareGameExamplesForStrengthParameters(fitContexts, strengthParameters);
  const tuneExamples = prepareGameExamplesForStrengthParameters(tuneContexts, strengthParameters);
  const validationExamples = prepareGameExamplesForStrengthParameters(validationContexts, strengthParameters);

  const fit = scorePreparedExamples(fitExamples, gameParameters);
  const tune = tuneExamples.length > 0 ? scorePreparedExamples(tuneExamples, gameParameters) : null;
  const validation =
    validationExamples.length > 0
      ? scorePreparedExamples(validationExamples, gameParameters)
      : null;

  return {
    fit,
    tune,
    validation,
    selectionScore: tune?.logLoss ?? fit.logLoss,
  };
}

function adjustStrengthParameters(
  parameters: StrengthModelParameterSet,
  key: StrengthTunableKey,
  delta: number,
) {
  return normalizeStrengthParameterSet({
    ...parameters,
    [key]: parameters[key] + delta,
  });
}

function fitStrengthModelParameters(
  contextsByYear: Record<number, HistoricalGameContextExample[]>,
  trainYears: number[],
  validationYears: number[],
  initial: StrengthModelParameterSet,
  maxRounds: number,
  gameParameters: GameModelParameterSet,
): StrengthFitResult {
  const initialParameters = normalizeStrengthParameterSet(initial);
  const { fitYears, tuneYears } = splitTrainYears(trainYears);
  const fitContexts = fitYears.flatMap((year) => contextsByYear[year] ?? []);
  const tuneContexts = tuneYears.flatMap((year) => contextsByYear[year] ?? []);
  const validationContexts = validationYears.flatMap((year) => contextsByYear[year] ?? []);

  if (fitContexts.length === 0) {
    throw new Error("Runtime model fit requires at least one fit-year context.");
  }

  let evaluations = 1;
  let currentParameters = initialParameters;
  let currentEvaluation = evaluateStrengthParameterSet(
    fitContexts,
    tuneContexts,
    validationContexts,
    currentParameters,
    gameParameters,
  );
  let bestSelectionParameters = currentParameters;
  let bestSelectionEvaluation = currentEvaluation;
  const steps = Object.fromEntries(
    STRENGTH_PARAMETER_SPECS.map((spec) => [spec.key, spec.step]),
  ) as Record<StrengthTunableKey, number>;

  for (let round = 0; round < maxRounds; round += 1) {
    let roundImproved = false;

    for (const spec of STRENGTH_PARAMETER_SPECS) {
      let bestFitParameters = currentParameters;
      let bestFitEvaluation = currentEvaluation;

      for (const direction of [-1, 1] as const) {
        const candidateParameters = adjustStrengthParameters(
          currentParameters,
          spec.key,
          direction * steps[spec.key],
        );
        const candidateEvaluation = evaluateStrengthParameterSet(
          fitContexts,
          tuneContexts,
          validationContexts,
          candidateParameters,
          gameParameters,
        );
        evaluations += 1;

        if (isFitMetricBetter(candidateEvaluation.fit, bestFitEvaluation.fit)) {
          bestFitParameters = candidateParameters;
          bestFitEvaluation = candidateEvaluation;
        }

        if (isSelectionBetter(candidateEvaluation, bestSelectionEvaluation)) {
          bestSelectionParameters = candidateParameters;
          bestSelectionEvaluation = candidateEvaluation;
        }
      }

      if (bestFitParameters !== currentParameters) {
        currentParameters = bestFitParameters;
        currentEvaluation = bestFitEvaluation;
        roundImproved = true;
      }
    }

    for (const spec of STRENGTH_PARAMETER_SPECS) {
      steps[spec.key] *= roundImproved ? spec.decay : spec.decay * 0.9;
    }
  }

  return {
    fittedParameters: bestSelectionParameters,
    baselineEvaluation: evaluateStrengthParameterSet(
      fitContexts,
      tuneContexts,
      validationContexts,
      initialParameters,
      gameParameters,
    ),
    fittedEvaluation: bestSelectionEvaluation,
    evaluations,
  };
}

function buildPreparedExamplesByYear(
  contextsByYear: Record<number, HistoricalGameContextExample[]>,
  strengthParameters: StrengthModelParameterSet,
) {
  return Object.fromEntries(
    Object.entries(contextsByYear).map(([year, contexts]) => [
      Number(year),
      prepareGameExamplesForStrengthParameters(contexts, strengthParameters),
    ]),
  ) as Record<number, PreparedGameExample[]>;
}

function buildEvaluation(
  preparedByYear: Record<number, PreparedGameExample[]>,
  fitYears: number[],
  tuneYears: number[],
  validationYears: number[],
  gameParameters: GameModelParameterSet,
): StageEvaluation {
  const fitExamples = fitYears.flatMap((year) => preparedByYear[year] ?? []);
  const tuneExamples = tuneYears.flatMap((year) => preparedByYear[year] ?? []);
  const validationExamples = validationYears.flatMap((year) => preparedByYear[year] ?? []);

  return {
    fit: scorePreparedExamples(fitExamples, gameParameters),
    tune: tuneExamples.length > 0 ? scorePreparedExamples(tuneExamples, gameParameters) : null,
    validation: validationExamples.length > 0 ? scorePreparedExamples(validationExamples, gameParameters) : null,
    selectionScore:
      tuneExamples.length > 0
        ? scorePreparedExamples(tuneExamples, gameParameters).logLoss
        : scorePreparedExamples(fitExamples, gameParameters).logLoss,
  };
}

export function fitRuntimeModelParameters(
  seasons: TrainingCorpusSeason[],
  trainYears: number[],
  validationYears: number[],
  options: RuntimeFitOptions = {},
): RuntimeFitResult {
  const iterations = options.iterations ?? 2;
  const strengthMaxRounds = options.strengthMaxRounds ?? 6;
  const gameMaxRounds = options.gameMaxRounds ?? 7;
  const { fitYears, tuneYears } = splitTrainYears(trainYears);
  const contextsByYear = prepareHistoricalGameExamples(seasons);
  const baselineStrength = normalizeStrengthParameterSet(
    options.initialStrength ?? CURRENT_STRENGTH_MODEL_PARAMETERS ?? DEFAULT_STRENGTH_MODEL_PARAMETERS,
  );
  const baselineGame = CURRENT_GAME_MODEL_PARAMETERS;
  let currentStrength = baselineStrength;
  let currentGame = baselineGame;
  let totalStrengthEvaluations = 0;
  let totalGameEvaluations = 0;
  const iterationSummaries: RuntimeModelBacktestSummary["iterations"] = [];

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const strengthResult = fitStrengthModelParameters(
      contextsByYear,
      trainYears,
      validationYears,
      currentStrength,
      strengthMaxRounds,
      currentGame,
    );
    currentStrength = strengthResult.fittedParameters;
    totalStrengthEvaluations += strengthResult.evaluations;

    const preparedByYear = buildPreparedExamplesByYear(contextsByYear, currentStrength);
    const gameResult = fitGameModelParametersFromPreparedExamples(
      preparedByYear,
      trainYears,
      validationYears,
      {
        initial: currentGame,
        maxRounds: gameMaxRounds,
      },
    );
    currentGame = gameResult.artifact.fittedParameters;
    totalGameEvaluations += gameResult.artifact.search.evaluations;

    iterationSummaries.push({
      iteration,
      strengthValidationLogLoss: strengthResult.fittedEvaluation.validation?.logLoss ?? null,
      gameValidationLogLoss: gameResult.backtest.fitted.validation?.logLoss ?? null,
    });
  }

  const baselinePreparedByYear = buildPreparedExamplesByYear(contextsByYear, baselineStrength);
  const fittedPreparedByYear = buildPreparedExamplesByYear(contextsByYear, currentStrength);
  const baselineEvaluation = buildEvaluation(
    baselinePreparedByYear,
    fitYears,
    tuneYears,
    validationYears,
    baselineGame,
  );
  const fittedEvaluation = buildEvaluation(
    fittedPreparedByYear,
    fitYears,
    tuneYears,
    validationYears,
    currentGame,
  );
  const baselineValidationExamples = validationYears.flatMap((year) => baselinePreparedByYear[year] ?? []);
  const fittedValidationExamples = validationYears.flatMap((year) => fittedPreparedByYear[year] ?? []);

  return {
    artifact: {
      manifestType: "kbo-runtime-model-parameters",
      version: 1,
      trainedAt: new Date().toISOString(),
      objective: "multiclass-log-loss",
      fitYears,
      tuneYears,
      validationYears,
      search: {
        iterations,
        strengthRounds: strengthMaxRounds,
        gameRounds: gameMaxRounds,
        evaluations: {
          strength: totalStrengthEvaluations,
          game: totalGameEvaluations,
          total: totalStrengthEvaluations + totalGameEvaluations,
        },
      },
      baselineParameters: {
        strength: baselineStrength,
        game: baselineGame,
      },
      fittedParameters: {
        strength: currentStrength,
        game: currentGame,
      },
    },
    backtest: {
      manifestType: "kbo-runtime-model-backtest-summary",
      version: 1,
      generatedAt: new Date().toISOString(),
      objective: "multiclass-log-loss",
      fitYears,
      tuneYears,
      validationYears,
      baseline: {
        fit: baselineEvaluation.fit,
        tune: baselineEvaluation.tune,
        validation: baselineEvaluation.validation,
      },
      fitted: {
        fit: fittedEvaluation.fit,
        tune: fittedEvaluation.tune,
        validation: fittedEvaluation.validation,
      },
      deltas: {
        fitLogLoss: roundMetric(fittedEvaluation.fit.logLoss - baselineEvaluation.fit.logLoss),
        tuneLogLoss:
          fittedEvaluation.tune && baselineEvaluation.tune
            ? roundMetric(fittedEvaluation.tune.logLoss - baselineEvaluation.tune.logLoss)
            : null,
        validationLogLoss:
          fittedEvaluation.validation && baselineEvaluation.validation
            ? roundMetric(fittedEvaluation.validation.logLoss - baselineEvaluation.validation.logLoss)
            : null,
        fitBrierScore: roundMetric(fittedEvaluation.fit.brierScore - baselineEvaluation.fit.brierScore),
        tuneBrierScore:
          fittedEvaluation.tune && baselineEvaluation.tune
            ? roundMetric(fittedEvaluation.tune.brierScore - baselineEvaluation.tune.brierScore)
            : null,
        validationBrierScore:
          fittedEvaluation.validation && baselineEvaluation.validation
            ? roundMetric(fittedEvaluation.validation.brierScore - baselineEvaluation.validation.brierScore)
            : null,
      },
      calibration: {
        baselineValidation: buildCalibrationSummary(baselineValidationExamples, baselineGame),
        fittedValidation: buildCalibrationSummary(fittedValidationExamples, currentGame),
      },
      iterations: iterationSummaries,
    },
  };
}
