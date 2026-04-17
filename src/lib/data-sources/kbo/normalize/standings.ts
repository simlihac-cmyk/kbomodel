import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedStandingsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedStandingsRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizeStandingsArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedStandingsRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

export function normalizeStandings({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeStandingsArgs) {
  return normalizedStandingsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: [sourceRef],
    rows: rows
      .map((row) => {
        const seasonTeamId = resolveSeasonTeamId(row.teamName, sourceId, seasonId, bundle, patches);
        if (!seasonTeamId) {
          return null;
        }
        return {
          seasonTeamId,
          rank: row.rank,
          games: row.games,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          winPct: row.winPct,
          gamesBehind: row.gamesBehind,
          last10: row.last10,
          streak: row.streak,
          homeRecord: row.homeRecord,
          awayRecord: row.awayRecord,
          runsScored: row.runsScored,
          runsAllowed: row.runsAllowed,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  });
}
