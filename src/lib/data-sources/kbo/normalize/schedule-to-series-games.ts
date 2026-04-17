import type { KboDataBundle } from "@/lib/domain/kbo/types";
import type {
  ManualSourcePatchBundle,
  NormalizedSeriesGames,
  NormalizedSourceReference,
  ParsedScheduleRow,
  SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { normalizedSeriesGamesSchema } from "@/lib/data-sources/kbo/dataset-types";
import {
  applyManualPatchesToSeriesGames,
  resolveSeasonTeamId,
  resolveVenueId,
} from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizeScheduleToSeriesGamesArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedScheduleRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

function computeSeriesStatus(gameStatuses: ParsedScheduleRow["status"][]) {
  if (gameStatuses.every((status) => status === "final")) {
    return "final" as const;
  }
  if (gameStatuses.some((status) => status === "postponed")) {
    return "postponed" as const;
  }
  if (gameStatuses.some((status) => status === "final")) {
    return "in_progress" as const;
  }
  return "scheduled" as const;
}

function diffDays(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00+09:00`);
  const rightDate = new Date(`${right}T00:00:00+09:00`);
  return Math.abs((rightDate.getTime() - leftDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function normalizeScheduleToSeriesGames({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeScheduleToSeriesGamesArgs): NormalizedSeriesGames {
  const seasonRows = rows
    .slice()
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  const groupedByMatchup = new Map<
    string,
    Array<{
      seasonId: string;
      homeSeasonTeamId: string;
      awaySeasonTeamId: string;
      venueId: string;
      rows: ParsedScheduleRow[];
    }>
  >();

  for (const row of seasonRows) {
    const homeSeasonTeamId = resolveSeasonTeamId(row.homeTeamName, sourceId, seasonId, bundle, patches);
    const awaySeasonTeamId = resolveSeasonTeamId(row.awayTeamName, sourceId, seasonId, bundle, patches);
    const venueId = resolveVenueId(row.venueName, sourceId, bundle, patches);
    if (!homeSeasonTeamId || !awaySeasonTeamId || !venueId) {
      continue;
    }
    const matchupKey = [seasonId, homeSeasonTeamId, awaySeasonTeamId, venueId].join("|");
    const existingGroups = groupedByMatchup.get(matchupKey) ?? [];
    const lastGroup = existingGroups[existingGroups.length - 1];
    const lastRow = lastGroup?.rows.at(-1);
    const shouldAppend = lastRow && diffDays(lastRow.date, row.date) <= 1.5;

    if (shouldAppend) {
      lastGroup.rows.push(row);
    } else {
      existingGroups.push({
        seasonId,
        homeSeasonTeamId,
        awaySeasonTeamId,
        venueId,
        rows: [row],
      });
    }

    groupedByMatchup.set(matchupKey, existingGroups);
  }

  const grouped: Array<{
    seasonId: string;
    homeSeasonTeamId: string;
    awaySeasonTeamId: string;
    venueId: string;
    rows: ParsedScheduleRow[];
  }> = Array.from(groupedByMatchup.values()).flat();

  const series = [];
  const games = [];

  for (const group of grouped) {
    const { seasonId: resolvedSeasonId, homeSeasonTeamId, awaySeasonTeamId, venueId, rows: groupRows } = group;
    const sortedGroup = groupRows.slice().sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
    const seriesId = `series:${sourceId}:${sortedGroup[0]?.sourceGameKey ?? `${resolvedSeasonId}:${homeSeasonTeamId}:${awaySeasonTeamId}:${venueId}`}`;
    series.push({
      seriesId,
      seasonId: resolvedSeasonId,
      type: "regular" as const,
      homeSeasonTeamId,
      awaySeasonTeamId,
      plannedLength: sortedGroup.length,
      actualLength: sortedGroup.filter((row) => row.status === "final").length,
      startDate: sortedGroup[0]?.date ?? "",
      endDate: sortedGroup.at(-1)?.date ?? "",
      venueId,
      status: computeSeriesStatus(sortedGroup.map((row) => row.status)),
      importanceNote: undefined,
    });

    for (const row of sortedGroup) {
      games.push({
        gameId: `game:${sourceId}:${row.sourceGameKey}`,
        seasonId: resolvedSeasonId,
        seriesId,
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
        attendance: null,
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
    }
  }

  return normalizedSeriesGamesSchema.parse(
    applyManualPatchesToSeriesGames(
      {
        generatedAt: new Date().toISOString(),
        seasonId,
        sources: [sourceRef],
        series,
        games,
      },
      patches,
    ),
  );
}
