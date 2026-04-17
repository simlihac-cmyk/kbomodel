import type { KboDataBundle } from "@/lib/domain/kbo/types";
import type {
  ManualSourcePatchBundle,
  NormalizedScoreboard,
  NormalizedSeriesGames,
  SourceId,
} from "@/lib/data-sources/kbo/dataset-types";

export function resolveSeasonTeamId(
  rawTeamName: string,
  sourceId: SourceId,
  seasonId: string,
  bundle: KboDataBundle,
  patches: ManualSourcePatchBundle,
) {
  const patchHit = patches.teamAliases.find(
    (item) =>
      item.alias.toLowerCase() === rawTeamName.toLowerCase() &&
      (!item.sourceId || item.sourceId === sourceId) &&
      (!item.seasonId || item.seasonId === seasonId),
  );
  if (patchHit) {
    return patchHit.seasonTeamId;
  }

  const seasonTeams = bundle.seasonTeams.filter((team) => team.seasonId === seasonId);
  for (const seasonTeam of seasonTeams) {
    const brand = bundle.teamBrands.find((item) => item.brandId === seasonTeam.brandId);
    if (!brand) {
      continue;
    }
    const candidates = [
      brand.displayNameKo,
      brand.shortNameKo,
      brand.shortCode,
      seasonTeam.franchiseId,
    ].map((value) => value.toLowerCase());
    if (candidates.includes(rawTeamName.toLowerCase())) {
      return seasonTeam.seasonTeamId;
    }
  }

  return null;
}

export function resolveVenueId(
  rawVenueName: string,
  sourceId: SourceId,
  bundle: KboDataBundle,
  patches: ManualSourcePatchBundle,
) {
  const patchHit = patches.venueAliases.find(
    (item) => item.alias.toLowerCase() === rawVenueName.toLowerCase() && (!item.sourceId || item.sourceId === sourceId),
  );
  if (patchHit) {
    return patchHit.venueId;
  }

  const venueHit = bundle.venues.find((venue) => venue.nameKo.toLowerCase() === rawVenueName.toLowerCase());
  return venueHit?.venueId ?? null;
}

export function applyManualPatchesToSeriesGames(
  payload: NormalizedSeriesGames,
  patches: ManualSourcePatchBundle,
) {
  const nextGames = payload.games.map((game) => {
    const patch = patches.gamePatches.find((item) => item.gameId === game.gameId);
    if (!patch) {
      return game;
    }
    return {
      ...game,
      status: patch.status ?? game.status,
      scheduledAt: patch.scheduledAt ?? game.scheduledAt,
      note: patch.note ?? game.note,
    };
  });

  return {
    ...payload,
    games: nextGames,
  };
}

export function applyManualPatchesToScoreboard(
  payload: NormalizedScoreboard,
  patches: ManualSourcePatchBundle,
) {
  const nextGames = payload.games.map((game) => {
    const patch = patches.gamePatches.find((item) => item.gameId === game.gameId);
    if (!patch) {
      return game;
    }
    return {
      ...game,
      status: patch.status ?? game.status,
      scheduledAt: patch.scheduledAt ?? game.scheduledAt,
      note: patch.note ?? game.note,
    };
  });

  return {
    ...payload,
    games: nextGames,
  };
}
