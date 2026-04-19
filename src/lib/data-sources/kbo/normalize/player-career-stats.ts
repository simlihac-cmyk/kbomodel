import type { PlayerCareerStat, KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedPlayerCareerStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedPlayerRegisterRow,
  type ParsedPlayerSearchRow,
  type ParsedPlayerSummaryHitterRow,
  type ParsedPlayerSummaryPitcherRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";
import {
  buildOfficialPlayerSearchLookup,
  buildOfficialRegisterLookup,
  resolveOfficialPlayerIdentity,
} from "@/lib/data-sources/kbo/normalize/player-season-stats";

type NormalizePlayerCareerStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  hitters: ParsedPlayerSummaryHitterRow[];
  pitchers: ParsedPlayerSummaryPitcherRow[];
  registerRows: ParsedPlayerRegisterRow[];
  searchRows?: ParsedPlayerSearchRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRefs: NormalizedSourceReference[];
};

function buildCareerStatId(playerId: string, statType: "hitter" | "pitcher", year: number, teamLabel: string) {
  return `career:${playerId}:${statType}:${year}:${slugifyFragment(teamLabel)}`;
}

function createHitterCareerStat(
  playerId: string,
  careerRow: ParsedPlayerSummaryHitterRow["careerStats"][number],
): PlayerCareerStat {
  return {
    playerCareerStatId: buildCareerStatId(playerId, "hitter", careerRow.year, careerRow.teamName),
    playerId,
    year: careerRow.year,
    teamLabel: careerRow.teamName,
    statType: "hitter",
    games: careerRow.games,
    plateAppearances: null,
    battingAverage: careerRow.battingAverage,
    atBats: careerRow.atBats,
    runs: careerRow.runs,
    hits: careerRow.hits,
    homeRuns: careerRow.homeRuns,
    rbi: careerRow.rbi,
    stolenBases: careerRow.stolenBases,
    walks: careerRow.walks,
    onBasePct: null,
    sluggingPct: null,
    ops: null,
    era: null,
    inningsPitched: null,
    strikeouts: careerRow.strikeouts,
    saves: null,
    wins: null,
    losses: null,
    holds: null,
    whip: null,
    hitsAllowed: null,
    homeRunsAllowed: null,
    runsAllowed: null,
    earnedRuns: null,
    opponentAvg: null,
  };
}

function createPitcherCareerStat(playerId: string, careerRow: ParsedPlayerSummaryPitcherRow["careerStats"][number]): PlayerCareerStat {
  return {
    playerCareerStatId: buildCareerStatId(playerId, "pitcher", careerRow.year, careerRow.teamName),
    playerId,
    year: careerRow.year,
    teamLabel: careerRow.teamName,
    statType: "pitcher",
    games: careerRow.games,
    plateAppearances: null,
    battingAverage: null,
    atBats: null,
    runs: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    stolenBases: null,
    walks: careerRow.walks,
    onBasePct: null,
    sluggingPct: null,
    ops: null,
    era: careerRow.era,
    inningsPitched: careerRow.inningsPitched,
    strikeouts: careerRow.strikeouts,
    saves: careerRow.saves,
    wins: careerRow.wins,
    losses: careerRow.losses,
    holds: careerRow.holds,
    whip: null,
    hitsAllowed: careerRow.hitsAllowed,
    homeRunsAllowed: careerRow.homeRunsAllowed,
    runsAllowed: careerRow.runsAllowed,
    earnedRuns: careerRow.earnedRuns,
    opponentAvg: null,
  };
}

export function normalizePlayerCareerStats({
  seasonId,
  sourceId,
  hitters,
  pitchers,
  registerRows,
  searchRows = [],
  bundle,
  patches,
  sourceRefs,
}: NormalizePlayerCareerStatsArgs) {
  const rows: PlayerCareerStat[] = [];
  const registerLookup = buildOfficialRegisterLookup(registerRows, seasonId, bundle, patches);
  const searchLookup = buildOfficialPlayerSearchLookup(searchRows);

  for (const row of hitters) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      searchLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    for (const careerRow of row.careerStats) {
      rows.push(createHitterCareerStat(identity.player.playerId, careerRow));
    }
  }

  for (const row of pitchers) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      searchLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }

    for (const careerRow of row.careerStats) {
      rows.push(createPitcherCareerStat(identity.player.playerId, careerRow));
    }
  }

  const dedupedRows = Array.from(
    new Map(rows.map((row) => [row.playerCareerStatId, row] as const)).values(),
  );

  return normalizedPlayerCareerStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: sourceRefs,
    rows: dedupedRows,
  });
}
