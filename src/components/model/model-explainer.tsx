import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";

type ModelExplainerProps = {
  data: NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
};

export function ModelExplainer({ data }: ModelExplainerProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="모델 설명"
        title="이 모델이 무엇을 반영하는가"
        description="이 앱의 승률은 학습된 black box가 아니라, 전년도 기준점과 현재 시즌 흐름을 규칙 기반으로 섞어 계산하는 KBO 전용 모델입니다."
        actions={
          <Link href={`/season/${data.season.year}/scenario`} className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
            경우의 수 계산기로 가기
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Prior와 Current를 어떻게 섞는가" subtitle="시즌 초반 uncertainty가 큰 이유를 설명합니다.">
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>시즌 초반에는 표본이 작기 때문에 전 시즌 성적과 프리시즌 priors 비중이 큽니다.</p>
            <p>현재 성적 비중은 단순 게임 수가 아니라 시즌 진행률 곡선을 같이 써서 올립니다. 그래서 시즌 10% 구간에서는 순위표를 곧바로 실력 확정으로 보지 않게 설계했습니다.</p>
            <p>표본이 작은 팀은 confidence score가 더 낮아지고, 경기 확률을 계산할 때 rating 차이를 리그 평균 쪽으로 강하게 수축해 초반 과신을 줄입니다.</p>
          </div>
        </SectionCard>

        <SectionCard title="전력과 경기 확률" subtitle="단일 rating 하나로 뭉개지지 않도록 축을 분리했습니다.">
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>코어 전력은 현재 승률, 최근 10경기, 경기당 득점과 실점, 홈/원정 성향을 바탕으로 offenseRating, starterRating, bullpenRating으로 나눠 만듭니다.</p>
            <p>최근 10경기 흐름과 streak는 작은 recent form 보정으로만 넣어, 단기 분위기가 시즌 전체 전력을 과하게 덮지 않게 했습니다.</p>
            <p>개별 경기 승률은 이 공통 rating들을 기대 득점으로 바꾼 뒤 승/무/패 확률로 계산합니다. 예상 선발이나 최근 불펜 usage는 있더라도 경기 단위 보조 신호로만 얹습니다.</p>
            <p>별도의 학습 기반 승률 보정은 쓰지 않고, 대신 Elo와 휴식일 같은 사실 기반 신호로 픽 confidence만 따로 계산합니다.</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="남은 경기와 시나리오" subtitle="시리즈 단위 override가 필요한 이유입니다.">
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>정규시즌 KBO는 720경기라서 모든 남은 경기를 하나씩 누르는 UX가 금방 무너집니다.</p>
            <p>그래서 기본 입력 단위를 Game이 아니라 Series로 두고, 홈 위닝시리즈 / 원정 위닝시리즈 / 스윕 / 모델대로 같은 빠른 모드를 제공합니다.</p>
            <p>시즌 시뮬레이션은 경기 확률에서 먼저 결과를 뽑고, 같은 기대 득점 분포에서 점수도 함께 생성해 순위와 득실 데이터가 서로 어긋나지 않게 맞춥니다.</p>
          </div>
        </SectionCard>

        <SectionCard title="설명 가능한 payload" subtitle="숫자 옆에 붙는 문장형 설명의 근거입니다.">
          <div className="space-y-3">
            {data.simulation.teamStrengths.slice(0, 4).map((team) => (
              <div key={team.seasonTeamId} className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4">
                <p className="font-medium text-ink">{data.displayById[team.seasonTeamId].shortNameKo}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {team.explanationReasons.map((reason) => (
                    <li key={reason.key}>{reason.sentence}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
