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
        description="이 앱의 예측기는 black box가 아니라, prior와 current를 어떻게 섞는지와 남은 시리즈가 왜 중요한지를 사람이 읽는 문장으로 설명하는 KBO 전용 모델입니다."
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

        <SectionCard title="선발 / 불펜 / 최근 폼" subtitle="단일 rating 하나로 뭉개지지 않도록 축을 분리했습니다.">
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>운영 모델의 코어는 과거 데이터와 같은 축으로 맞췄습니다. 현재 승률, 득실차, 최근 10경기, 홈/원정 편차, 남은 일정 난도를 바탕으로 offenseRating, starterRating, bullpenRating을 만듭니다.</p>
            <p>최근 10경기 흐름과 streak는 recent form adjustment에만 작은 폭으로 넣어, 단기 흐름이 시즌 전체 전력을 과하게 덮지 않도록 설계했습니다.</p>
            <p>공식 선수 시즌 스탯과 최근 로스터 이벤트는 이제 코어 모델을 바꾸는 주재료가 아니라 얇은 overlay로만 반영합니다. 그래서 과거 학습으로 맞춘 계수를 운영 모델에 더 자연스럽게 연결할 수 있습니다.</p>
            <p>개별 경기 승률은 이 공통 rating들을 점수 기대값으로 바꾼 뒤 계산하고, 남은 경기에서는 최근 pitcher game log와 휴식일 간격으로 추정한 likely starter turn을 경기 단위 추가 보정으로만 사용합니다.</p>
            <p>불펜 쪽도 코어는 팀 상태 기반으로 보고, reliever 시즌 스탯이나 최근 usage는 후반 이닝 안정성을 흔드는 보조 신호로만 덧입힙니다.</p>
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
