import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TeamBrandPatchForm } from "@/components/admin/team-brand-patch-form";
import { requireAdminSession } from "@/lib/auth/server";
import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";
import { kboRepository } from "@/lib/repositories/kbo";
import { revalidateKboPublicPaths } from "@/lib/server/revalidate-kbo-paths";
import { formatDateTimeLabel } from "@/lib/utils/format";

async function saveTeamBrandPatch(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  const brandId = String(formData.get("brandId") ?? "");
  const displayNameInput = String(formData.get("displayNameKo") ?? "").trim();
  const shortNameInput = String(formData.get("shortNameKo") ?? "").trim();
  const shortCodeInput = String(formData.get("shortCode") ?? "").trim();
  const primaryColorInput = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColorInput = String(formData.get("secondaryColor") ?? "").trim();
  const wordmarkInput = String(formData.get("wordmarkText") ?? "").trim();
  const bundle = await kboRepository.getBundle();
  const currentBrand = bundle.teamBrands.find((brand) => brand.brandId === brandId);
  const currentFranchise = bundle.franchises.find(
    (franchise) => franchise.franchiseId === currentBrand?.franchiseId,
  );
  const seasonYearById = new Map(bundle.seasons.map((season) => [season.seasonId, season.year]));
  const relatedYears = bundle.seasonTeams
    .filter((team) => team.brandId === brandId)
    .map((team) => seasonYearById.get(team.seasonId))
    .filter((year): year is number => year !== undefined);
  const displayNameKo = displayNameInput.length > 0 ? displayNameInput : currentBrand?.displayNameKo ?? "";
  const shortNameKo = shortNameInput.length > 0 ? shortNameInput : currentBrand?.shortNameKo ?? "";
  const shortCode = shortCodeInput.length > 0 ? shortCodeInput : currentBrand?.shortCode ?? "";
  const primaryColor = primaryColorInput.length > 0 ? primaryColorInput : currentBrand?.primaryColor ?? "";
  const secondaryColor = secondaryColorInput.length > 0 ? secondaryColorInput : currentBrand?.secondaryColor ?? "";
  const wordmarkText = wordmarkInput.length > 0 ? wordmarkInput : currentBrand?.wordmarkText ?? "";
  const updatedAt = new Date().toISOString();

  await kboRepository.saveTeamBrandPatch({
    brandId,
    displayNameKo,
    shortNameKo,
    shortCode,
    primaryColor,
    secondaryColor,
    wordmarkText,
    updatedAt,
  });

  await appendAuditLogEntry({
    actorUsername: session.username,
    actorRole: "admin",
    action: "teamBrandPatch.saved",
    targetType: "teamBrand",
    targetId: brandId,
    summary: `${brandId} 팀 브랜드 patch를 저장했습니다.`,
    ipAddress,
    metadata: {
      displayNameKo,
      shortNameKo,
      shortCode,
      primaryColor,
      secondaryColor,
      wordmarkText,
    },
  });

  revalidatePath("/admin/teams");
  revalidatePath("/admin/audit");
  revalidateKboPublicPaths({
    years: relatedYears,
    teamSlugs: currentFranchise ? [currentFranchise.slug] : [],
  });
}

export default async function AdminTeamsPage() {
  const [bundle, patches, auditEntries] = await Promise.all([
    kboRepository.getBundle(),
    kboRepository.getTeamBrandPatches(),
    listAuditLogEntries(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Teams"
        title="팀 / 브랜드 / 구장 편집"
        description="Franchise, TeamBrand, Venue 분리 구조는 유지하고, 초기 운영 단계에서는 TeamBrand 표시 정보를 patch로 보정합니다."
        actions={<AdminNav />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="브랜드 patch 저장" subtitle="표시 이름, 약칭, 코드, 컬러, 워드마크를 수동 보정합니다. 비워두면 현재 값이 유지됩니다.">
          <TeamBrandPatchForm action={saveTeamBrandPatch} teamBrands={bundle.teamBrands} />
        </SectionCard>

        <SectionCard title="현재 team brand patch 목록" subtitle="team-brand-patches.json에 저장된 보정입니다.">
          <div className="space-y-2">
            {patches.patches.length > 0 ? (
              patches.patches
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map((patch) => (
                  <div key={patch.brandId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">{patch.displayNameKo}</p>
                      <span className="text-muted">{patch.shortCode}</span>
                    </div>
                    <p className="mt-1 text-muted">
                      {patch.shortNameKo} · {patch.wordmarkText}
                    </p>
                    <p className="mt-1 text-muted">
                      {patch.primaryColor} / {patch.secondaryColor}
                    </p>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
                아직 저장된 팀 브랜드 patch가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="현재 Team Brands" subtitle="적용된 patch 기준 TeamBrand 목록입니다.">
        <div className="space-y-2">
          {bundle.teamBrands.map((brand) => (
            <div key={brand.brandId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full border border-line/80"
                    style={{ backgroundColor: brand.primaryColor }}
                  />
                  <p className="font-medium text-ink">{brand.displayNameKo}</p>
                </div>
                <span className="text-muted">{brand.shortCode}</span>
              </div>
              <p className="mt-2 text-muted">
                {brand.shortNameKo} · {brand.wordmarkText} · {brand.seasonStartYear} - {brand.seasonEndYear ?? "현재"}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="최근 팀 브랜드 수정 이력" subtitle="누가 어떤 브랜드 표시 정보를 바꿨는지 보여 줍니다.">
        <div className="space-y-2">
          {auditEntries
            .filter((entry) => entry.action === "teamBrandPatch.saved")
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
