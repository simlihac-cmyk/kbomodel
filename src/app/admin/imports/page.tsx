import fs from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";

import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import {
  buildImportCandidatesFromImport,
  buildImportCandidateSeriesSuggestions,
  buildImportPreview,
  buildSchedulePatchesFromImport,
  parseRawImportPayload,
} from "@/lib/admin/import-preview";
import { requireAdminSession } from "@/lib/auth/server";
import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";
import { importCandidateBundleSchema } from "@/lib/domain/kbo/schemas";
import { formatDateTimeLabel } from "@/lib/utils/format";
import { kboRepository } from "@/lib/repositories/kbo";
import { revalidateKboPublicPaths } from "@/lib/server/revalidate-kbo-paths";

const RAW_IMPORT_DIR = path.join(process.cwd(), "data", "kbo", "raw");
const IMPORT_CANDIDATES_PATH = path.join(process.cwd(), "data", "kbo", "import-candidates.json");
const DEFAULT_RAW_IMPORT_FILE = "manual-import-preview.json";

async function listRawImportFiles() {
  const entries = await fs.readdir(RAW_IMPORT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function resolveRawImportPath(fileName: string) {
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("잘못된 raw import 파일 경로입니다.");
  }
  return path.join(RAW_IMPORT_DIR, fileName);
}

async function readImportCandidates() {
  const raw = await fs.readFile(IMPORT_CANDIDATES_PATH, "utf8");
  return importCandidateBundleSchema.parse(JSON.parse(raw) as unknown);
}

async function writeImportCandidates(rows: Awaited<ReturnType<typeof readImportCandidates>>["rows"]) {
  const nextBundle = {
    updatedAt: new Date().toISOString(),
    rows,
  };
  await fs.writeFile(IMPORT_CANDIDATES_PATH, `${JSON.stringify(nextBundle, null, 2)}\n`, "utf8");
  return nextBundle;
}

async function applyImportPreviewAsSchedulePatches(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const fileName = String(formData.get("fileName") ?? DEFAULT_RAW_IMPORT_FILE);
  const currentSeason = await kboRepository.getCurrentSeason();
  const [bundle, rawImport, seasonContext] = await Promise.all([
    kboRepository.getBundle(),
    fs.readFile(resolveRawImportPath(fileName), "utf8"),
    kboRepository.getSeasonContext(currentSeason.year),
  ]);
  const raw = parseRawImportPayload(rawImport);
  const preview = buildImportPreview(raw, bundle);
  const updatedAt = new Date().toISOString();
  const patches = buildSchedulePatchesFromImport(raw, bundle, updatedAt);
  const gameById = Object.fromEntries((seasonContext?.games ?? []).map((game) => [game.gameId, game]));
  const displayById = Object.fromEntries(
    (seasonContext?.teamDisplays ?? []).map((team) => [team.seasonTeamId, team]),
  );

  if (patches.length > 0) {
    await Promise.all(patches.map((patch) => kboRepository.saveGameSchedulePatch(patch)));
  }

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "importPreview.applied",
    targetType: "import",
    targetId: raw.source,
    summary: `${raw.source} raw preview를 schedule patch ${patches.length}건으로 적용했습니다.`,
    ipAddress,
    metadata: {
      fileName,
      changedRows: preview.summary.changedRows,
      warningRows: preview.summary.warningRows,
      newRows: preview.summary.newRows,
      appliedRows: patches.length,
    },
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/audit");
  revalidateKboPublicPaths({
    years: [currentSeason.year],
    teamSlugs: patches.flatMap((patch) => {
      const game = gameById[patch.gameId];
      return [
        displayById[game?.homeSeasonTeamId ?? ""]?.teamSlug,
        displayById[game?.awaySeasonTeamId ?? ""]?.teamSlug,
      ].filter((teamSlug): teamSlug is string => Boolean(teamSlug));
    }),
    gameIds: patches.map((patch) => patch.gameId),
    includeArchiveHub: false,
  });
}

async function queueImportCandidates(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const fileName = String(formData.get("fileName") ?? DEFAULT_RAW_IMPORT_FILE);
  const [bundle, rawImport, currentCandidates] = await Promise.all([
    kboRepository.getBundle(),
    fs.readFile(resolveRawImportPath(fileName), "utf8"),
    readImportCandidates(),
  ]);
  const raw = parseRawImportPayload(rawImport);
  const updatedAt = new Date().toISOString();
  const candidates = buildImportCandidatesFromImport(raw, bundle, updatedAt);
  const dedupedRows = [
    ...currentCandidates.rows.filter(
      (row) => !candidates.some((candidate) => candidate.gameId === row.gameId),
    ),
    ...candidates,
  ];
  const nextBundle = {
    updatedAt,
    rows: dedupedRows,
  };
  await fs.writeFile(IMPORT_CANDIDATES_PATH, `${JSON.stringify(nextBundle, null, 2)}\n`, "utf8");

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "importCandidates.queued",
    targetType: "import",
    targetId: raw.source,
    summary: `${raw.source} raw preview의 new row ${candidates.length}건을 normalize 후보 큐에 저장했습니다.`,
    ipAddress,
    metadata: {
      fileName,
      queuedRows: candidates.length,
      totalRows: nextBundle.rows.length,
    },
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin/audit");
}

async function dismissImportCandidate(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const gameId = String(formData.get("gameId") ?? "");
  const fileName = String(formData.get("fileName") ?? DEFAULT_RAW_IMPORT_FILE);
  const currentCandidates = await readImportCandidates();
  const nextRows = currentCandidates.rows.filter((row) => row.gameId !== gameId);
  await writeImportCandidates(nextRows);

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "importCandidates.dismissed",
    targetType: "import",
    targetId: gameId,
    summary: `${gameId} normalize 후보를 큐에서 제거했습니다.`,
    ipAddress,
    metadata: {
      fileName,
      remainingRows: nextRows.length,
    },
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin/audit");
}

async function clearImportCandidatesBySource(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const source = String(formData.get("source") ?? "");
  const fileName = String(formData.get("fileName") ?? DEFAULT_RAW_IMPORT_FILE);
  const currentCandidates = await readImportCandidates();
  const nextRows = currentCandidates.rows.filter((row) => row.source !== source);
  const removedCount = currentCandidates.rows.length - nextRows.length;
  await writeImportCandidates(nextRows);

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "importCandidates.cleared",
    targetType: "import",
    targetId: source,
    summary: `${source} source의 normalize 후보 ${removedCount}건을 큐에서 비웠습니다.`,
    ipAddress,
    metadata: {
      fileName,
      removedCount,
      remainingRows: nextRows.length,
    },
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin/audit");
}

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ file?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawFiles = await listRawImportFiles();
  const selectedFile =
    resolvedSearchParams.file && rawFiles.includes(resolvedSearchParams.file)
      ? resolvedSearchParams.file
      : rawFiles.includes(DEFAULT_RAW_IMPORT_FILE)
        ? DEFAULT_RAW_IMPORT_FILE
        : rawFiles[0] ?? DEFAULT_RAW_IMPORT_FILE;
  const [bundle, rawImport, auditEntries, importCandidates] = await Promise.all([
    kboRepository.getBundle(),
    fs.readFile(resolveRawImportPath(selectedFile), "utf8"),
    listAuditLogEntries(),
    readImportCandidates(),
  ]);
  const raw = parseRawImportPayload(rawImport);
  const preview = buildImportPreview(raw, bundle);
  const seriesSuggestions = buildImportCandidateSeriesSuggestions(importCandidates.rows, bundle);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Imports"
        title="Import Preview / Diff"
        description="raw ingest 파일을 선택하고, changed row는 schedule patch로 적용하고 new row는 normalize 후보 큐로 분리하는 관리자 import 화면입니다."
        actions={<AdminNav />}
      />

      <SectionCard title="Raw 파일 선택" subtitle="여러 raw snapshot 중 현재 preview할 파일을 고릅니다.">
        <div className="flex flex-wrap gap-2">
          {rawFiles.map((fileName) => (
            <Link
              key={fileName}
              href={`/admin/imports?file=${encodeURIComponent(fileName)}`}
              className={`rounded-full px-3 py-1.5 text-sm ${
                fileName === selectedFile
                  ? "bg-accent text-white"
                  : "border border-line/80 bg-white text-muted"
              }`}
            >
              {fileName}
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">Raw rows</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{preview.summary.totalRows}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">Changed</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{preview.summary.changedRows}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">New</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{preview.summary.newRows}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">Warnings</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{preview.summary.warningRows}</p>
        </div>
        <div className="rounded-3xl border border-line/80 bg-white px-5 py-5">
          <p className="text-xs text-muted">Extracted</p>
          <p className="mt-2 text-sm font-medium text-ink">{formatDateTimeLabel(raw.extractedAt)}</p>
        </div>
      </div>

      <SectionCard
        title="적용 준비"
        subtitle="changed row는 schedule patch로 적용하고, new row는 normalize 후보 큐로 보냅니다."
        actions={
          <div className="flex flex-wrap gap-2">
            <form action={applyImportPreviewAsSchedulePatches}>
              <input type="hidden" name="fileName" value={selectedFile} />
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                changed row 적용
              </button>
            </form>
            <form action={queueImportCandidates}>
              <input type="hidden" name="fileName" value={selectedFile} />
              <button
                type="submit"
                className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm font-medium text-ink"
              >
                new row 후보 큐 저장
              </button>
            </form>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-muted">
            적용 대상 {preview.summary.changedRows}건
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-muted">
            warning {preview.summary.warningRows}건은 수동 확인 필요
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-muted">
            new row {preview.summary.newRows}건은 normalize 후보
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Raw ingest preview" subtitle={`${raw.source}에서 읽은 raw row입니다.`}>
          <div className="space-y-2">
            {raw.scheduleRows.map((row) => (
              <div key={row.gameId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{row.gameId}</p>
                  <span className="text-muted">{row.status}</span>
                </div>
                <p className="mt-2 text-muted">{formatDateTimeLabel(row.scheduledAt)}</p>
                <p className="mt-1 text-muted">
                  {row.awayTeamId} @ {row.homeTeamId} · {row.awayScore ?? "-"}:{row.homeScore ?? "-"}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Normalized diff preview" subtitle="raw row가 현재 normalized game에 어떤 영향을 줄지 먼저 보여 줍니다.">
          <div className="space-y-2">
            {preview.previewRows.map((row) => (
              <div
                key={`preview-${row.gameId}`}
                className={`rounded-2xl border px-4 py-4 text-sm ${
                  row.kind === "warning"
                    ? "border-orange-200 bg-orange-50"
                    : row.kind === "changed"
                      ? "border-sky-200 bg-sky-50"
                      : row.kind === "new"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-line/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{row.matchLabel}</p>
                  <span className="text-muted">{row.kind}</span>
                </div>
                <p className="mt-2 text-muted">
                  {formatDateTimeLabel(row.scheduledAt)} · {row.status} · {row.scoreLabel}
                </p>
                <p className="mt-1 text-muted">{row.note}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Normalize 후보 큐" subtitle="new row는 이 큐에 쌓아 두고 이후 normalize script 대상로 씁니다.">
          <div className="space-y-2">
            {importCandidates.rows.length > 0 ? (
              importCandidates.rows
                .slice()
                .sort((left, right) => right.importedAt.localeCompare(left.importedAt))
                .slice(0, 12)
                .map((row) => (
                  <div key={`${row.source}-${row.gameId}`} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{row.gameId}</p>
                        <p className="mt-1 text-muted">{row.source}</p>
                      </div>
                      <form action={dismissImportCandidate}>
                        <input type="hidden" name="gameId" value={row.gameId} />
                        <input type="hidden" name="fileName" value={selectedFile} />
                        <button
                          type="submit"
                          className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-warning"
                        >
                          제거
                        </button>
                      </form>
                    </div>
                    <p className="mt-2 text-muted">
                      {row.awayTeamId} @ {row.homeTeamId} · {formatDateTimeLabel(row.scheduledAt)}
                    </p>
                    <p className="mt-1 text-muted">{row.note}</p>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                아직 저장된 normalize 후보가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="운영자 체크포인트" subtitle="실제 import 전 먼저 보고 넘어가야 할 포인트입니다.">
          <div className="space-y-3">
            {preview.recommendations.map((line) => (
              <div key={line} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                {line}
              </div>
            ))}
            <div className="rounded-2xl border border-line/80 px-4 py-4 text-sm text-muted">
              다음 단계:
              raw snapshot 선택 → changed row patch 적용 → new row 후보 큐 저장 → normalize script에서 series/game 생성 여부 판단
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="시리즈 후보 묶음" subtitle="큐에 쌓인 new row를 잠정 series 단위로 묶어 normalize 판단을 돕습니다.">
        <div className="space-y-3">
          {seriesSuggestions.length > 0 ? (
            seriesSuggestions.map((series) => (
              <div key={series.seriesKey} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-ink">{series.matchLabel}</p>
                    <p className="mt-1 text-muted">
                      {formatDateTimeLabel(series.startDate)} ~ {formatDateTimeLabel(series.endDate)} · {series.gameIds.length}경기
                    </p>
                    <p className="mt-1 text-muted">{series.source}</p>
                  </div>
                  <form action={clearImportCandidatesBySource}>
                    <input type="hidden" name="source" value={series.source} />
                    <input type="hidden" name="fileName" value={selectedFile} />
                    <button
                      type="submit"
                      className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-xs text-muted"
                    >
                      source 비우기
                    </button>
                  </form>
                </div>
                <p className="mt-2 text-muted">
                  status {series.statuses.join(", ")} · {series.gameIds.join(", ")}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
              아직 series 후보로 묶을 normalize 큐가 없습니다.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="최근 import 운영 이력" subtitle="patch 적용과 후보 큐 저장 이력을 함께 남깁니다.">
        <div className="space-y-2">
          {auditEntries
            .filter(
              (entry) =>
                entry.action === "importPreview.applied" ||
                entry.action === "importCandidates.queued" ||
                entry.action === "importCandidates.dismissed" ||
                entry.action === "importCandidates.cleared",
            )
            .slice(0, 12)
            .map((entry) => (
              <div key={entry.auditLogId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                <p className="font-medium text-ink">{entry.summary}</p>
                <p className="mt-1 text-muted">
                  {entry.actorUsername} · {formatDateTimeLabel(entry.occurredAt)}
                </p>
              </div>
            ))}
        </div>
      </SectionCard>
    </div>
  );
}
