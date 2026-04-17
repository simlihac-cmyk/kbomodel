import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedRosterEventsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedRosterMovementRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizeRosterEventsArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedRosterMovementRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

function resolvePlayerId(bundle: KboDataBundle, rawPlayerName: string) {
  const exact = bundle.players.find(
    (player) => player.nameKo.toLowerCase() === rawPlayerName.toLowerCase() || player.nameEn.toLowerCase() === rawPlayerName.toLowerCase(),
  );
  return exact?.playerId ?? `unmapped-player:${rawPlayerName}`;
}

export function normalizeRosterEvents({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeRosterEventsArgs) {
  return normalizedRosterEventsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: [sourceRef],
    events: rows
      .map((row) => {
        const seasonTeamId = resolveSeasonTeamId(row.teamName, sourceId, seasonId, bundle, patches);
        if (!seasonTeamId) {
          return null;
        }
        return {
          rosterEventId: `roster:${row.movementId}`,
          seasonId,
          playerId: resolvePlayerId(bundle, row.playerName),
          seasonTeamId,
          type: row.eventType,
          date: row.date,
          note: row.note,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  });
}
