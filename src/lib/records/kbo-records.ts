import type {
  Game,
  Player,
  PlayerSeasonStat,
  PlayerSplitStat,
  TeamDisplay,
  TeamSeasonStat,
  TeamSplitStat,
} from "@/lib/domain/kbo/types";

export type LeaderRow = {
  statId: string;
  playerId: string;
  playerNameKo: string;
  teamLabel: string;
  primaryValue: number;
  valueState: "ranked" | "zero" | "missing";
  primaryLabel: string;
  secondaryLabel: string;
  games: number;
  plateAppearances?: number | null;
  atBats?: number | null;
  runs?: number | null;
  hits: number | null;
  homeRuns: number | null;
  rbi?: number | null;
  stolenBases?: number | null;
  walks?: number | null;
  strikeouts: number | null;
  battingAverage?: number | null;
  ops?: number | null;
  era?: number | null;
  inningsPitched?: number | null;
  wins?: number | null;
  losses?: number | null;
  saves?: number | null;
  holds?: number | null;
  whip?: number | null;
  hitsAllowed?: number | null;
  homeRunsAllowed?: number | null;
};

export type HitterLeaderMetric =
  | "battingAverage"
  | "ops"
  | "homeRuns"
  | "rbi"
  | "hits"
  | "runs"
  | "stolenBases";
export type PitcherLeaderMetric = "era" | "whip" | "strikeouts" | "wins" | "saves" | "holds";
export type PlayerFilterOption = {
  value: string;
  label: string;
};
export type PlayerRecordFilters = {
  query: string;
  seasonTeamId: string;
  position: string;
};
export type PlayerSituationFilterGroup =
  | "all"
  | "month"
  | "matchup"
  | "runner"
  | "count"
  | "out"
  | "inning"
  | "battingOrder";

export const PLAYER_RECORD_FILTER_ALL = "all";

const PLAYER_POSITION_LABELS: Record<string, string> = {
  P: "투수",
  C: "포수",
  IF: "내야수",
  OF: "외야수",
  UTIL: "기타",
};

const PLAYER_POSITION_ORDER = ["P", "C", "IF", "OF", "UTIL"];

const PLAYER_SPLIT_GROUP_LABELS: Record<Exclude<PlayerSituationFilterGroup, "all">, string> = {
  month: "월별",
  matchup: "상대 유형",
  runner: "주자 상황",
  count: "볼카운트",
  out: "아웃카운트",
  inning: "이닝",
  battingOrder: "타순",
};

const PLAYER_SPLIT_GROUP_ORDER: Array<Exclude<PlayerSituationFilterGroup, "all">> = [
  "month",
  "matchup",
  "runner",
  "count",
  "out",
  "inning",
  "battingOrder",
];

const RUNNER_SPLIT_ORDER = [
  "BASES EMPTY",
  "RUNNERS ON",
  "ONLY 1ST BASE",
  "ONLY 2ND BASE",
  "ONLY 3RD BASE",
  "1ST AND 2ND",
  "1ST AND 3RD",
  "2ND AND 3RD",
  "BASES LOADED",
];

const OUT_SPLIT_ORDER = ["NO OUT", "ONE OUT", "TWO OUTS"];
const MATCHUP_SPLIT_ORDER = ["VS LEFTY", "VS RIGHTY", "VS UNDER"];
const MONTH_SPLIT_ORDER = ["MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];

type HitterMetricSource = {
  battingAverage?: number | null;
  ops?: number | null;
  homeRuns: number | null;
  rbi?: number | null;
  hits: number | null;
  runs?: number | null;
  stolenBases?: number | null;
};

type PitcherMetricSource = {
  era: number | null;
  whip?: number | null;
  strikeouts: number | null;
  wins: number | null;
  saves: number | null;
  holds?: number | null;
};

function buildPlayerLookup(players: Player[]) {
  return Object.fromEntries(players.map((player) => [player.playerId, player]));
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDecimal(value: number, digits: number) {
  return value.toFixed(digits).replace(/^0(?=\.)/, "");
}

function teamLabelFor(displayById: Record<string, TeamDisplay>, seasonTeamId: string) {
  return displayById[seasonTeamId]?.shortNameKo ?? seasonTeamId;
}

function getPlayerName(playerById: Record<string, Player>, playerId: string) {
  return playerById[playerId]?.nameKo ?? playerId;
}

function matchesPlayerFilters(args: {
  player: Player | undefined;
  playerNameKo: string;
  teamLabel: string;
  seasonTeamId: string;
  filters: PlayerRecordFilters;
}) {
  if (
    args.filters.seasonTeamId !== PLAYER_RECORD_FILTER_ALL &&
    args.filters.seasonTeamId !== args.seasonTeamId
  ) {
    return false;
  }

  if (
    args.filters.position !== PLAYER_RECORD_FILTER_ALL &&
    !(args.player?.primaryPositions ?? []).includes(args.filters.position)
  ) {
    return false;
  }

  const normalizedQuery = normalizeQuery(args.filters.query);
  if (!normalizedQuery) {
    return true;
  }

  return (
    args.playerNameKo.toLowerCase().includes(normalizedQuery) ||
    args.teamLabel.toLowerCase().includes(normalizedQuery)
  );
}

function compareDescending(left: LeaderRow, right: LeaderRow) {
  const stateCompare = compareValueState(left, right);
  if (stateCompare !== 0) {
    return stateCompare;
  }
  return (
    right.primaryValue - left.primaryValue ||
    left.playerNameKo.localeCompare(right.playerNameKo, "ko")
  );
}

function compareAscending(left: LeaderRow, right: LeaderRow) {
  const stateCompare = compareValueState(left, right);
  if (stateCompare !== 0) {
    return stateCompare;
  }
  return (
    left.primaryValue - right.primaryValue ||
    left.playerNameKo.localeCompare(right.playerNameKo, "ko")
  );
}

function metricValueState(value: number | null | undefined): LeaderRow["valueState"] {
  if (!isNumber(value)) {
    return "missing";
  }
  if (value === 0) {
    return "zero";
  }
  return "ranked";
}

function valueStateRank(state: LeaderRow["valueState"]) {
  if (state === "ranked") {
    return 0;
  }
  if (state === "zero") {
    return 1;
  }
  return 2;
}

function compareValueState(left: LeaderRow, right: LeaderRow) {
  return valueStateRank(left.valueState) - valueStateRank(right.valueState);
}

function hitterMetricValue(
  item: HitterMetricSource,
  metric: HitterLeaderMetric,
): number | null | undefined {
  if (metric === "battingAverage") {
    return item.battingAverage;
  }
  if (metric === "ops") {
    return item.ops;
  }
  if (metric === "homeRuns") {
    return item.homeRuns;
  }
  if (metric === "rbi") {
    return item.rbi;
  }
  if (metric === "runs") {
    return item.runs;
  }
  if (metric === "stolenBases") {
    return item.stolenBases;
  }
  return item.hits;
}

function hitterMetricLabel(
  item: HitterMetricSource,
  metric: HitterLeaderMetric,
) {
  const value = hitterMetricValue(item, metric);
  if (!isNumber(value)) {
    if (metric === "battingAverage") {
      return "타율 기록 없음";
    }
    if (metric === "ops") {
      return "OPS 기록 없음";
    }
    if (metric === "homeRuns") {
      return "홈런 기록 없음";
    }
    if (metric === "rbi") {
      return "타점 기록 없음";
    }
    if (metric === "runs") {
      return "득점 기록 없음";
    }
    if (metric === "stolenBases") {
      return "도루 기록 없음";
    }
    return "안타 기록 없음";
  }
  if (metric === "battingAverage") {
    return `타율 ${formatDecimal(item.battingAverage ?? 0, 3)}`;
  }
  if (metric === "ops") {
    return `OPS ${formatDecimal(item.ops ?? 0, 3)}`;
  }
  if (metric === "homeRuns") {
    return `홈런 ${item.homeRuns ?? 0}`;
  }
  if (metric === "rbi") {
    return `타점 ${item.rbi ?? 0}`;
  }
  if (metric === "runs") {
    return `득점 ${item.runs ?? 0}`;
  }
  if (metric === "stolenBases") {
    return `도루 ${item.stolenBases ?? 0}`;
  }
  return `안타 ${item.hits ?? 0}`;
}

function pitcherMetricValue(
  item: PitcherMetricSource,
  metric: PitcherLeaderMetric,
): number | null | undefined {
  if (metric === "era") {
    return item.era;
  }
  if (metric === "whip") {
    return item.whip;
  }
  if (metric === "wins") {
    return item.wins;
  }
  if (metric === "saves") {
    return item.saves;
  }
  if (metric === "holds") {
    return item.holds;
  }
  return item.strikeouts;
}

function pitcherMetricLabel(
  item: PitcherMetricSource,
  metric: PitcherLeaderMetric,
) {
  const value = pitcherMetricValue(item, metric);
  if (!isNumber(value)) {
    if (metric === "era") {
      return "ERA 기록 없음";
    }
    if (metric === "whip") {
      return "WHIP 기록 없음";
    }
    if (metric === "wins") {
      return "승 기록 없음";
    }
    if (metric === "saves") {
      return "세이브 기록 없음";
    }
    if (metric === "holds") {
      return "홀드 기록 없음";
    }
    return "탈삼진 기록 없음";
  }
  if (metric === "era") {
    return `ERA ${(item.era ?? 99).toFixed(2)}`;
  }
  if (metric === "whip") {
    return `WHIP ${(item.whip ?? 99).toFixed(2)}`;
  }
  if (metric === "wins") {
    return `승 ${item.wins ?? 0}`;
  }
  if (metric === "saves") {
    return `세이브 ${item.saves ?? 0}`;
  }
  if (metric === "holds") {
    return `홀드 ${item.holds ?? 0}`;
  }
  return `탈삼진 ${item.strikeouts ?? 0}`;
}

function classifySplitGroup(split: PlayerSplitStat): Exclude<PlayerSituationFilterGroup, "all"> | null {
  if (split.splitType === "month") {
    return "month";
  }

  const normalized = split.splitKey.toUpperCase();
  if (normalized.startsWith("VS ")) {
    return "matchup";
  }
  if (/^\d-\d$/.test(normalized)) {
    return "count";
  }
  if (
    RUNNER_SPLIT_ORDER.includes(normalized)
  ) {
    return "runner";
  }
  if (OUT_SPLIT_ORDER.includes(normalized)) {
    return "out";
  }
  if (/^\d+(?:ST|ND|RD|TH)\s+INNING$/.test(normalized)) {
    return "inning";
  }
  if (normalized.startsWith("BATTING #")) {
    return "battingOrder";
  }

  return null;
}

function splitGroupOrder(group: Exclude<PlayerSituationFilterGroup, "all">) {
  return PLAYER_SPLIT_GROUP_ORDER.indexOf(group);
}

function monthOrderKey(splitKey: string) {
  const index = MONTH_SPLIT_ORDER.indexOf(splitKey.toUpperCase());
  return index === -1 ? MONTH_SPLIT_ORDER.length : index;
}

function runnerOrderKey(splitKey: string) {
  const index = RUNNER_SPLIT_ORDER.indexOf(splitKey.toUpperCase());
  return index === -1 ? RUNNER_SPLIT_ORDER.length : index;
}

function outOrderKey(splitKey: string) {
  const index = OUT_SPLIT_ORDER.indexOf(splitKey.toUpperCase());
  return index === -1 ? OUT_SPLIT_ORDER.length : index;
}

function matchupOrderKey(splitKey: string) {
  const index = MATCHUP_SPLIT_ORDER.indexOf(splitKey.toUpperCase());
  return index === -1 ? MATCHUP_SPLIT_ORDER.length : index;
}

function inningOrderKey(splitKey: string) {
  const match = splitKey.toUpperCase().match(/^(\d+)(?:ST|ND|RD|TH)\s+INNING$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function battingOrderKey(splitKey: string) {
  const rangeMatch = splitKey.toUpperCase().match(/^BATTING\s+#(\d+)-(\d+)$/);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    return Number.parseInt(rangeMatch[1], 10) * 10 + Number.parseInt(rangeMatch[2], 10);
  }
  const singleMatch = splitKey.toUpperCase().match(/^BATTING\s+#(\d+)$/);
  return singleMatch?.[1] ? Number.parseInt(singleMatch[1], 10) : Number.MAX_SAFE_INTEGER;
}

function compareSplitValueOptions(
  group: Exclude<PlayerSituationFilterGroup, "all">,
  left: PlayerFilterOption,
  right: PlayerFilterOption,
) {
  if (group === "month") {
    return monthOrderKey(left.value) - monthOrderKey(right.value);
  }
  if (group === "runner") {
    return runnerOrderKey(left.value) - runnerOrderKey(right.value);
  }
  if (group === "out") {
    return outOrderKey(left.value) - outOrderKey(right.value);
  }
  if (group === "matchup") {
    return matchupOrderKey(left.value) - matchupOrderKey(right.value);
  }
  if (group === "inning") {
    return inningOrderKey(left.value) - inningOrderKey(right.value);
  }
  if (group === "battingOrder") {
    return battingOrderKey(left.value) - battingOrderKey(right.value);
  }
  if (group === "count") {
    return left.value.localeCompare(right.value, "en");
  }
  return left.label.localeCompare(right.label, "ko");
}

function splitMetricValue(
  split: PlayerSplitStat,
  statType: "hitter" | "pitcher",
  metric: HitterLeaderMetric | PitcherLeaderMetric,
) : number | null | undefined {
  return statType === "hitter"
    ? hitterMetricValue(split, metric as HitterLeaderMetric)
    : pitcherMetricValue(split, metric as PitcherLeaderMetric);
}

export function buildPlayerTeamOptions(
  playerSeasonStats: PlayerSeasonStat[],
  displayById: Record<string, TeamDisplay>,
  statType: "hitter" | "pitcher",
) {
  const options = Array.from(
    new Set(
      playerSeasonStats
        .filter((stat) => stat.statType === statType)
        .map((stat) => stat.seasonTeamId),
    ),
  )
    .map((seasonTeamId) => ({
      value: seasonTeamId,
      label: displayById[seasonTeamId]?.shortNameKo ?? seasonTeamId,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ko"));

  return [
    { value: PLAYER_RECORD_FILTER_ALL, label: "팀 선택" },
    ...options,
  ];
}

export function buildPlayerPositionOptions(
  playerSeasonStats: PlayerSeasonStat[],
  players: Player[],
  statType: "hitter" | "pitcher",
) {
  const playerIds = new Set(
    playerSeasonStats
      .filter((stat) => stat.statType === statType)
      .map((stat) => stat.playerId),
  );
  const positions = Array.from(
    new Set(
      players
        .filter((player) => playerIds.has(player.playerId))
        .flatMap((player) => player.primaryPositions),
    ),
  ).sort(
    (left, right) =>
      PLAYER_POSITION_ORDER.indexOf(left) - PLAYER_POSITION_ORDER.indexOf(right),
  );

  return [
    { value: PLAYER_RECORD_FILTER_ALL, label: "포지션 선택" },
    ...positions.map((position) => ({
      value: position,
      label: PLAYER_POSITION_LABELS[position] ?? position,
    })),
  ];
}

export function buildPlayerSituationGroupOptions(
  playerSplitStats: PlayerSplitStat[],
  statType: "hitter" | "pitcher",
  metric: HitterLeaderMetric | PitcherLeaderMetric,
) {
  const groups = Array.from(
    new Set(
      playerSplitStats
        .filter((split) => split.statType === statType)
        .filter((split) => isNumber(splitMetricValue(split, statType, metric)))
        .map((split) => classifySplitGroup(split))
        .filter((group): group is Exclude<PlayerSituationFilterGroup, "all"> => group !== null),
    ),
  ).sort((left, right) => splitGroupOrder(left) - splitGroupOrder(right));

  return [
    { value: PLAYER_RECORD_FILTER_ALL, label: "경기상황별1" },
    ...groups.map((group) => ({
      value: group,
      label: PLAYER_SPLIT_GROUP_LABELS[group],
    })),
  ];
}

export function buildPlayerSituationValueOptions(
  playerSplitStats: PlayerSplitStat[],
  players: Player[],
  statType: "hitter" | "pitcher",
  metric: HitterLeaderMetric | PitcherLeaderMetric,
  group: PlayerSituationFilterGroup,
  seasonTeamId: string,
  position: string,
) {
  if (group === PLAYER_RECORD_FILTER_ALL) {
    return [{ value: PLAYER_RECORD_FILTER_ALL, label: "경기상황별2" }];
  }

  const playerById = buildPlayerLookup(players);
  const options = Array.from(
    new Map(
      playerSplitStats
        .filter((split) => split.statType === statType)
        .filter((split) => classifySplitGroup(split) === group)
        .filter((split) => isNumber(splitMetricValue(split, statType, metric)))
        .filter((split) =>
          matchesPlayerFilters({
            player: playerById[split.playerId],
            playerNameKo: getPlayerName(playerById, split.playerId),
            teamLabel: split.seasonTeamId,
            seasonTeamId: split.seasonTeamId,
            filters: {
              query: "",
              seasonTeamId,
              position,
            },
          }),
        )
        .map((split) => [split.splitKey, { value: split.splitKey, label: split.splitLabel }] as const),
    ).values(),
  ).sort((left, right) =>
    compareSplitValueOptions(group, left, right),
  );

  return [{ value: PLAYER_RECORD_FILTER_ALL, label: "경기상황별2" }, ...options];
}

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
  metric: HitterLeaderMetric,
  filters: PlayerRecordFilters,
) {
  const playerById = buildPlayerLookup(players);
  const seasonTeamIdByStatId = Object.fromEntries(
    playerSeasonStats.map((stat) => [stat.statId, stat.seasonTeamId] as const),
  );
  const rows: LeaderRow[] = playerSeasonStats
    .filter((stat) => stat.statType === "hitter")
    .map((stat) => {
      const playerNameKo = getPlayerName(playerById, stat.playerId);
      const teamLabel = teamLabelFor(displayById, stat.seasonTeamId);
      const value = hitterMetricValue(stat, metric);
      return {
        statId: stat.statId,
        playerId: stat.playerId,
        playerNameKo,
        teamLabel,
        primaryValue: value ?? 0,
        valueState: metricValueState(value),
        primaryLabel: hitterMetricLabel(stat, metric),
        secondaryLabel: `${teamLabel} · 경기 ${stat.games}`,
        games: stat.games,
        plateAppearances: stat.plateAppearances,
        atBats: stat.atBats,
        runs: stat.runs,
        hits: stat.hits,
        homeRuns: stat.homeRuns,
        rbi: stat.rbi,
        stolenBases: stat.stolenBases,
        walks: stat.walks,
        strikeouts: stat.strikeouts,
        battingAverage: stat.battingAverage,
        ops: stat.ops,
        era: null,
        inningsPitched: null,
        wins: null,
        losses: null,
        saves: null,
        holds: null,
        whip: null,
        hitsAllowed: null,
        homeRunsAllowed: null,
      };
    })
    .filter((row) => {
      const player = playerById[row.playerId];
      return matchesPlayerFilters({
        player,
        playerNameKo: row.playerNameKo,
        teamLabel: row.teamLabel,
        seasonTeamId: seasonTeamIdByStatId[row.statId] ?? "",
        filters,
      });
    })
    .sort(compareDescending);

  return rows;
}

export function buildPitcherLeaderRows(
  playerSeasonStats: PlayerSeasonStat[],
  players: Player[],
  displayById: Record<string, TeamDisplay>,
  metric: PitcherLeaderMetric,
  filters: PlayerRecordFilters,
) {
  const playerById = buildPlayerLookup(players);
  const seasonTeamIdByStatId = Object.fromEntries(
    playerSeasonStats.map((stat) => [stat.statId, stat.seasonTeamId] as const),
  );
  const rows: LeaderRow[] = playerSeasonStats
    .filter((stat) => stat.statType === "pitcher")
    .map((stat) => {
      const playerNameKo = getPlayerName(playerById, stat.playerId);
      const teamLabel = teamLabelFor(displayById, stat.seasonTeamId);
      const value = pitcherMetricValue(stat, metric);
      return {
        statId: stat.statId,
        playerId: stat.playerId,
        playerNameKo,
        teamLabel,
        primaryValue: value ?? 0,
        valueState: metricValueState(value),
        primaryLabel: pitcherMetricLabel(stat, metric),
        secondaryLabel: `${teamLabel} · 경기 ${stat.games}`,
        games: stat.games,
        plateAppearances: null,
        atBats: null,
        runs: null,
        hits: stat.hits,
        homeRuns: stat.homeRuns,
        rbi: null,
        stolenBases: null,
        walks: stat.walks,
        strikeouts: stat.strikeouts,
        battingAverage: null,
        ops: null,
        era: stat.era,
        inningsPitched: stat.inningsPitched,
        wins: stat.wins,
        losses: stat.losses,
        saves: stat.saves,
        holds: stat.holds,
        whip: stat.whip,
        hitsAllowed: stat.hitsAllowed,
        homeRunsAllowed: stat.homeRunsAllowed,
      };
    })
    .filter((row) => {
      const player = playerById[row.playerId];
      return matchesPlayerFilters({
        player,
        playerNameKo: row.playerNameKo,
        teamLabel: row.teamLabel,
        seasonTeamId: seasonTeamIdByStatId[row.statId] ?? "",
        filters,
      });
    })
    .sort(metric === "era" || metric === "whip" ? compareAscending : compareDescending);

  return rows;
}

export function buildPlayerSplitLeaderRows(
  playerSplitStats: PlayerSplitStat[],
  players: Player[],
  displayById: Record<string, TeamDisplay>,
  statType: "hitter" | "pitcher",
  metric: HitterLeaderMetric | PitcherLeaderMetric,
  filters: PlayerRecordFilters,
  group: PlayerSituationFilterGroup,
  splitKey: string,
) {
  if (group === PLAYER_RECORD_FILTER_ALL || splitKey === PLAYER_RECORD_FILTER_ALL) {
    return [];
  }

  const playerById = buildPlayerLookup(players);
  const seasonTeamIdByStatId = Object.fromEntries(
    playerSplitStats.map((split) => [split.playerSplitStatId, split.seasonTeamId] as const),
  );
  const rows: LeaderRow[] = playerSplitStats
    .filter((split) => split.statType === statType)
    .filter((split) => classifySplitGroup(split) === group)
    .filter((split) => split.splitKey === splitKey)
    .map((split) => {
      const playerNameKo = getPlayerName(playerById, split.playerId);
      const teamLabel = teamLabelFor(displayById, split.seasonTeamId);
      const value =
        statType === "hitter"
          ? hitterMetricValue(split, metric as HitterLeaderMetric)
          : pitcherMetricValue(split, metric as PitcherLeaderMetric);
      return {
        statId: split.playerSplitStatId,
        playerId: split.playerId,
        playerNameKo,
        teamLabel,
        primaryValue: value ?? 0,
        valueState: metricValueState(value),
        primaryLabel:
          statType === "hitter"
            ? hitterMetricLabel(split, metric as HitterLeaderMetric)
            : pitcherMetricLabel(split, metric as PitcherLeaderMetric),
        secondaryLabel: `${teamLabel} · ${split.splitLabel} · ${split.summaryLine}`,
        games: split.games,
        plateAppearances: split.plateAppearances,
        atBats: split.atBats,
        runs: split.runs,
        hits: split.hits,
        homeRuns: split.homeRuns,
        rbi: split.rbi,
        stolenBases: split.stolenBases,
        walks: split.walks,
        strikeouts: split.strikeouts,
        battingAverage: split.battingAverage,
        ops: split.ops,
        era: split.era,
        inningsPitched: split.inningsPitched,
        wins: split.wins,
        losses: split.losses,
        saves: split.saves,
        holds: split.holds,
        whip: null,
        hitsAllowed: split.hitsAllowed,
        homeRunsAllowed: split.homeRunsAllowed,
      };
    })
    .filter((row) =>
      matchesPlayerFilters({
        player: playerById[row.playerId],
        playerNameKo: row.playerNameKo,
        teamLabel: row.teamLabel,
        seasonTeamId: seasonTeamIdByStatId[row.statId] ?? "",
        filters,
      }),
    )
    .sort(
      statType === "pitcher" && (metric === "era" || metric === "whip")
        ? compareAscending
        : compareDescending,
    );

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
