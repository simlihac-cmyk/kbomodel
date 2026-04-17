import { MetricBadge } from "@/components/shared/metric-badge";

type SharedScenarioSpotlightProps = {
  scenarioName: string;
  teamLabel: string;
  targetLabel: string;
  currentProbabilityLabel: string;
  currentProbabilityTone: "neutral" | "positive" | "negative";
  baselineDeltaLabel: string;
  baselineDeltaTone: "neutral" | "positive" | "negative";
  expectedOutlookLabel: string;
  leverageLabel: string;
  modeLabel: string;
  raceFilterLabel?: string | null;
  overrideCount: number;
  shareLinkState: "idle" | "copied" | "failed";
  onCopyShareLink: () => void;
};

export function SharedScenarioSpotlight({
  scenarioName,
  teamLabel,
  targetLabel,
  currentProbabilityLabel,
  currentProbabilityTone,
  baselineDeltaLabel,
  baselineDeltaTone,
  expectedOutlookLabel,
  leverageLabel,
  modeLabel,
  raceFilterLabel,
  overrideCount,
  shareLinkState,
  onCopyShareLink,
}: SharedScenarioSpotlightProps) {
  const displayName = scenarioName.trim().length > 0 ? scenarioName : "공유된 시나리오";

  return (
    <section className="overflow-hidden rounded-[32px] border border-accent/20 bg-[linear-gradient(135deg,rgba(0,111,95,0.14),rgba(255,255,255,0.96)_42%,rgba(238,243,248,0.92))] shadow-panel">
      <div className="flex flex-col gap-6 px-5 py-5 lg:px-6 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Shared Scenario
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {teamLabel} {targetLabel} 공유 뷰
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
              <span className="font-medium text-ink">{displayName}</span> 시나리오를 기준으로
              핵심 결과를 먼저 모았습니다. 지금 이 링크에서 가장 먼저 봐야 할 값은{" "}
              <span className="font-medium text-ink">
                {teamLabel}의 {targetLabel} 확률
              </span>
              과 그 확률을 가장 크게 흔드는 카드입니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="metric-chip bg-white/90 text-accent">{displayName}</span>
              <span className="metric-chip bg-slate-100 text-ink">{modeLabel}</span>
              {raceFilterLabel ? (
                <span className="metric-chip bg-slate-100 text-ink">{raceFilterLabel}</span>
              ) : null}
              <span className="metric-chip bg-slate-100 text-ink">
                override {overrideCount}개
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <a
              href="#quick-calculator"
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              결과 카드 보기
            </a>
            <a
              href="#scenario-editor"
              className="rounded-full border border-line/80 bg-white/90 px-4 py-2 text-sm font-medium text-ink"
            >
              가정 편집 보기
            </a>
            <button
              type="button"
              onClick={onCopyShareLink}
              className="rounded-full border border-line/80 bg-white/90 px-4 py-2 text-sm font-medium text-ink"
            >
              {shareLinkState === "copied"
                ? "링크 복사됨"
                : shareLinkState === "failed"
                  ? "링크 복사 실패"
                  : "공유 링크 다시 복사"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <MetricBadge
            label={`현재 ${targetLabel} 확률`}
            value={currentProbabilityLabel}
            tone={currentProbabilityTone}
          />
          <MetricBadge
            label="공식 기준 대비"
            value={baselineDeltaLabel}
            tone={baselineDeltaTone}
          />
          <MetricBadge label="예상 판세" value={expectedOutlookLabel} />
          <MetricBadge label="가장 큰 swing" value={leverageLabel} />
        </div>
      </div>
    </section>
  );
}
