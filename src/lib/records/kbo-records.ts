import type {
  Game,
  Player,
  PlayerSeasonStat,
  TeamDisplay,
  TeamSeasonStat,
  TeamSplitStat,
} from "@/lib/domain/kbo/types";

type LeaderRow = {
  statId: string;
  playerId: string;
  playerNameKo: string;
  teamLabel: string;
  primaryValue: number;
  primaryLabel: string;
  secondaryLabel: string;
};

export function buildTeamRecordRows(
  teamSeasonStats: TeamSeasonStat[],
  displayById: Record<string, TeamDisplay>,
  sortBy: "wins" | "runsScored" | "runsAllowed" | "runDiff",
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return teamSeasonStats
    .filter((stat) => {
      if (!normalizedQuery) {
        return true;
      }
      const label = displayById[stat.seasonTeamId]?.displayNameKo ?? stat.seasonTeamId;
      const shortName = displayById[stat.seasonTeamId]?.shortNameKo ?? stat.seasonTeamId;
      return (
        label.toLowerCase().includes(normalizedQuery) ||
        shortName.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => {
      if (sortBy === "wins") {
        return right.wins - left.wins || left.losses - right.losses;
      }
      if (sortBy === "runsScored") {
        return right.runsScored - left.runsScored || right.wins - left.wins;
      }
      if (sortBy === "runsAllowed") {
        return left.runsAllowed - right.runsAllowed || right.wins - left.wins;
      }
      return (
        right.runsScored -
          right.runsAllowed -
          (left.runsScored - left.runsAllowed) ||
        right.wins - left.wins
      );
    });
}

export function buildHitterLeaderRows(
  playerSeasonStats: PlayerSeasonStat[],
  players: Player[],
  displayById: Record<string, TeamDisplay>,
  metric: "ops" | "homeRuns" | "war" | "hits",
  query: string,
) {
  const playerById = Object.fromEntries(players.map((player) => [player.playerId, player]));
  const normalizedQuery = query.trim().toLowerCase();
  const rows: LeaderRow[] = playerSeasonStats
    .filter((stat) => stat.statType === "hitter")
    .map((stat) => {
      const player = playerById[stat.playerId];
      const playerNameKo = player?.nameKo ?? stat.playerId;
      const teamLabel = displayById[stat.seasonTeamId]?.shortNameKo ?? stat.seasonTeamId;
      return {
        statId: stat.statId,
        playerId: stat.playerId,
        playerNameKo,
        teamLabel,
        primaryValue:
          metric === "ops"
            ? stat.ops ?? 0
            : metric === "homeRuns"
              ? stat.homeRuns ?? 0
              : metric === "war"
                ? stat.war ?? 0
                : stat.hits ?? 0,
        primaryLabel:
          metric === "ops"
            ? `OPS ${(stat.ops ?? 0).toFixed(3)}`
            : metric === "homeRuns"
              ? `홈런 ${stat.homeRuns ?? 0}`
              : metric === "war"
                ? `WAR ${(stat.war ?? 0).toFixed(1)}`
                : `안타 ${stat.hits ?? 0}`,
        secondaryLabel: `${teamLabel} · 경기 ${stat.games}`,
      };
    })
    .filter((row) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        row.playerNameKo.toLowerCase().includes(normalizedQuery) ||
        row.teamLabel.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => right.primaryValue - left.primaryValue);

  return rows;
}

export function buildPitcherLeaderRows(
  playerSeasonStats: PlayerSeasonStat[],
  players: Player[],
  displayById: Record<string, TeamDisplay>,
  metric: "era" | "strikeouts" | "wins" | "war",
  query: string,
) {
  const playerById = Object.fromEntries(players.map((player) => [player.playerId, player]));
  const normalizedQuery = query.trim().toLowerCase();
  const rows: LeaderRow[] = playerSeasonStats
    .filter((stat) => stat.statType === "pitcher")
    .map((stat) => {
      const player = playerById[stat.playerId];
      const playerNameKo = player?.nameKo ?? stat.playerId;
      const teamLabel = displayById[stat.seasonTeamId]?.shortNameKo ?? stat.seasonTeamId;
      return {
        statId: stat.statId,
        playerId: stat.playerId,
        playerNameKo,
        teamLabel,
        primaryValue:
          metric === "era"
            ? -(stat.era ?? 99)
            : metric === "strikeouts"
              ? stat.strikeouts ?? 0
              : metric === "wins"
                ? stat.wins ?? 0
                : stat.war ?? 0,
        primaryLabel:
          metric === "era"
            ? `ERA ${(stat.era ?? 99).toFixed(2)}`
            : metric === "strikeouts"
              ? `탈삼진 ${stat.strikeouts ?? 0}`
              : metric === "wins"
                ? `승 ${stat.wins ?? 0}`
                : `WAR ${(stat.war ?? 0).toFixed(1)}`,
        secondaryLabel: `${teamLabel} · 경기 ${stat.games}`,
      };
    })
    .filter((row) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        row.playerNameKo.toLowerCase().includes(normalizedQuery) ||
        row.teamLabel.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => right.primaryValue - left.primaryValue);

  return rows;
}

export function buildSplitExplorerRows(
  teamSplitStats: TeamSplitStat[],
  displayById: Record<string, TeamDisplay>,
  splitType: "all" | TeamSplitStat["splitType"],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return teamSplitStats
    .filter((split) => splitType === "all" || split.splitType === splitType)
    .filter((split) => {
      if (!normalizedQuery) {
        return true;
      }
      const teamLabel = displayById[split.seasonTeamId]?.shortNameKo ?? split.seasonTeamId;
      return (
        teamLabel.toLowerCase().includes(normalizedQuery) ||
        split.metricLabel.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => left.metricLabel.localeCompare(right.metricLabel));
}

export function buildGameLogRows(
  games: Game[],
  displayById: Record<string, TeamDisplay>,
  query: string,
  finalOnly: boolean,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return games
    .filter((game) => (finalOnly ? game.status === "final" : true))
    .filter((game) => {
      if (!normalizedQuery) {
        return true;
      }
      const home = displayById[game.homeSeasonTeamId]?.shortNameKo ?? game.homeSeasonTeamId;
      const away = displayById[game.awaySeasonTeamId]?.shortNameKo ?? game.awaySeasonTeamId;
      return (
        home.toLowerCase().includes(normalizedQuery) ||
        away.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt));
}
