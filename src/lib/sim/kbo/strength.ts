import { BASE_HOME_FIELD_ADVANTAGE } from "@/lib/domain/kbo/constants";
import { buildStrengthReasons } from "@/lib/domain/kbo/explanations";
import type {
  Game,
  SeasonTeam,
  TeamSeasonStat,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";
import type { TeamPlayerImpact } from "@/lib/sim/kbo/player-impact";
import {
  buildBullpenProxySignal,
  buildConfidenceScore,
  buildCurrentWeight,
  buildHomeFieldAdjustmentFromState,
  buildOffenseSignal,
  buildRecentFormAdjustment,
  buildRunPreventionSignal,
  buildScheduleStrengthValue,
  buildTeamStateLeagueAverages,
  buildTeamStateSnapshot,
} from "@/lib/sim/kbo/shared-team-state";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRemainingDifficultyMap(
  seasonTeams: SeasonTeam[],
  games: Game[],
  teamSeasonStats: TeamSeasonStat[],
): Record<string, number> {
  const stateById = Object.fromEntries(teamSeasonStats.map((stat) => [stat.seasonTeamId, buildTeamStateSnapshot(stat)]));
  const league = buildTeamStateLeagueAverages(Object.values(stateById));
  const currentPower = Object.fromEntries(
    Object.values(stateById).map((state) => [
      state.seasonTeamId,
      buildScheduleStrengthValue(state, league),
    ]),
  );

  const difficulty: Record<string, number[]> = {};
  for (const seasonTeam of seasonTeams) {
    difficulty[seasonTeam.seasonTeamId] = [];
  }

  for (const game of games) {
    if (game.status === "final") {
      continue;
    }

    difficulty[game.homeSeasonTeamId].push(currentPower[game.awaySeasonTeamId] ?? 100);
    difficulty[game.awaySeasonTeamId].push(currentPower[game.homeSeasonTeamId] ?? 100);
  }

  return Object.fromEntries(
    Object.entries(difficulty).map(([seasonTeamId, values]) => {
      if (values.length === 0) {
        return [seasonTeamId, 0];
      }
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return [seasonTeamId, Number((average / 12).toFixed(3))];
    }),
  );
}

function buildHeadToHeadLeverageMap(games: Game[]): Record<string, number> {
  const leverage: Record<string, number> = {};

  for (const game of games) {
    if (game.status === "final") {
      continue;
    }

    leverage[game.homeSeasonTeamId] = (leverage[game.homeSeasonTeamId] ?? 0) + 1;
    leverage[game.awaySeasonTeamId] = (leverage[game.awaySeasonTeamId] ?? 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(leverage).map(([seasonTeamId, count]) => [seasonTeamId, Number((count / 12).toFixed(3))]),
  );
}

export function buildTeamStrengthSnapshots(
  seasonTeams: SeasonTeam[],
  currentSeasonStats: TeamSeasonStat[],
  previousSeasonStats: TeamSeasonStat[],
  games: Game[],
  playerImpactByTeam: Record<string, TeamPlayerImpact> = {},
  regularSeasonGamesPerTeam = 144,
): TeamStrengthSnapshot[] {
  const currentById = Object.fromEntries(currentSeasonStats.map((stat) => [stat.seasonTeamId, stat]));
  const previousByFranchise = Object.fromEntries(
    previousSeasonStats.map((stat) => [stat.seasonTeamId.split(":")[1], stat]),
  );
  const currentStateById = Object.fromEntries(
    currentSeasonStats.map((stat) => [stat.seasonTeamId, buildTeamStateSnapshot(stat)]),
  );
  const previousStateByFranchise = Object.fromEntries(
    previousSeasonStats.map((stat) => [stat.seasonTeamId.split(":")[1], buildTeamStateSnapshot(stat)]),
  );
  const leagueState = buildTeamStateLeagueAverages(Object.values(currentStateById));
  const previousLeagueState = buildTeamStateLeagueAverages(Object.values(previousStateByFranchise));
  const difficultyMap = buildRemainingDifficultyMap(seasonTeams, games, currentSeasonStats);
  const leverageMap = buildHeadToHeadLeverageMap(games);

  return seasonTeams.map((seasonTeam) => {
    const playerImpact = playerImpactByTeam[seasonTeam.seasonTeamId];
    const current = currentById[seasonTeam.seasonTeamId];
    const previous = previousByFranchise[seasonTeam.franchiseId];
    const currentState = currentStateById[seasonTeam.seasonTeamId] ?? null;
    const previousState = previousStateByFranchise[seasonTeam.franchiseId] ?? null;
    const gamesPlayed = current ? current.wins + current.losses + current.ties : 0;
    const currentWeight = Number(
      buildCurrentWeight(gamesPlayed, regularSeasonGamesPerTeam).toFixed(3),
    );
    const priorWeight = Number((1 - currentWeight).toFixed(3));
    const offensePlayerWeight = clamp(0.14 + currentWeight * 0.18, 0.12, 0.34);
    const starterPlayerWeight = clamp(0.18 + currentWeight * 0.22, 0.15, 0.4);
    const bullpenPlayerWeight = clamp(0.12 + currentWeight * 0.18, 0.12, 0.32);
    const confidencePlayerWeight = clamp(0.1 + currentWeight * 0.12, 0.08, 0.22);
    const manual = seasonTeam.manualAdjustments.reduce(
      (accumulator, item) => ({
        offense: accumulator.offense + item.offenseDelta,
        starter: accumulator.starter + item.starterDelta,
        bullpen: accumulator.bullpen + item.bullpenDelta,
        confidence: accumulator.confidence + item.confidenceDelta,
      }),
      { offense: 0, starter: 0, bullpen: 0, confidence: 0 },
    );
    const currentOffenseSignal = currentState ? buildOffenseSignal(currentState, leagueState) : 0;
    const currentRunPreventionSignal = currentState ? buildRunPreventionSignal(currentState, leagueState) : 0;
    const currentBullpenSignal = currentState ? buildBullpenProxySignal(currentState, leagueState) : 0;
    const priorOffenseSignal = previousState ? buildOffenseSignal(previousState, previousLeagueState) : 0;
    const priorRunPreventionSignal = previousState ? buildRunPreventionSignal(previousState, previousLeagueState) : 0;
    const priorBullpenSignal = previousState ? buildBullpenProxySignal(previousState, previousLeagueState) : 0;
    const priorOffenseBase = seasonTeam.preseasonPriors.offenseRating * 0.7 + (100 + priorOffenseSignal) * 0.3;
    const priorStarterBase = seasonTeam.preseasonPriors.starterRating * 0.7 + (100 + priorRunPreventionSignal * 0.9) * 0.3;
    const priorBullpenBase = seasonTeam.preseasonPriors.bullpenRating * 0.72 + (100 + priorBullpenSignal) * 0.28;
    const offenseRating = Number(
      (
        priorOffenseBase * priorWeight +
        (100 + currentOffenseSignal) * currentWeight +
        manual.offense +
        (playerImpact?.offenseDelta ?? 0) * offensePlayerWeight
      ).toFixed(2),
    );
    const starterRating = Number(
      (
        priorStarterBase * priorWeight +
        (100 + currentRunPreventionSignal * 0.92) * currentWeight +
        manual.starter +
        (playerImpact?.starterDelta ?? 0) * starterPlayerWeight
      ).toFixed(2),
    );
    const bullpenRating = Number(
      (
        priorBullpenBase * priorWeight +
        (100 + currentBullpenSignal) * currentWeight +
        manual.bullpen +
        (playerImpact?.bullpenDelta ?? 0) * bullpenPlayerWeight
      ).toFixed(2),
    );
    const baseRecentFormAdjustment = currentState ? buildRecentFormAdjustment(currentState) : 0;
    const recentFormAdjustment = Number(
      baseRecentFormAdjustment.toFixed(3),
    );
    const baseConfidenceScore = currentState ? buildConfidenceScore(currentState, currentWeight) : 0.24;
    const confidenceScore = Number(
      clamp(
        baseConfidenceScore +
          manual.confidence +
          (playerImpact?.confidenceDelta ?? 0) * confidencePlayerWeight,
        0.16,
        0.92,
      ).toFixed(3),
    );

    const snapshot: TeamStrengthSnapshot = {
      seasonTeamId: seasonTeam.seasonTeamId,
      offenseRating,
      starterRating,
      bullpenRating,
      homeFieldAdjustment: currentState
        ? Number(
            buildHomeFieldAdjustmentFromState(currentState, leagueState, BASE_HOME_FIELD_ADVANTAGE).toFixed(3),
          )
        : BASE_HOME_FIELD_ADVANTAGE,
      recentFormAdjustment,
      confidenceScore,
      priorWeight,
      currentWeight,
      scheduleDifficulty: difficultyMap[seasonTeam.seasonTeamId] ?? 0,
      headToHeadLeverage: leverageMap[seasonTeam.seasonTeamId] ?? 0,
      explanationReasons: [],
    };

    snapshot.explanationReasons = [
      ...buildStrengthReasons(snapshot),
      ...(playerImpact?.explanationReasons ?? []),
    ];
    return snapshot;
  });
}
