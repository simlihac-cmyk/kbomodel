import type {
  ExplanationReason,
  Game,
  Player,
  PlayerGameStat,
  PlayerSeasonStat,
  RosterEvent,
  SeasonTeam,
  TeamSeasonStat,
} from "@/lib/domain/kbo/types";

const STARTER_ROTATION_GAMES = 5;
const STARTER_MIN_REST_DAYS = 4;
const LIMITED_STARTER_EXTRA_REST_DAYS = 2;
const RECENT_EVENT_WINDOW_DAYS = 10;
const RECENT_BULLPEN_WINDOW_GAMES = 5;
const DAY_MS = 86_400_000;

type AvailabilityState = "active" | "limited" | "inactive";

export type ProjectedStarterAssignment = {
  playerId: string;
  playerName: string;
  starterDelta: number;
  availability: AvailabilityState;
  note: string;
};

export type GameStarterProjection = {
  home: ProjectedStarterAssignment | null;
  away: ProjectedStarterAssignment | null;
};

export type TeamPlayerImpact = {
  seasonTeamId: string;
  offenseDelta: number;
  starterDelta: number;
  bullpenDelta: number;
  confidenceDelta: number;
  explanationReasons: ExplanationReason[];
};

export type PlayerImpactContext = {
  byTeamId: Record<string, TeamPlayerImpact>;
  starterByGameId: Record<string, GameStarterProjection>;
};

type LeagueHitterContext = {
  ops: number;
  war: number;
  homeRunsPerGame: number;
  hitsPerPlateAppearance: number;
};

type LeagueStarterContext = {
  era: number;
  war: number;
  strikeoutsPerNine: number;
  inningsPerGame: number;
};

type LeagueBullpenContext = {
  era: number;
  war: number;
  savesPerGame: number;
};

type PitcherAppearance = {
  gameId: string;
  seasonTeamId: string;
  scheduledAt: number;
  innings: number | null;
};

type StarterProjectionCandidate = {
  assignment: ProjectedStarterAssignment;
  nextAvailableAt: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[], fallback: number) {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number | null | undefined, denominator: number | null | undefined, fallback = 0) {
  if (numerator == null || denominator == null || denominator <= 0) {
    return fallback;
  }
  return numerator / denominator;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function parseDateOnlyTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = new Date(`${value}T12:00:00+09:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function diffDays(later: number, earlier: number) {
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((later - earlier) / 86_400_000);
}

function normalizeFractionalInnings(raw: number) {
  const whole = Math.trunc(raw);
  const fraction = Math.round((raw - whole) * 10);
  if (fraction === 1) {
    return whole + 1 / 3;
  }
  if (fraction === 2) {
    return whole + 2 / 3;
  }
  return raw;
}

function parseInningsFromSummary(summaryLine: string) {
  const fractionalSlashMatch = summaryLine.match(/(\d+)\s+([12])\/3\s*(?:이닝|IP)/i);
  if (fractionalSlashMatch) {
    return Number(fractionalSlashMatch[1]) + Number(fractionalSlashMatch[2]) / 3;
  }

  const unicodeThirdMatch = summaryLine.match(/(\d+)\s*(⅓|⅔)\s*(?:이닝|IP)/i);
  if (unicodeThirdMatch) {
    return Number(unicodeThirdMatch[1]) + (unicodeThirdMatch[2] === "⅓" ? 1 / 3 : 2 / 3);
  }

  const decimalMatch = summaryLine.match(/(\d+(?:\.\d+)?)\s*(?:이닝|IP)/i);
  if (decimalMatch) {
    return normalizeFractionalInnings(Number(decimalMatch[1]));
  }

  return null;
}

function getPrimaryPosition(player: Player | undefined) {
  return player?.primaryPositions[0] ?? "";
}

function isHitter(player: Player | undefined, stat: PlayerSeasonStat) {
  return stat.statType === "hitter" || !["SP", "RP", "CL"].includes(getPrimaryPosition(player));
}

function isStarter(player: Player | undefined, stat: PlayerSeasonStat) {
  return stat.statType === "pitcher" && getPrimaryPosition(player) === "SP";
}

function isReliever(player: Player | undefined, stat: PlayerSeasonStat) {
  return stat.statType === "pitcher" && ["RP", "CL"].includes(getPrimaryPosition(player));
}

function resolveAvailabilityState(player: Player | undefined, latestEvent: RosterEvent | null): AvailabilityState {
  if (!latestEvent) {
    return "active";
  }

  if (latestEvent.type === "transferred" || latestEvent.type === "released") {
    return "inactive";
  }

  if (latestEvent.type === "injured") {
    return getPrimaryPosition(player) === "SP" ? "limited" : "inactive";
  }

  return "active";
}

function availabilityMultiplier(state: AvailabilityState) {
  if (state === "active") {
    return 1;
  }
  if (state === "limited") {
    return 0.58;
  }
  return 0;
}

function buildSnapshotTimestamp(games: Game[], rosterEvents: RosterEvent[]) {
  const latestFinalGame = Math.max(
    ...games
      .filter((game) => game.status === "final")
      .map((game) => parseTimestamp(game.scheduledAt)),
    Number.NEGATIVE_INFINITY,
  );
  const latestRosterEvent = Math.max(
    ...rosterEvents.map((event) => parseDateOnlyTimestamp(event.date)),
    Number.NEGATIVE_INFINITY,
  );

  const snapshotTimestamp = Math.max(latestFinalGame, latestRosterEvent);
  return Number.isFinite(snapshotTimestamp) ? snapshotTimestamp : Date.now();
}

function buildLatestEventByPlayer(rosterEvents: RosterEvent[], snapshotTimestamp: number) {
  const map: Record<string, RosterEvent> = {};
  const sortedEvents = [...rosterEvents]
    .filter((event) => parseDateOnlyTimestamp(event.date) <= snapshotTimestamp)
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const event of sortedEvents) {
    map[event.playerId] = event;
  }

  return map;
}

function buildLeagueHitterContext(playerSeasonStats: PlayerSeasonStat[]) {
  return {
    ops: average(playerSeasonStats.map((stat) => stat.ops ?? 0.72), 0.72),
    war: average(playerSeasonStats.map((stat) => stat.war ?? 0.25), 0.25),
    homeRunsPerGame: average(
      playerSeasonStats.map((stat) => ratio(stat.homeRuns, stat.games, 0)),
      0.04,
    ),
    hitsPerPlateAppearance: average(
      playerSeasonStats.map((stat) =>
        ratio(stat.hits, stat.plateAppearances ?? stat.atBats, 0.24),
      ),
      0.24,
    ),
  } satisfies LeagueHitterContext;
}

function buildLeagueStarterContext(playerSeasonStats: PlayerSeasonStat[]) {
  return {
    era: average(playerSeasonStats.map((stat) => stat.era ?? 4.1), 4.1),
    war: average(playerSeasonStats.map((stat) => stat.war ?? 0.35), 0.35),
    strikeoutsPerNine: average(
      playerSeasonStats.map((stat) => ratio(stat.strikeouts, stat.inningsPitched, 0.82) * 9),
      7.4,
    ),
    inningsPerGame: average(
      playerSeasonStats.map((stat) => ratio(stat.inningsPitched, stat.games, 5.1)),
      5.1,
    ),
  } satisfies LeagueStarterContext;
}

function buildLeagueBullpenContext(playerSeasonStats: PlayerSeasonStat[]) {
  return {
    era: average(playerSeasonStats.map((stat) => stat.era ?? 4.25), 4.25),
    war: average(playerSeasonStats.map((stat) => stat.war ?? 0.1), 0.1),
    savesPerGame: average(
      playerSeasonStats.map((stat) => ratio(stat.saves, stat.games, 0.12)),
      0.12,
    ),
  } satisfies LeagueBullpenContext;
}

function buildHitterDelta(stat: PlayerSeasonStat, league: LeagueHitterContext) {
  const opsEdge = (stat.ops ?? league.ops) - league.ops;
  const warEdge = (stat.war ?? league.war) - league.war;
  const homeRunEdge = ratio(stat.homeRuns, stat.games, league.homeRunsPerGame) - league.homeRunsPerGame;
  const hitRateEdge =
    ratio(stat.hits, stat.plateAppearances ?? stat.atBats, league.hitsPerPlateAppearance) -
    league.hitsPerPlateAppearance;

  return clamp(
    opsEdge * 44 + warEdge * 4.8 + homeRunEdge * 12 + hitRateEdge * 8,
    -7,
    7,
  );
}

function buildStarterDelta(stat: PlayerSeasonStat, league: LeagueStarterContext) {
  const eraEdge = league.era - (stat.era ?? league.era);
  const warEdge = (stat.war ?? league.war) - league.war;
  const strikeoutEdge =
    ratio(stat.strikeouts, stat.inningsPitched, league.strikeoutsPerNine / 9) * 9 -
    league.strikeoutsPerNine;
  const inningsEdge =
    ratio(stat.inningsPitched, stat.games, league.inningsPerGame) - league.inningsPerGame;

  return clamp(
    eraEdge * 2.1 + warEdge * 5.6 + strikeoutEdge * 0.45 + inningsEdge * 0.9,
    -8,
    8,
  );
}

function buildBullpenDelta(stat: PlayerSeasonStat, league: LeagueBullpenContext) {
  const eraEdge = league.era - (stat.era ?? league.era);
  const warEdge = (stat.war ?? league.war) - league.war;
  const saveEdge = ratio(stat.saves, stat.games, league.savesPerGame) - league.savesPerGame;

  return clamp(eraEdge * 1.6 + warEdge * 4.2 + saveEdge * 7, -5, 5);
}

function buildDirection(value: number): ExplanationReason["direction"] {
  if (value > 0.1) {
    return "positive";
  }
  if (value < -0.1) {
    return "negative";
  }
  return "neutral";
}

function buildFallbackStarterAssignments(args: {
  games: Game[];
  currentGamesPlayed: number;
  starterGames: number;
  assignment: ProjectedStarterAssignment;
}) {
  const { games, currentGamesPlayed, starterGames, assignment } = args;
  if (assignment.availability === "inactive") {
    return {} as Record<string, ProjectedStarterAssignment>;
  }

  const futureTeamGames = [...games]
    .filter((game) => game.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const assignments: Record<string, ProjectedStarterAssignment> = {};
  const nextProjectedGameNumber =
    starterGames * STARTER_ROTATION_GAMES +
    1 +
    (assignment.availability === "limited" ? 1 : 0);

  for (let futureIndex = 0; futureIndex < futureTeamGames.length; futureIndex += 1) {
    const futureGame = futureTeamGames[futureIndex];
    const teamGameNumber = currentGamesPlayed + futureIndex + 1;
    if (teamGameNumber < nextProjectedGameNumber) {
      continue;
    }
    if ((teamGameNumber - nextProjectedGameNumber) % STARTER_ROTATION_GAMES !== 0) {
      continue;
    }
    assignments[futureGame.gameId] = assignment;
  }

  return assignments;
}

function buildPitcherAppearances(
  playerGameStats: PlayerGameStat[],
  games: Game[],
): Record<string, PitcherAppearance[]> {
  const gameById = Object.fromEntries(games.map((game) => [game.gameId, game]));
  const appearancesByPlayer: Record<string, PitcherAppearance[]> = {};

  for (const stat of playerGameStats) {
    if (stat.statType !== "pitcher") {
      continue;
    }

    const game = gameById[stat.gameId];
    if (!game || game.status !== "final") {
      continue;
    }

    appearancesByPlayer[stat.playerId] ??= [];
    appearancesByPlayer[stat.playerId].push({
      gameId: stat.gameId,
      seasonTeamId: stat.seasonTeamId,
      scheduledAt: parseTimestamp(game.scheduledAt),
      innings: parseInningsFromSummary(stat.summaryLine),
    });
  }

  return Object.fromEntries(
    Object.entries(appearancesByPlayer).map(([playerId, appearances]) => [
      playerId,
      appearances.sort((left, right) => right.scheduledAt - left.scheduledAt),
    ]),
  );
}

function buildRotationStarterAssignments(args: {
  games: Game[];
  candidates: StarterProjectionCandidate[];
}) {
  const { games, candidates } = args;
  const futureTeamGames = [...games]
    .filter((game) => game.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const assignments: Record<string, ProjectedStarterAssignment> = {};
  const mutableCandidates = candidates.map((candidate) => ({ ...candidate }));

  for (const futureGame of futureTeamGames) {
    const scheduledAt = parseTimestamp(futureGame.scheduledAt);
    const eligible = mutableCandidates
      .filter((candidate) => candidate.nextAvailableAt <= scheduledAt)
      .sort(
        (left, right) =>
          left.nextAvailableAt - right.nextAvailableAt ||
          right.assignment.starterDelta - left.assignment.starterDelta,
      );

    const selected = eligible[0];
    if (!selected) {
      continue;
    }

    assignments[futureGame.gameId] = selected.assignment;
    const extraRestDays =
      selected.assignment.availability === "limited"
        ? LIMITED_STARTER_EXTRA_REST_DAYS
        : 0;
    selected.nextAvailableAt =
      scheduledAt + (STARTER_MIN_REST_DAYS + extraRestDays) * DAY_MS;
  }

  return assignments;
}

function buildBullpenLoadAdjustment(args: {
  teamId: string;
  games: Game[];
  playerGameStats: PlayerGameStat[];
  playersById: Record<string, Player>;
  snapshotTimestamp: number;
}) {
  const { teamId, games, playerGameStats, playersById, snapshotTimestamp } = args;
  const recentFinalGames = [...games]
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeSeasonTeamId === teamId || game.awaySeasonTeamId === teamId),
    )
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, RECENT_BULLPEN_WINDOW_GAMES);

  if (recentFinalGames.length === 0) {
    return { delta: 0, sentence: null as string | null };
  }

  let loadScore = 0;
  let usedRelieverLogs = false;

  for (const game of recentFinalGames) {
    const relieverLogs = playerGameStats.filter(
      (stat) =>
        stat.gameId === game.gameId &&
        stat.seasonTeamId === teamId &&
        stat.statType === "pitcher" &&
        ["RP", "CL"].includes(getPrimaryPosition(playersById[stat.playerId])),
    );
    const relieverInnings = relieverLogs.reduce(
      (sum, stat) => sum + (parseInningsFromSummary(stat.summaryLine) ?? 0),
      0,
    );
    const margin = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
    const extraInnings = Math.max(0, (game.innings ?? 9) - 9);

    if (relieverLogs.length > 0) {
      usedRelieverLogs = true;
      loadScore +=
        Math.max(0, relieverInnings - 3.2) * 0.9 +
        Math.max(0, relieverLogs.length - 2) * 0.35 +
        extraInnings * 0.45 +
        (margin <= 2 ? 0.16 : 0);
      continue;
    }

    loadScore +=
      extraInnings * 0.5 +
      (game.isTie ? 0.25 : 0) +
      (margin <= 2 ? 0.16 : 0);
  }

  const latestGameAt = parseTimestamp(recentFinalGames[0]?.scheduledAt ?? null);
  const idleDays = diffDays(snapshotTimestamp, latestGameAt);
  const recoveryBoost = idleDays >= 2 ? Math.min(0.35, idleDays * 0.08) : 0;
  const averageLoad = loadScore / recentFinalGames.length;
  const delta = Number(
    clamp(-averageLoad * 1.3 + recoveryBoost, -2.8, 0.35).toFixed(2),
  );

  if (Math.abs(delta) < 0.15) {
    return { delta, sentence: null as string | null };
  }

  return {
    delta,
    sentence:
      delta < 0
        ? usedRelieverLogs
          ? "최근 경기의 reliever usage와 접전 빈도를 반영해 불펜 소모 패널티를 적용했습니다."
          : "최근 접전과 연장 이닝 비중을 반영해 불펜 피로도를 소폭 반영했습니다."
        : "최근 일정 간격이 넉넉해 불펜 회복 여지를 소폭 반영했습니다.",
  };
}

export function buildPlayerImpactContext(args: {
  seasonTeams: SeasonTeam[];
  games: Game[];
  teamSeasonStats: TeamSeasonStat[];
  players: Player[];
  rosterEvents: RosterEvent[];
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
}): PlayerImpactContext {
  const {
    seasonTeams,
    games,
    teamSeasonStats,
    players,
    rosterEvents,
    playerSeasonStats,
    playerGameStats,
  } = args;
  const playersById = Object.fromEntries(players.map((player) => [player.playerId, player]));
  const snapshotTimestamp = buildSnapshotTimestamp(games, rosterEvents);
  const latestEventByPlayer = buildLatestEventByPlayer(rosterEvents, snapshotTimestamp);
  const appearancesByPlayer = buildPitcherAppearances(playerGameStats, games);
  const currentTeamStatsById = Object.fromEntries(
    teamSeasonStats.map((stat) => [stat.seasonTeamId, stat]),
  );

  const hitterStats = playerSeasonStats.filter((stat) => isHitter(playersById[stat.playerId], stat));
  const starterStats = playerSeasonStats.filter((stat) => isStarter(playersById[stat.playerId], stat));
  const bullpenStats = playerSeasonStats.filter((stat) => isReliever(playersById[stat.playerId], stat));

  const hitterLeague = buildLeagueHitterContext(hitterStats);
  const starterLeague = buildLeagueStarterContext(starterStats);
  const bullpenLeague = buildLeagueBullpenContext(bullpenStats);

  const byTeamId = Object.fromEntries(
    seasonTeams.map((seasonTeam) => [
      seasonTeam.seasonTeamId,
      {
        seasonTeamId: seasonTeam.seasonTeamId,
        offenseDelta: 0,
        starterDelta: 0,
        bullpenDelta: 0,
        confidenceDelta: 0,
        explanationReasons: [],
      } satisfies TeamPlayerImpact,
    ]),
  ) as Record<string, TeamPlayerImpact>;
  const starterAssignmentsByTeam: Record<string, Record<string, ProjectedStarterAssignment>> = {};

  for (const seasonTeam of seasonTeams) {
    const teamId = seasonTeam.seasonTeamId;
    const impact = byTeamId[teamId];
    const teamStats = currentTeamStatsById[teamId];
    const currentGamesPlayed = teamStats
      ? teamStats.wins + teamStats.losses + teamStats.ties
      : 0;

    const teamPlayerStats = playerSeasonStats.filter((stat) => stat.seasonTeamId === teamId);
    const teamHitters = teamPlayerStats
      .filter((stat) => isHitter(playersById[stat.playerId], stat))
      .map((stat) => ({
        stat,
        player: playersById[stat.playerId],
        rawDelta: buildHitterDelta(stat, hitterLeague),
      }))
      .sort((left, right) => right.rawDelta - left.rawDelta);
    const teamStarters = teamPlayerStats
      .filter((stat) => isStarter(playersById[stat.playerId], stat))
      .map((stat) => ({
        stat,
        player: playersById[stat.playerId],
        rawDelta: buildStarterDelta(stat, starterLeague),
      }))
      .sort((left, right) => right.rawDelta - left.rawDelta);
    const teamRelievers = teamPlayerStats
      .filter((stat) => isReliever(playersById[stat.playerId], stat))
      .map((stat) => ({
        stat,
        player: playersById[stat.playerId],
        rawDelta: buildBullpenDelta(stat, bullpenLeague),
      }))
      .sort((left, right) => right.rawDelta - left.rawDelta);

    const keyHitter = teamHitters[0] ?? null;
    if (keyHitter) {
      const latestEvent = latestEventByPlayer[keyHitter.stat.playerId] ?? null;
      const state = resolveAvailabilityState(keyHitter.player, latestEvent);
      const recentActivation =
        latestEvent &&
        ["activated", "joined"].includes(latestEvent.type) &&
        diffDays(snapshotTimestamp, parseDateOnlyTimestamp(latestEvent.date)) <= RECENT_EVENT_WINDOW_DAYS;
      const contribution = keyHitter.rawDelta * availabilityMultiplier(state);
      const penalty =
        state === "inactive"
          ? -Math.max(1.2, Math.abs(keyHitter.rawDelta) * 0.55)
          : state === "limited"
            ? -Math.max(0.55, Math.abs(keyHitter.rawDelta) * 0.22)
            : 0;
      const activationBoost = recentActivation ? 0.75 : 0;

      impact.offenseDelta = Number(
        clamp(impact.offenseDelta + contribution + penalty + activationBoost, -7, 7).toFixed(2),
      );
      impact.confidenceDelta = Number(
        clamp(
          impact.confidenceDelta +
            (state === "inactive" ? -0.03 : state === "limited" ? -0.015 : 0) +
            (recentActivation ? 0.01 : 0),
          -0.08,
          0.04,
        ).toFixed(3),
      );

      impact.explanationReasons.push({
        key: `key-hitter:${keyHitter.stat.playerId}`,
        label: "핵심 타자",
        direction: buildDirection(impact.offenseDelta),
        magnitude: Number((Math.abs(impact.offenseDelta) / 4).toFixed(3)),
        sentence:
          state === "inactive"
            ? `${keyHitter.player?.nameKo ?? keyHitter.stat.playerId}의 최근 이탈 이벤트를 반영해 타선 가동률을 낮췄습니다.`
            : recentActivation
              ? `${keyHitter.player?.nameKo ?? keyHitter.stat.playerId}의 복귀 신호를 반영해 타선 기본치를 소폭 올렸습니다.`
              : `${keyHitter.player?.nameKo ?? keyHitter.stat.playerId}의 OPS ${(keyHitter.stat.ops ?? 0).toFixed(3)} / WAR ${(keyHitter.stat.war ?? 0).toFixed(1)}를 핵심 타선 신호로 반영했습니다.`,
      });
    }

    const frontlineStarter = teamStarters[0] ?? null;
    if (frontlineStarter) {
      const latestEvent = latestEventByPlayer[frontlineStarter.stat.playerId] ?? null;
      const state = resolveAvailabilityState(frontlineStarter.player, latestEvent);
      const baselineContribution = frontlineStarter.rawDelta * 0.35 * availabilityMultiplier(state);
      const penalty =
        state === "inactive"
          ? -Math.max(2.2, Math.abs(frontlineStarter.rawDelta) * 0.75)
          : state === "limited"
            ? -Math.max(1.1, Math.abs(frontlineStarter.rawDelta) * 0.28)
            : 0;

      impact.starterDelta = Number(
        clamp(impact.starterDelta + baselineContribution + penalty, -8, 8).toFixed(2),
      );
      impact.confidenceDelta = Number(
        clamp(
          impact.confidenceDelta + (state === "inactive" ? -0.06 : state === "limited" ? -0.035 : 0),
          -0.12,
          0.04,
        ).toFixed(3),
      );

      impact.explanationReasons.push({
        key: `frontline-starter:${frontlineStarter.stat.playerId}`,
        label: "프런트라인 선발",
        direction: buildDirection(impact.starterDelta),
        magnitude: Number((Math.abs(impact.starterDelta) / 5).toFixed(3)),
        sentence:
          state === "limited"
            ? `${frontlineStarter.player?.nameKo ?? frontlineStarter.stat.playerId}의 최근 컨디션 이슈를 반영해 선발 기본치를 조금 낮췄습니다.`
            : state === "inactive"
              ? `${frontlineStarter.player?.nameKo ?? frontlineStarter.stat.playerId}의 이탈로 선발 기본 전력을 보수적으로 계산합니다.`
              : `${frontlineStarter.player?.nameKo ?? frontlineStarter.stat.playerId}의 ERA ${(frontlineStarter.stat.era ?? 0).toFixed(2)} / WAR ${(frontlineStarter.stat.war ?? 0).toFixed(1)}를 선발 전력에 연결했습니다.`,
      });

      const teamGames = games.filter(
        (game) =>
          game.homeSeasonTeamId === teamId || game.awaySeasonTeamId === teamId,
      );
      const starterCandidates = teamStarters
        .map((starter) => {
          const starterEvent = latestEventByPlayer[starter.stat.playerId] ?? null;
          const starterState = resolveAvailabilityState(starter.player, starterEvent);
          const starterDelta = Number(
            (starter.rawDelta * 0.65 * availabilityMultiplier(starterState)).toFixed(2),
          );
          const latestAppearanceAt =
            appearancesByPlayer[starter.stat.playerId]?.[0]?.scheduledAt ??
            snapshotTimestamp -
              Math.max(
                1,
                STARTER_ROTATION_GAMES -
                  Math.min(starter.stat.games ?? 0, STARTER_ROTATION_GAMES),
              ) *
                DAY_MS;

          return {
            assignment: {
              playerId: starter.stat.playerId,
              playerName: starter.player?.nameKo ?? starter.stat.playerId,
              starterDelta,
              availability: starterState,
              note:
                starterState === "limited"
                  ? starterEvent?.note || "최근 이슈로 휴식일을 늘려 추정합니다."
                  : "최근 pitcher game log와 휴식일 기준으로 등판 턴을 추정합니다.",
            } satisfies ProjectedStarterAssignment,
            nextAvailableAt:
              latestAppearanceAt +
              (STARTER_MIN_REST_DAYS +
                (starterState === "limited" ? LIMITED_STARTER_EXTRA_REST_DAYS : 0)) *
                DAY_MS,
            hasLoggedAppearance: Boolean(appearancesByPlayer[starter.stat.playerId]?.length),
            fallbackStartsTaken: Math.min(
              Math.max(starter.stat.games ?? 0, 0),
              Math.max(1, Math.ceil(currentGamesPlayed / STARTER_ROTATION_GAMES)),
            ),
          };
        })
        .filter(
          (starter) =>
            starter.assignment.availability !== "inactive" &&
            Math.abs(starter.assignment.starterDelta) >= 0.15,
        );

      const rotationCandidates = starterCandidates.filter(
        (starter) => starter.hasLoggedAppearance,
      );
      if (rotationCandidates.length >= 1) {
        starterAssignmentsByTeam[teamId] = buildRotationStarterAssignments({
          games: teamGames,
          candidates: rotationCandidates.map((starter) => ({
            assignment: starter.assignment,
            nextAvailableAt: starter.nextAvailableAt,
          })),
        });
        impact.explanationReasons.push({
          key: `starter-rotation:${teamId}`,
          label: "선발 턴 추정",
          direction: "neutral",
          magnitude: 0.22,
          sentence: "최근 pitcher game log와 휴식일 간격을 기준으로 남은 경기 likely starter turn을 추정합니다.",
        });
      } else {
        const projectedStarter = starterCandidates[0]?.assignment ?? null;
        const starterTurnsTaken = starterCandidates[0]?.fallbackStartsTaken ?? 0;
        starterAssignmentsByTeam[teamId] =
          !projectedStarter
            ? {}
            : buildFallbackStarterAssignments({
                games: teamGames,
                currentGamesPlayed,
                starterGames: starterTurnsTaken,
                assignment: projectedStarter,
              });
      }
    }

    const bullpenLoad = buildBullpenLoadAdjustment({
      teamId,
      games,
      playerGameStats,
      playersById,
      snapshotTimestamp,
    });

    if (teamRelievers.length > 0) {
      const selectedRelievers = teamRelievers.slice(0, 2);
      const averageDelta = average(selectedRelievers.map((item) => item.rawDelta), 0);
      impact.bullpenDelta = Number(
        clamp(averageDelta * 0.55 + bullpenLoad.delta, -4.5, 4.5).toFixed(2),
      );
      const topReliever = selectedRelievers[0];
      if (topReliever && Math.abs(impact.bullpenDelta) > 0.2) {
        impact.explanationReasons.push({
          key: `bullpen-anchor:${topReliever.stat.playerId}`,
          label: "불펜 앵커",
          direction: buildDirection(impact.bullpenDelta),
          magnitude: Number((Math.abs(impact.bullpenDelta) / 4).toFixed(3)),
          sentence: `${topReliever.player?.nameKo ?? topReliever.stat.playerId} 중심의 불펜 지표를 후반 이닝 전력에 반영했습니다.`,
        });
      }
    } else if (Math.abs(bullpenLoad.delta) > 0) {
      impact.bullpenDelta = bullpenLoad.delta;
    }

    if (bullpenLoad.sentence) {
      impact.explanationReasons.push({
        key: `bullpen-load:${teamId}`,
        label: "최근 불펜 소모",
        direction: buildDirection(bullpenLoad.delta),
        magnitude: Number((Math.abs(bullpenLoad.delta) / 4).toFixed(3)),
        sentence: bullpenLoad.sentence,
      });
    }
  }

  const starterByGameId = Object.fromEntries(
    games
      .filter((game) => game.status !== "final")
      .map((game) => [
        game.gameId,
        {
          home: starterAssignmentsByTeam[game.homeSeasonTeamId]?.[game.gameId] ?? null,
          away: starterAssignmentsByTeam[game.awaySeasonTeamId]?.[game.gameId] ?? null,
        } satisfies GameStarterProjection,
      ]),
  ) as Record<string, GameStarterProjection>;

  return {
    byTeamId,
    starterByGameId,
  };
}
