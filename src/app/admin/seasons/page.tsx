import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SeasonPatchForm } from "@/components/admin/season-patch-form";
import { requireAdminSession } from "@/lib/auth/server";
import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";
import type { SeasonPhase, SeasonStatus } from "@/lib/domain/kbo/types";
import { kboRepository } from "@/lib/repositories/kbo";
import { revalidateKboPublicPaths } from "@/lib/server/revalidate-kbo-paths";
import { formatDateTimeLabel } from "@/lib/utils/format";

async function saveSeasonMetaPatch(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  const seasonId = String(formData.get("seasonId") ?? "");
  const labelInput = String(formData.get("label") ?? "").trim();
  const statusInput = String(formData.get("status") ?? "").trim();
  const phaseInput = String(formData.get("phase") ?? "").trim();
  const rulesetInput = String(formData.get("rulesetId") ?? "").trim();
  const bundle = await kboRepository.getBundle();
  const currentSeason = bundle.seasons.find((season) => season.seasonId === seasonId);
  const label = labelInput.length > 0 ? labelInput : currentSeason?.label ?? "";
  const status = (statusInput.length > 0 ? statusInput : currentSeason?.status ?? "ongoing") as SeasonStatus;
  const phase = (phaseInput.length > 0 ? phaseInput : currentSeason?.phase ?? "regular") as SeasonPhase;
  const rulesetId = rulesetInput.length > 0 ? rulesetInput : currentSeason?.rulesetId ?? "";
  const updatedAt = new Date().toISOString();

  await kboRepository.saveSeasonMetaPatch({
    seasonId,
    label,
    status,
    phase,
    rulesetId,
    updatedAt,
  });

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "seasonMetaPatch.saved",
    targetType: "season",
    targetId: seasonId,
    summary: `${seasonId} 시즌 메타 patch를 저장했습니다.`,
    ipAddress,
    metadata: {
      label,
      status,
      phase,
      rulesetId,
    },
  });

  revalidatePath("/admin/seasons");
  revalidatePath("/admin/audit");
  revalidateKboPublicPaths({
    years: currentSeason ? [currentSeason.year] : [],
  });
}

export default async function AdminSeasonsPage() {
  const [bundle, patches, auditEntries] = await Promise.all([
    kboRepository.getBundle(),
    kboRepository.getSeasonMetaPatches(),
    listAuditLogEntries(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Seasons"
        title="시즌 메타데이터 편집"
        description="기본 시즌 메타데이터는 유지한 채, label / status / phase / ruleset만 patch로 덮어씌우는 운영 레이어입니다."
        actions={<AdminNav />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="시즌 patch 저장" subtitle="현재는 시즌 메타데이터 중심으로 보정합니다. 비워두면 현재 값이 유지됩니다.">
          <SeasonPatchForm action={saveSeasonMetaPatch} seasons={bundle.seasons} rulesets={bundle.rulesets} />
        </SectionCard>

        <SectionCard title="현재 season patch 목록" subtitle="season-meta-patches.json에 저장된 보정입니다.">
          <div className="space-y-2">
            {patches.patches.length > 0 ? (
              patches.patches
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map((patch) => (
                  <div key={patch.seasonId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                    <p className="font-medium text-ink">{patch.seasonId}</p>
                    <p className="mt-1 text-muted">{patch.label}</p>
                    <p className="mt-1 text-muted">
                      {patch.status} · {patch.phase} · {patch.rulesetId}
                    </p>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                아직 저장된 시즌 patch가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="현재 시즌 메타데이터" subtitle="적용된 patch 기준 시즌 목록입니다.">
        <div className="space-y-2">
          {bundle.seasons.map((season) => (
            <div key={season.seasonId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-ink">
                  {season.year} · {season.label}
                </p>
                <span className="text-muted">{season.rulesetId}</span>
              </div>
              <p className="mt-2 text-muted">
                {season.status} · {season.phase}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="최근 시즌 수정 이력" subtitle="누가 어떤 시즌 메타를 바꿨는지 보여 줍니다.">
        <div className="space-y-2">
          {auditEntries
            .filter((entry) => entry.action === "seasonMetaPatch.saved")
            .slice(0, 10)
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
