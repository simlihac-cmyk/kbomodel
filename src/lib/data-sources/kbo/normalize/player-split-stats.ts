import type { KboDataBundle, PlayerSplitStat } from "@/lib/domain/kbo/types";
import {
  normalizedPlayerSplitStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedPlayerRegisterRow,
  type ParsedPlayerSituationHitterRow,
  type ParsedPlayerSituationPitcherRow,
  type ParsedPlayerSplitMonthHitterRow,
  type ParsedPlayerSplitMonthPitcherRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import {
  buildOfficialRegisterLookup,
  resolveOfficialPlayerIdentity,
} from "@/lib/data-sources/kbo/normalize/player-season-stats";

type NormalizePlayerSplitStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  hitters: ParsedPlayerSplitMonthHitterRow[];
  pitchers: ParsedPlayerSplitMonthPitcherRow[];
  hitterSituations?: ParsedPlayerSituationHitterRow[];
  pitcherSituations?: ParsedPlayerSituationPitcherRow[];
  registerRows: ParsedPlayerRegisterRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRefs: NormalizedSourceReference[];
};

function monthLabel(monthKey: string) {
  const labels: Record<string, string> = {
    MAR: "3월",
    APR: "4월",
    MAY: "5월",
    JUN: "6월",
    JUL: "7월",
    AUG: "8월",
    SEP: "9월",
    OCT: "10월",
    NOV: "11월",
  };
  return labels[monthKey.toUpperCase()] ?? monthKey;
}

function createPlayerSplitId(
  seasonId: string,
  playerId: string,
  splitType: "month" | "situation",
  splitKey: string,
  statType: "hitter" | "pitcher",
) {
  return `pss:${seasonId}:${playerId}:${splitType}:${splitKey.toUpperCase()}:${statType}`;
}

function summarizeHitterRow(row: ParsedPlayerSplitMonthHitterRow) {
  return `${monthLabel(row.monthKey)} ${row.avg.toFixed(3)} · ${row.hits}안타 · ${row.homeRuns}홈런`;
}

function summarizePitcherRow(row: ParsedPlayerSplitMonthPitcherRow) {
  return `${monthLabel(row.monthKey)} ERA ${row.era.toFixed(2)} · ${row.inningsPitched}이닝 · ${row.strikeouts}K`;
}

function situationLabel(statType: "hitter" | "pitcher", situationKey: string) {
  const normalized = situationKey.trim().toUpperCase();
  if (statType === "hitter") {
    if (normalized === "VS LEFTY") return "좌투 상대";
    if (normalized === "VS RIGHTY") return "우투 상대";
    if (normalized === "VS UNDER") return "언더핸드 상대";
  } else {
    if (normalized === "VS LEFTY") return "좌타 상대";
    if (normalized === "VS RIGHTY") return "우타 상대";
  }
  if (/^\d-\d$/.test(normalized)) {
    return `카운트 ${normalized}`;
  }
  if (normalized === "BASES EMPTY") return "주자 없을 때";
  if (normalized === "RUNNERS ON") return "주자 있을 때";
  if (normalized === "ONLY 1ST BASE") return "1루 주자";
  if (normalized === "ONLY 2ND BASE") return "2루 주자";
  if (normalized === "ONLY 3RD BASE") return "3루 주자";
  if (normalized === "1ST AND 2ND") return "1, 2루";
  if (normalized === "1ST AND 3RD") return "1, 3루";
  if (normalized === "2ND AND 3RD") return "2, 3루";
  if (normalized === "BASES LOADED") return "만루";
  if (normalized === "NO OUT") return "무사";
  if (normalized === "ONE OUT") return "1사";
  if (normalized === "TWO OUTS") return "2사";
  const inningMatch = normalized.match(/^(\d+)(?:ST|ND|RD|TH)\s+INNING$/);
  if (inningMatch?.[1]) {
    return `${inningMatch[1]}회`;
  }
  const battingOrderRangeMatch = normalized.match(/^BATTING\s+#(\d+)-(\d+)$/);
  if (battingOrderRangeMatch?.[1] && battingOrderRangeMatch[2]) {
    return `타순 ${battingOrderRangeMatch[1]}-${battingOrderRangeMatch[2]}번`;
  }
  const battingOrderMatch = normalized.match(/^BATTING\s+#(\d+)$/);
  if (battingOrderMatch?.[1]) {
    return `타순 ${battingOrderMatch[1]}번`;
  }
  return normalized;
}

function summarizeHitterSituation(row: ParsedPlayerSituationHitterRow) {
  return `${situationLabel("hitter", row.situationKey)} ${row.avg.toFixed(3)} · ${row.hits}안타 · ${row.homeRuns}홈런`;
}

function summarizePitcherSituation(row: ParsedPlayerSituationPitcherRow) {
  return `${situationLabel("pitcher", row.situationKey)} 피안타율 ${row.opponentAvg.toFixed(3)} · ${row.hitsAllowed}피안타 · ${row.strikeouts}K`;
}

export function normalizePlayerSplitStats({
  seasonId,
  sourceId,
  hitters,
  pitchers,
  hitterSituations = [],
  pitcherSituations = [],
  registerRows,
  bundle,
  patches,
  sourceRefs,
}: NormalizePlayerSplitStatsArgs) {
  const registerLookup = buildOfficialRegisterLookup(registerRows, seasonId, bundle, patches);
  const rows: PlayerSplitStat[] = [];

  for (const row of hitters) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    rows.push({
      playerSplitStatId: createPlayerSplitId(seasonId, identity.player.playerId, "month", row.monthKey, "hitter"),
      seasonId,
      playerId: identity.player.playerId,
      seasonTeamId: identity.seasonTeamId,
      statType: "hitter",
      splitType: "month",
      splitKey: row.monthKey.toUpperCase(),
      splitLabel: monthLabel(row.monthKey),
      games: row.games,
      plateAppearances: row.atBats + row.walks + row.hitByPitch,
      atBats: row.atBats,
      hits: row.hits,
      homeRuns: row.homeRuns,
      ops: null,
      era: null,
      inningsPitched: null,
      strikeouts: row.strikeouts,
      saves: null,
      wins: null,
      losses: null,
      summaryLine: summarizeHitterRow(row),
    });
  }

  for (const row of pitchers) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    rows.push({
      playerSplitStatId: createPlayerSplitId(seasonId, identity.player.playerId, "month", row.monthKey, "pitcher"),
      seasonId,
      playerId: identity.player.playerId,
      seasonTeamId: identity.seasonTeamId,
      statType: "pitcher",
      splitType: "month",
      splitKey: row.monthKey.toUpperCase(),
      splitLabel: monthLabel(row.monthKey),
      games: row.games,
      plateAppearances: row.plateAppearances,
      atBats: null,
      hits: row.hitsAllowed,
      homeRuns: row.homeRunsAllowed,
      ops: null,
      era: row.era,
      inningsPitched: row.inningsPitched,
      strikeouts: row.strikeouts,
      saves: row.saves,
      wins: row.wins,
      losses: row.losses,
      summaryLine: summarizePitcherRow(row),
    });
  }

  for (const row of hitterSituations) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    rows.push({
      playerSplitStatId: createPlayerSplitId(seasonId, identity.player.playerId, "situation", row.situationKey, "hitter"),
      seasonId,
      playerId: identity.player.playerId,
      seasonTeamId: identity.seasonTeamId,
      statType: "hitter",
      splitType: "situation",
      splitKey: row.situationKey.toUpperCase(),
      splitLabel: situationLabel("hitter", row.situationKey),
      games: 0,
      plateAppearances: row.atBats + row.walks + row.hitByPitch,
      atBats: row.atBats,
      hits: row.hits,
      homeRuns: row.homeRuns,
      ops: null,
      era: null,
      inningsPitched: null,
      strikeouts: row.strikeouts,
      saves: null,
      wins: null,
      losses: null,
      summaryLine: summarizeHitterSituation(row),
    });
  }

  for (const row of pitcherSituations) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    rows.push({
      playerSplitStatId: createPlayerSplitId(seasonId, identity.player.playerId, "situation", row.situationKey, "pitcher"),
      seasonId,
      playerId: identity.player.playerId,
      seasonTeamId: identity.seasonTeamId,
      statType: "pitcher",
      splitType: "situation",
      splitKey: row.situationKey.toUpperCase(),
      splitLabel: situationLabel("pitcher", row.situationKey),
      games: 0,
      plateAppearances: null,
      atBats: null,
      hits: row.hitsAllowed,
      homeRuns: row.homeRunsAllowed,
      ops: null,
      era: null,
      inningsPitched: null,
      strikeouts: row.strikeouts,
      saves: null,
      wins: null,
      losses: null,
      summaryLine: summarizePitcherSituation(row),
    });
  }

  return normalizedPlayerSplitStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: sourceRefs,
    rows: Array.from(new Map(rows.map((row) => [row.playerSplitStatId, row] as const)).values()),
  });
}
