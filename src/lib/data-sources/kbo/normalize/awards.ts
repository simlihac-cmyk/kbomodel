import type { Award, KboDataBundle, Player } from "@/lib/domain/kbo/types";
import {
  normalizedAwardsSchema,
  type ManualSourcePatchBundle,
  type NormalizedAwards,
  type NormalizedSourceReference,
  type ParsedPlayerAwardRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizeAwardsArgs = {
  rows: ParsedPlayerAwardRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

function resolveAwardSeasonId(year: number, bundle: KboDataBundle) {
  return bundle.seasons.find((season) => season.year === year)?.seasonId ?? `archive-${year}`;
}

function resolveAwardSeasonTeamId(
  year: number,
  teamName: string,
  bundle: KboDataBundle,
  patches: ManualSourcePatchBundle,
) {
  const season = bundle.seasons.find((item) => item.year === year);
  if (!season) {
    return null;
  }
  return resolveSeasonTeamId(teamName, "official-kbo-ko", season.seasonId, bundle, patches);
}

function resolvePlayerByName(bundle: KboDataBundle, playerName: string, franchiseId: string | null): Player | null {
  const normalizedName = playerName.toLowerCase();
  const matches = bundle.players.filter((player) => {
    if (player.nameKo.toLowerCase() !== normalizedName) {
      return false;
    }
    return franchiseId ? player.franchiseIds.includes(franchiseId) : true;
  });

  if (matches.length === 1) {
    return matches[0] ?? null;
  }

  return franchiseId ? null : (matches[0] ?? null);
}

function buildAwardId(seasonId: string, label: string, playerName: string) {
  return `award:${seasonId}:${slugifyFragment(label)}:${slugifyFragment(playerName)}`;
}

export function normalizeAwards({ rows, bundle, patches, sourceRef }: NormalizeAwardsArgs) {
  const seasonTeamById = new Map(bundle.seasonTeams.map((item) => [item.seasonTeamId, item] as const));

  const awards = rows.map((row) => {
    const seasonId = resolveAwardSeasonId(row.year, bundle);
    const seasonTeamId = resolveAwardSeasonTeamId(row.year, row.teamName, bundle, patches);
    const franchiseId = seasonTeamId ? seasonTeamById.get(seasonTeamId)?.franchiseId ?? null : null;
    const player = resolvePlayerByName(bundle, row.playerName, franchiseId);

    return {
      awardId: buildAwardId(seasonId, row.awardLabel, row.playerName),
      seasonId,
      label: row.awardLabel,
      playerId: player?.playerId ?? null,
      seasonTeamId,
      note: `${row.playerName} · ${row.teamName} · ${row.position}`,
    } satisfies Award;
  });

  const dedupedAwards = Array.from(
    new Map(awards.map((award) => [award.awardId, award] as const)).values(),
  );

  return normalizedAwardsSchema.parse({
    generatedAt: new Date().toISOString(),
    sources: [sourceRef],
    awards: dedupedAwards,
  });
}

export function mergeNormalizedAwards(
  existing: NormalizedAwards | null,
  incoming: NormalizedAwards,
) {
  if (!existing) {
    return incoming;
  }

  const mergedSources = Array.from(
    new Map(
      [...existing.sources, ...incoming.sources].map((source) => [
        `${source.sourceId}:${source.datasetId}:${source.snapshotKey}:${source.parserVersion}`,
        source,
      ]),
    ).values(),
  );
  const mergedAwards = Array.from(
    new Map(
      [...existing.awards, ...incoming.awards].map((award) => [award.awardId, award] as const),
    ).values(),
  ).sort((left, right) => right.seasonId.localeCompare(left.seasonId) || left.label.localeCompare(right.label, "ko"));

  return normalizedAwardsSchema.parse({
    generatedAt: incoming.generatedAt,
    sources: mergedSources,
    awards: mergedAwards,
  });
}
