import type {
  BucketOdds,
  ExplanationReason,
  TeamStrengthSnapshot,
} from "@/lib/domain/kbo/types";

function directionFromValue(value: number): "positive" | "negative" | "neutral" {
  if (value > 0.1) {
    return "positive";
  }
  if (value < -0.1) {
    return "negative";
  }
  return "neutral";
}

export function buildStrengthReasons(snapshot: TeamStrengthSnapshot): ExplanationReason[] {
  return [
    {
      key: "prior-vs-current",
      label: "Prior 반영",
      direction: snapshot.currentWeight > snapshot.priorWeight ? "neutral" : "positive",
      magnitude: Number(Math.abs(snapshot.currentWeight - snapshot.priorWeight).toFixed(2)),
      sentence: `현재 성적 반영 비중은 ${(snapshot.currentWeight * 100).toFixed(0)}%, 프리시즌 prior 비중은 ${(snapshot.priorWeight * 100).toFixed(0)}%입니다.`,
    },
    {
      key: "recent-form",
      label: "최근 흐름",
      direction: directionFromValue(snapshot.recentFormAdjustment),
      magnitude: Number(Math.abs(snapshot.recentFormAdjustment).toFixed(2)),
      sentence:
        snapshot.recentFormAdjustment >= 0
          ? "최근 10경기 흐름이 기본 전력보다 약간 우상향으로 반영됐습니다."
          : "최근 10경기 흐름이 기본 전력을 조금 깎는 방향으로 반영됐습니다.",
    },
    {
      key: "schedule-difficulty",
      label: "잔여 일정 난이도",
      direction:
        snapshot.scheduleDifficulty < 99.8
          ? "positive"
          : snapshot.scheduleDifficulty > 100.2
            ? "negative"
            : "neutral",
      magnitude: Number(Math.abs(snapshot.scheduleDifficulty - 100).toFixed(2)),
      sentence:
        snapshot.scheduleDifficulty < 99.8
          ? "남은 상대 전력 평균이 비교적 낮아 일정이 조금 수월한 편입니다."
          : snapshot.scheduleDifficulty > 100.2
            ? "남은 상대 전력 평균이 비교적 높아 일정이 다소 빡빡합니다."
            : "남은 상대 전력 평균이 리그 중간권에 가까워 일정 난이도는 대체로 보통입니다.",
    },
  ];
}

export function explainBucketOdds(bucket: BucketOdds): string {
  const ps = 1 - bucket.missPostseason;
  if (bucket.first >= 0.3) {
    return `정규시즌 1위 확률이 ${(bucket.first * 100).toFixed(1)}%로 높게 유지되고 있습니다.`;
  }
  if (ps >= 0.6) {
    return `가을야구 진입 확률이 ${(ps * 100).toFixed(1)}%로 우세하지만 순위 변동 폭은 아직 큽니다.`;
  }
  return `현재로서는 탈락 확률 ${(bucket.missPostseason * 100).toFixed(1)}%가 더 높아 남은 맞대결 영향이 큽니다.`;
}
