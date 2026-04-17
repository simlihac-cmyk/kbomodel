import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { Season, TeamBrand, Venue } from "@/lib/domain/kbo/types";

type AdminHomeProps = {
  seasons: Season[];
  teamBrands: TeamBrand[];
  venues: Venue[];
};

export function AdminHome({ seasons, teamBrands, venues }: AdminHomeProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="관리자 홈"
        description="초기 버전은 file-backed adapter와 manual patch 구조로 운영합니다. 이후 DB 저장소로 넘어갈 때도 같은 repository contract를 유지하는 것을 목표로 했습니다."
        actions={<AdminNav />}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <SectionCard title="시즌 메타데이터" subtitle="season, ruleset, phase 편집의 출발점입니다.">
          <p className="text-3xl font-semibold text-ink">{seasons.length}</p>
          <p className="mt-2 text-sm text-muted">등록된 시즌 수</p>
        </SectionCard>
        <SectionCard title="브랜드 / 팀" subtitle="Franchise와 TeamBrand를 분리해 관리합니다.">
          <p className="text-3xl font-semibold text-ink">{teamBrands.length}</p>
          <p className="mt-2 text-sm text-muted">등록된 브랜드 수</p>
        </SectionCard>
        <SectionCard title="구장" subtitle="구장 정보와 홈팀 연결 상태를 관리합니다.">
          <p className="text-3xl font-semibold text-ink">{venues.length}</p>
          <p className="mt-2 text-sm text-muted">등록된 구장 수</p>
        </SectionCard>
      </div>
    </div>
  );
}
