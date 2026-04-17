import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AdminNav } from "@/components/shared/admin-nav";
import { requireAdminSession } from "@/lib/auth/server";
import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";
import { ManualAdjustmentForm } from "@/components/admin/manual-adjustment-form";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { kboRepository } from "@/lib/repositories/kbo";
import { revalidateKboPublicPaths } from "@/lib/server/revalidate-kbo-paths";
import { formatDateTimeLabel } from "@/lib/utils/format";

async function saveManualAdjustment(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const currentSeason = await kboRepository.getCurrentSeason();
  const seasonContext = await kboRepository.getSeasonContext(currentSeason.year);
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const offenseInput = String(formData.get("offenseDelta") ?? "").trim();
  const starterInput = String(formData.get("starterDelta") ?? "").trim();
  const bullpenInput = String(formData.get("bullpenDelta") ?? "").trim();
  const confidenceInput = String(formData.get("confidenceDelta") ?? "").trim();
  const noteInput = String(formData.get("note") ?? "").trim();
  const adjustmentBundle = await kboRepository.getManualAdjustments();
  const currentPatch = adjustmentBundle.patches.find((patch) => patch.seasonTeamId === seasonTeamId);
  const affectedTeamSlug = seasonContext?.teamDisplays.find(
    (team) => team.seasonTeamId === seasonTeamId,
  )?.teamSlug;
  const offenseDelta = offenseInput === "" ? currentPatch?.offenseDelta ?? 0 : Number(offenseInput);
  const starterDelta = starterInput === "" ? currentPatch?.starterDelta ?? 0 : Number(starterInput);
  const bullpenDelta = bullpenInput === "" ? currentPatch?.bullpenDelta ?? 0 : Number(bullpenInput);
  const confidenceDelta =
    confidenceInput === "" ? currentPatch?.confidenceDelta ?? 0 : Number(confidenceInput);
  const note = noteInput.length > 0 ? noteInput : currentPatch?.note ?? "";

  await kboRepository.saveManualAdjustment({
    seasonTeamId,
    offenseDelta,
    starterDelta,
    bullpenDelta,
    confidenceDelta,
    note,
    updatedAt: new Date().toISOString(),
  });

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "manualAdjustment.saved",
    targetType: "manualAdjustment",
    targetId: seasonTeamId,
    summary: `${seasonTeamId} 전력 보정을 저장했습니다.`,
    ipAddress,
    metadata: {
      offenseDelta,
      starterDelta,
      bullpenDelta,
      confidenceDelta,
      note,
    },
  });

  revalidatePath("/admin/manual-adjustments");
  revalidatePath("/admin/audit");
  revalidateKboPublicPaths({
    years: [currentSeason.year],
    teamSlugs: affectedTeamSlug ? [affectedTeamSlug] : [],
    includeArchiveHub: false,
  });
}

export default async function AdminManualAdjustmentsPage() {
  const [adjustments, currentSeason, auditEntries] = await Promise.all([
    kboRepository.getManualAdjustments(),
    kboRepository.getCurrentSeason(),
    listAuditLogEntries(),
  ]);
  const seasonContext = await kboRepository.getSeasonContext(currentSeason.year);

  if (!seasonContext) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Manual Adjustments"
        title="수동 전력 보정"
        description="dev 모드에서는 file-backed manual adjustment adapter를 통해 전력 보정을 저장합니다."
        actions={<AdminNav />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="새 보정 추가" subtitle="offense / starter / bullpen / confidence 수동 보정. 비워두면 현재 patch 값이 유지됩니다.">
          <ManualAdjustmentForm action={saveManualAdjustment} teamDisplays={seasonContext.teamDisplays} patches={adjustments.patches} />
        </SectionCard>

        <SectionCard title="현재 patch 목록" subtitle="manual-adjustments.json에 저장된 보정 값">
          <div className="space-y-2">
            {adjustments.patches.map((patch) => (
              <div key={patch.seasonTeamId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                <p className="font-medium text-ink">{patch.seasonTeamId}</p>
                <p className="mt-1 text-muted">
                  O {patch.offenseDelta}, S {patch.starterDelta}, B {patch.bullpenDelta}, C {patch.confidenceDelta}
                </p>
                <p className="mt-1 text-muted">{patch.note}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="최근 수정 이력" subtitle="누가 언제 어떤 수동 보정을 저장했는지 보여 줍니다.">
        <div className="space-y-2">
          {auditEntries
            .filter((entry) => entry.action === "manualAdjustment.saved")
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
