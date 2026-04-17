import { z } from "zod";

import type {
  Game,
  GameSchedulePatch,
  ImportCandidateRow,
  KboDataBundle,
} from "@/lib/domain/kbo/types";

const rawImportRowSchema = z.object({
  gameId: z.string(),
  scheduledAt: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
});

const rawImportPayloadSchema = z.object({
  source: z.string(),
  extractedAt: z.string(),
  scheduleRows: z.array(rawImportRowSchema),
});

export type RawImportPayload = z.infer<typeof rawImportPayloadSchema>;

export type ImportDiffKind = "new" | "changed" | "unchanged" | "warning";

export type PreviewRow = {
  gameId: string;
  matchedGameId: string | null;
  matchLabel: string;
  scheduledAt: string;
  status: string;
  scoreLabel: string;
  kind: ImportDiffKind;
  changedFields: string[];
  note: string;
};

function buildDisplayBySeasonTeamId(bundle: KboDataBundle) {
  const brandById = Object.fromEntries(bundle.teamBrands.map((item) => [item.brandId, item]));
  return Object.fromEntries(
    bundle.seasonTeams.map((seasonTeam) => [
      seasonTeam.seasonTeamId,
      brandById[seasonTeam.brandId]?.shortNameKo ?? seasonTeam.seasonTeamId,
    ]),
  );
}

type ImportSeriesSuggestion = {
  source: string;
  seriesKey: string;
  matchLabel: string;
  startDate: string;
  endDate: string;
  gameIds: string[];
  statuses: string[];
};

function scoreLabel(homeScore: number | null, awayScore: number | null) {
  return `${awayScore ?? "-"}:${homeScore ?? "-"}`;
}

function findChangedFields(rawRow: RawImportPayload["scheduleRows"][number], game: Game) {
  const changedFields: string[] = [];
  if (game.scheduledAt !== rawRow.scheduledAt) {
    changedFields.push("scheduledAt");
  }
  if (game.status !== rawRow.status) {
    changedFields.push("status");
  }
  if (game.homeScore !== rawRow.homeScore || game.awayScore !== rawRow.awayScore) {
    changedFields.push("score");
  }
  return changedFields;
}

function buildWarningNote(rawRow: RawImportPayload["scheduleRows"][number], game: Game | null) {
  if (!game) {
    return "현재 normalized bundle에 없는 새 경기입니다.";
  }
  if (rawRow.status === "final" && (rawRow.homeScore === null || rawRow.awayScore === null)) {
    return "final 경기인데 점수가 비어 있습니다.";
  }
  if (rawRow.homeTeamId !== game.homeSeasonTeamId || rawRow.awayTeamId !== game.awaySeasonTeamId) {
    return "team mapping이 기존 normalized game과 다릅니다.";
  }
  return "";
}

function resolveExistingGame(
  rawRow: RawImportPayload["scheduleRows"][number],
  bundle: KboDataBundle,
) {
  const exactMatch = bundle.games.find((game) => game.gameId === rawRow.gameId);
  if (exactMatch) {
    return exactMatch;
  }

  return (
    bundle.games.find(
      (game) =>
        game.scheduledAt === rawRow.scheduledAt &&
        game.homeSeasonTeamId === rawRow.homeTeamId &&
        game.awaySeasonTeamId === rawRow.awayTeamId,
    ) ?? null
  );
}

export function parseRawImportPayload(input: string): RawImportPayload {
  return rawImportPayloadSchema.parse(JSON.parse(input) as unknown);
}

export function buildImportPreview(raw: RawImportPayload, bundle: KboDataBundle) {
  const displayById = buildDisplayBySeasonTeamId(bundle);
  const previewRows: PreviewRow[] = raw.scheduleRows.map((row) => {
    const existing = resolveExistingGame(row, bundle);
    const changedFields = existing ? findChangedFields(row, existing) : [];
    const warningNote = buildWarningNote(row, existing);
    const kind: ImportDiffKind =
      warningNote
        ? existing
          ? "warning"
          : "new"
        : !existing
          ? "new"
          : changedFields.length > 0
            ? "changed"
            : "unchanged";

    return {
      gameId: row.gameId,
      matchedGameId: existing?.gameId ?? null,
      matchLabel: `${displayById[row.awayTeamId] ?? row.awayTeamId} @ ${displayById[row.homeTeamId] ?? row.homeTeamId}`,
      scheduledAt: row.scheduledAt,
      status: row.status,
      scoreLabel: scoreLabel(row.homeScore, row.awayScore),
      kind,
      changedFields,
      note:
        warningNote ||
        (changedFields.length > 0
          ? `${changedFields.join(", ")} 필드가 달라집니다.`
          : "기존 normalized game과 동일합니다."),
    };
  });

  const summary = {
    totalRows: previewRows.length,
    newRows: previewRows.filter((row) => row.kind === "new").length,
    changedRows: previewRows.filter((row) => row.kind === "changed").length,
    warningRows: previewRows.filter((row) => row.kind === "warning").length,
    unchangedRows: previewRows.filter((row) => row.kind === "unchanged").length,
    finalRows: raw.scheduleRows.filter((row) => row.status === "final").length,
  };

  const normalizedCounts = [
    { label: "Seasons", value: bundle.seasons.length },
    { label: "SeasonTeams", value: bundle.seasonTeams.length },
    { label: "Series", value: bundle.series.length },
    { label: "Games", value: bundle.games.length },
    { label: "Players", value: bundle.players.length },
  ];

  const recommendations = [
    summary.warningRows > 0
      ? "warning row가 있어 team mapping 또는 score completeness를 먼저 확인해야 합니다."
      : "warning row는 없습니다.",
    summary.changedRows > 0
      ? "기존 normalized game과 충돌하는 row가 있어 patch 또는 re-normalize 판단이 필요합니다."
      : "기존 normalized game을 직접 바꾸는 row는 없습니다.",
    summary.newRows > 0
      ? "새 경기 row는 schedule normalize 단계에서 series 연결 여부를 검토해야 합니다."
      : "모든 row가 기존 gameId와 매칭됩니다.",
  ];

  return {
    summary,
    previewRows,
    normalizedCounts,
    recommendations,
  };
}

export function buildSchedulePatchesFromImport(
  raw: RawImportPayload,
  bundle: KboDataBundle,
  timestamp: string,
): GameSchedulePatch[] {
  const preview = buildImportPreview(raw, bundle);

  return preview.previewRows
    .filter((row) => row.kind === "changed" && row.matchedGameId)
    .map((row) => {
      const rawRow = raw.scheduleRows.find((item) => item.gameId === row.gameId)!;
      const existingGame = bundle.games.find((game) => game.gameId === row.matchedGameId);

      return {
        gameId: row.matchedGameId!,
        status: rawRow.status,
        scheduledAt: rawRow.scheduledAt,
        note: existingGame?.note ?? null,
        homeScore: rawRow.homeScore,
        awayScore: rawRow.awayScore,
        updatedAt: timestamp,
      };
    });
}

export function buildImportCandidatesFromImport(
  raw: RawImportPayload,
  bundle: KboDataBundle,
  timestamp: string,
): ImportCandidateRow[] {
  const preview = buildImportPreview(raw, bundle);

  return preview.previewRows
    .filter((row) => row.kind === "new")
    .map((row) => {
      const rawRow = raw.scheduleRows.find((item) => item.gameId === row.gameId)!;
      return {
        source: raw.source,
        gameId: rawRow.gameId,
        scheduledAt: rawRow.scheduledAt,
        homeTeamId: rawRow.homeTeamId,
        awayTeamId: rawRow.awayTeamId,
        homeScore: rawRow.homeScore,
        awayScore: rawRow.awayScore,
        status: rawRow.status,
        note: "normalize candidate from admin import preview",
        importedAt: timestamp,
      };
    });
}

export function buildImportCandidateSeriesSuggestions(
  candidates: ImportCandidateRow[],
  bundle: KboDataBundle,
): ImportSeriesSuggestion[] {
  const displayById = buildDisplayBySeasonTeamId(bundle);
  const groups = new Map<string, ImportCandidateRow[]>();

  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.homeTeamId}:${candidate.awayTeamId}`;
    const current = groups.get(key) ?? [];
    current.push(candidate);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const sortedRows = rows
        .slice()
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
      const first = sortedRows[0];
      const last = sortedRows[sortedRows.length - 1];
      return {
        source: first.source,
        seriesKey: key,
        matchLabel: `${displayById[first.awayTeamId] ?? first.awayTeamId} @ ${displayById[first.homeTeamId] ?? first.homeTeamId}`,
        startDate: first.scheduledAt,
        endDate: last.scheduledAt,
        gameIds: sortedRows.map((row) => row.gameId),
        statuses: [...new Set(sortedRows.map((row) => row.status))],
      };
    })
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
}
