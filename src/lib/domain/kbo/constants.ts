export const DEFAULT_SIMULATION_ITERATIONS = 1200;
export const DEFAULT_WORKER_DEBOUNCE_MS = 250;
export const KBO_POSTSEASON_CUTOFF = 5;
export const KBO_TEAM_COUNT = 10;
export const CURRENT_SIGNAL_SHRINKAGE_GAMES = 30;
export const RECENT_FORM_WINDOW = 10;
export const BASE_HOME_FIELD_ADVANTAGE = 0.18;

export const RANK_BUCKET_KEYS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "missPostseason",
] as const;

export const KBO_BUCKET_LABELS: Record<(typeof RANK_BUCKET_KEYS)[number], string> = {
  first: "1위",
  second: "2위",
  third: "3위",
  fourth: "4위",
  fifth: "5위",
  missPostseason: "탈락",
};

export const QUICK_SERIES_OUTCOME_LABELS = {
  model: "모델대로 두기",
  homeSeriesWin: "홈 위닝시리즈",
  awaySeriesWin: "원정 위닝시리즈",
  homeSweep: "홈 스윕",
  awaySweep: "원정 스윕",
} as const;

export const RACE_FILTERS = [
  { key: "first", label: "1위 레이스" },
  { key: "second", label: "2위 레이스" },
  { key: "fifth", label: "5위 레이스" },
  { key: "all", label: "전체" },
] as const;

export const TEAM_SLUGS = [
  "doosan-bears",
  "lg-twins",
  "kia-tigers",
  "samsung-lions",
  "lotte-giants",
  "hanwha-eagles",
  "kt-wiz",
  "nc-dinos",
  "ssg-landers",
  "kiwoom-heroes",
] as const;
