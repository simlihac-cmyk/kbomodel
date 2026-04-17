const DEFAULT_TIMEZONE = process.env.KBO_TIMEZONE ?? "Asia/Seoul";

function toParts(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  return Object.fromEntries(
    formatter.formatToParts(date).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]),
  ) as Record<string, string>;
}

export function getKboTimezone() {
  return DEFAULT_TIMEZONE;
}

export function getKboNow(date = new Date()) {
  const parts = toParts(date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    timeLabel: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function getKboDateKey(date = new Date()) {
  return getKboNow(date).isoDate;
}

export function isWithinHotWindow(date = new Date()) {
  const now = getKboNow(date);
  const minutes = now.hour * 60 + now.minute;
  return minutes >= 12 * 60 && minutes <= 23 * 60 + 58;
}

export function isAfterNightlyWindow(date = new Date()) {
  const now = getKboNow(date);
  return now.hour > 0 || (now.hour === 0 && now.minute >= 17);
}

export function isWeeklyColdSyncWindow(date = new Date()) {
  const now = getKboNow(date);
  return now.weekday === "Mon" && (now.hour > 4 || (now.hour === 4 && now.minute >= 11));
}
