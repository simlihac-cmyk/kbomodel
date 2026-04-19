const KBO_TIMEZONE = "Asia/Seoul";

function formatInKboTimezone(
  input: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KBO_TIMEZONE,
    ...options,
  }).format(new Date(input));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPct(value: number): string {
  return value.toFixed(3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type RecentFormSummary = {
  label: "매우좋음" | "좋음" | "보통" | "나쁨" | "매우나쁨";
  variant: "very-positive" | "positive" | "neutral" | "negative" | "very-negative";
  tone: "positive" | "neutral" | "negative";
};

export type ScheduleDifficultySummary = {
  label: "쉬움" | "보통" | "어려움";
  score: number;
  tone: "positive" | "neutral" | "negative";
};

export function describeRecentForm(value: number): RecentFormSummary {
  if (value >= 0.05) {
    return { label: "매우좋음", variant: "very-positive", tone: "positive" };
  }
  if (value >= 0.03) {
    return { label: "좋음", variant: "positive", tone: "positive" };
  }
  if (value <= -0.06) {
    return { label: "매우나쁨", variant: "very-negative", tone: "negative" };
  }
  if (value <= -0.04) {
    return { label: "나쁨", variant: "negative", tone: "negative" };
  }
  return { label: "보통", variant: "neutral", tone: "neutral" };
}

export function describeScheduleDifficulty(
  value: number,
  contextValues?: number[],
  remainingGamesCount?: number,
): ScheduleDifficultySummary {
  const center =
    contextValues && contextValues.length > 0
      ? contextValues.reduce((sum, item) => sum + item, 0) / contextValues.length
      : 100.25;
  const remainingScheduleFactor =
    remainingGamesCount && remainingGamesCount > 0
      ? remainingGamesCount / (remainingGamesCount + 18)
      : 0.7;
  const amplitude = 2.6 + remainingScheduleFactor * 1.6;
  // Use the current season's center as the midpoint, but flatten the tails when only a handful
  // of games remain so late-season extremes do not instantly collapse to 0 or 12.
  const score = Number(
    clamp(
      5.5 + Math.tanh((value - center) * 2.6) * amplitude,
      0,
      12,
    ).toFixed(1),
  );

  if (score <= 3) {
    return { label: "쉬움", score, tone: "positive" };
  }
  if (score >= 8) {
    return { label: "어려움", score, tone: "negative" };
  }
  return { label: "보통", score, tone: "neutral" };
}

export function formatSignedPercentPoint(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%p`;
}

export function formatGamesBack(value: number): string {
  return value === 0 ? "-" : value.toFixed(1);
}

export function formatDateLabel(input: string): string {
  return formatInKboTimezone(input, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

export function formatDateOnlyLabel(input: string): string {
  return formatInKboTimezone(input, {
    month: "numeric",
    day: "numeric",
  });
}

export function formatDateTimeLabel(input: string): string {
  return formatInKboTimezone(input, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTimeInputValue(input: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KBO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(input))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", string>;
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour;
  const minute = parts.minute;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function parseDateTimeInputValue(input: string): string {
  return new Date(`${input}:00+09:00`).toISOString();
}

export function formatRecordLabel(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}
