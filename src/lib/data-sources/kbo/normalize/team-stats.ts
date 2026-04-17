import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedTeamHitterStatsSchema,
  normalizedTeamPitcherStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedTeamHitterStatRow,
  type ParsedTeamPitcherStatRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number) {
  return Math.max(1, Math.round(value));
}

type NormalizeTeamHitterStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedTeamHitterStatRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

export function normalizeTeamHitterStats({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeTeamHitterStatsArgs) {
  const mappedRows = rows
    .map((row) => {
      const seasonTeamId = resolveSeasonTeamId(row.teamName, sourceId, seasonId, bundle, patches);
      if (!seasonTeamId) {
        return null;
      }

      return {
        seasonTeamId,
        ...row,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const leagueRunsPerGame = average(mappedRows.map((row) => row.runs / Math.max(row.games, 1)));
  const leagueAvg = average(mappedRows.map((row) => row.avg));

  return normalizedTeamHitterStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: [sourceRef],
    rows: mappedRows.map((row) => ({
      ...row,
      offensePlus: roundMetric(
        (((row.runs / Math.max(row.games, 1)) / Math.max(leagueRunsPerGame, 0.0001)) * 0.7 +
          (row.avg / Math.max(leagueAvg, 0.0001)) * 0.3) *
          100,
      ),
    })),
  });
}

type NormalizeTeamPitcherStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedTeamPitcherStatRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

export function normalizeTeamPitcherStats({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeTeamPitcherStatsArgs) {
  const mappedRows = rows
    .map((row) => {
      const seasonTeamId = resolveSeasonTeamId(row.teamName, sourceId, seasonId, bundle, patches);
      if (!seasonTeamId) {
        return null;
      }

      return {
        seasonTeamId,
        ...row,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const leagueEra = average(mappedRows.map((row) => row.era));
  const leagueRunsAllowedPerNine = average(
    mappedRows.map((row) => (row.runsAllowed / Math.max(row.inningsPitched, 0.0001)) * 9),
  );

  return normalizedTeamPitcherStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: [sourceRef],
    rows: mappedRows.map((row) => {
      const runsAllowedPerNine = (row.runsAllowed / Math.max(row.inningsPitched, 0.0001)) * 9;
      return {
        ...row,
        pitchingPlus: roundMetric(
          ((Math.max(leagueEra, 0.0001) / Math.max(row.era, 0.0001)) * 0.75 +
            (Math.max(leagueRunsAllowedPerNine, 0.0001) / Math.max(runsAllowedPerNine, 0.0001)) * 0.25) *
            100,
        ),
        // Until bullpen-only splits are available from official ingest, use team ERA as the closest official baseline.
        bullpenEra: row.era,
      };
    }),
  });
}

