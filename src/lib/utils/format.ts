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
