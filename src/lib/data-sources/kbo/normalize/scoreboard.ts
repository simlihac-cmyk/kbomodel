import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedScoreboardSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedScoreboardRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import {
  applyManualPatchesToScoreboard,
  resolveSeasonTeamId,
  resolveVenueId,
} from "@/lib/data-sources/kbo/merge/apply-manual-patches";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";

type NormalizeScoreboardArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedScoreboardRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

function resolvePitcherId(bundle: KboDataBundle, playerName: string | null) {
  if (!playerName) {
    return null;
  }
  const hit = bundle.players.find(
    (player) => player.nameKo.toLowerCase() === playerName.toLowerCase() || player.nameEn.toLowerCase() === playerName.toLowerCase(),
  );
  return hit?.playerId ?? `unmapped-player:${slugifyFragment(playerName)}`;
}

export function normalizeScoreboard({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeScoreboardArgs) {
  const games = [];
  const boxScores = [];

  for (const row of rows) {
    const homeSeasonTeamId = resolveSeasonTeamId(row.homeTeamName, sourceId, seasonId, bundle, patches);
    const awaySeasonTeamId = resolveSeasonTeamId(row.awayTeamName, sourceId, seasonId, bundle, patches);
    const venueId = resolveVenueId(row.venueName, sourceId, bundle, patches);
    if (!homeSeasonTeamId || !awaySeasonTeamId || !venueId) {
      continue;
    }

    const gameId = `game:${sourceId}:${row.sourceGameKey}`;
    games.push({
      gameId,
      seasonId,
      seriesId: `series:${sourceId}:${row.date}:${homeSeasonTeamId}:${awaySeasonTeamId}`,
      homeSeasonTeamId,
      awaySeasonTeamId,
      scheduledAt: row.scheduledAt,
      status: row.status,
      originalScheduledAt: null,
      rescheduledFromGameId: null,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      innings: row.innings,
      isTie: row.isTie,
      note: row.note,
      attendance: row.attendance,
      externalLinks: row.detailPath
        ? [
            {
              label: "원문 경기 링크",
              url: row.detailPath.startsWith("http")
                ? row.detailPath
                : `https://eng.koreabaseball.com${row.detailPath}`,
            },
          ]
        : [],
    });

    boxScores.push({
      gameId,
      winningPitcherId: resolvePitcherId(bundle, row.winningPitcherName),
      losingPitcherId: resolvePitcherId(bundle, row.losingPitcherName),
      savePitcherId: resolvePitcherId(bundle, row.savePitcherName),
      lineScore: row.lineScore.map((line) => ({
        inning: line.inning,
        away: line.away,
        home: line.home,
      })),
      highlights: [],
    });
  }

  return normalizedScoreboardSchema.parse(
    applyManualPatchesToScoreboard(
      {
        generatedAt: new Date().toISOString(),
        seasonId,
        sources: [sourceRef],
        games,
        boxScores,
      },
      patches,
    ),
  );
}
