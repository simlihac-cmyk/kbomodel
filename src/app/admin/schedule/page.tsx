import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SchedulePatchForm } from "@/components/admin/schedule-patch-form";
import { requireAdminSession } from "@/lib/auth/server";
import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";
import type { GameStatus } from "@/lib/domain/kbo/types";
import { kboRepository } from "@/lib/repositories/kbo";
import { revalidateKboPublicPaths } from "@/lib/server/revalidate-kbo-paths";
import { formatDateTimeLabel, parseDateTimeInputValue } from "@/lib/utils/format";

async function saveGameSchedulePatch(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  const gameId = String(formData.get("gameId") ?? "");
  const currentSeason = await kboRepository.getCurrentSeason();
  const seasonContext = await kboRepository.getSeasonContext(currentSeason.year);
  const existingGame = seasonContext?.games.find((game) => game.gameId === gameId);
  const displayById = Object.fromEntries(
    (seasonContext?.teamDisplays ?? []).map((team) => [team.seasonTeamId, team]),
  );
  const statusInput = String(formData.get("status") ?? "").trim();
  const status = (statusInput.length > 0 ? statusInput : existingGame?.status ?? "scheduled") as GameStatus;
  const scheduledAtInput = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt =
    scheduledAtInput.length > 0
      ? parseDateTimeInputValue(scheduledAtInput)
      : existingGame?.scheduledAt || new Date().toISOString();
  const noteValue = String(formData.get("note") ?? "").trim();
  const homeScoreRaw = String(formData.get("homeScore") ?? "").trim();
  const awayScoreRaw = String(formData.get("awayScore") ?? "").trim();
  const homeScore = homeScoreRaw === "" ? existingGame?.homeScore ?? null : Number(homeScoreRaw);
  const awayScore = awayScoreRaw === "" ? existingGame?.awayScore ?? null : Number(awayScoreRaw);

  await kboRepository.saveGameSchedulePatch({
    gameId,
    status,
    scheduledAt,
    note: noteValue.length > 0 ? noteValue : existingGame?.note ?? null,
    homeScore,
    awayScore,
    updatedAt: new Date().toISOString(),
  });

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "schedulePatch.saved",
    targetType: "schedule",
    targetId: gameId,
    summary: `${gameId} 경기 상태 patch를 저장했습니다.`,
    ipAddress,
    metadata: {
      status,
      scheduledAt,
      homeScore,
      awayScore,
      note: noteValue || null,
    },
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/audit");
  revalidateKboPublicPaths({
    years: [currentSeason.year],
    teamSlugs: [
      displayById[existingGame?.homeSeasonTeamId ?? ""]?.teamSlug,
      displayById[existingGame?.awaySeasonTeamId ?? ""]?.teamSlug,
    ].filter((teamSlug): teamSlug is string => Boolean(teamSlug)),
    gameIds: gameId ? [gameId] : [],
    includeArchiveHub: false,
  });
}

export default async function AdminSchedulePage() {
  const currentSeason = await kboRepository.getCurrentSeason();
  const [seasonContext, schedulePatches, auditEntries] = await Promise.all([
    kboRepository.getSeasonContext(currentSeason.year),
    kboRepository.getSchedulePatches(),
    listAuditLogEntries(),
  ]);

  if (!seasonContext) {
    return null;
  }

  const displayById = Object.fromEntries(
    seasonContext.teamDisplays.map((team) => [team.seasonTeamId, team]),
  );
  const recentAndUpcomingGames = [...seasonContext.games]
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 24);
  const patchByGameId = Object.fromEntries(
    schedulePatches.patches.map((patch) => [patch.gameId, patch]),
  );
  const latestPatchedGameId = schedulePatches.patches
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.gameId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Schedule"
        title="일정 / 경기 상태 편집"
        description="Series와 Game을 분리한 구조를 유지하면서, dev 단계에서는 game patch를 파일에 저장해 운영 보정을 실험할 수 있게 했습니다."
        actions={<AdminNav />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="경기 patch 저장" subtitle="상태, 시간, 메모, 점수를 수동 보정합니다. 비워두면 현재 값이 유지됩니다.">
          <SchedulePatchForm
            action={saveGameSchedulePatch}
            games={recentAndUpcomingGames}
            teamDisplays={seasonContext.teamDisplays}
            initialGameId={latestPatchedGameId}
          />
        </SectionCard>

        <SectionCard title="현재 patch 목록" subtitle="schedule-patches.json에 저장된 경기 보정입니다.">
          <div className="space-y-2">
            {schedulePatches.patches.length > 0 ? (
              schedulePatches.patches
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map((patch) => (
                  <div key={patch.gameId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                    <p className="font-medium text-ink">{patch.gameId}</p>
                    <p className="mt-1 text-muted">
                      상태 {patch.status} · {formatDateTimeLabel(patch.scheduledAt)}
                    </p>
                    <p className="mt-1 text-muted">
                      점수 {patch.awayScore ?? "-"}:{patch.homeScore ?? "-"}
                    </p>
                    <p className="mt-1 text-muted">{patch.note ?? "메모 없음"}</p>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                아직 저장된 경기 patch가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="최근 경기 상태" subtitle="현재 시즌 최근/예정 경기와 적용된 patch를 같이 확인합니다.">
        <div className="space-y-2">
          {recentAndUpcomingGames.map((game) => (
            <div key={game.gameId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
              <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-medium text-ink">
                  {displayById[game.awaySeasonTeamId]?.shortNameKo} @ {displayById[game.homeSeasonTeamId]?.shortNameKo}
                </p>
                <p className="text-muted">{formatDateTimeLabel(game.scheduledAt)}</p>
              </div>
              <p className="mt-2 text-muted">
                상태 {game.status} · 스코어 {game.awayScore ?? "-"}:{game.homeScore ?? "-"}
              </p>
              <p className="mt-1 text-muted">
                patch {patchByGameId[game.gameId] ? "적용됨" : "없음"} · {game.note ?? "메모 없음"}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="최근 일정 수정 이력" subtitle="누가 어떤 경기 상태를 수정했는지 보여 줍니다.">
        <div className="space-y-2">
          {auditEntries
            .filter((entry) => entry.action === "schedulePatch.saved")
            .slice(0, 10)
            .map((entry) => (
              <div key={entry.auditLogId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                <p className="font-medium text-ink">{entry.summary}</p>
                <p className="mt-1 text-muted">
                  {entry.actorUsername} · {formatDateTimeLabel(entry.occurredAt)}
                </p>
                <p className="mt-1 text-muted">IP {entry.ipAddress ?? "-"}</p>
              </div>
            ))}
        </div>
      </SectionCard>
    </div>
  );
}
