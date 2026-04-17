import { load } from "cheerio";

import { parseOfficialEnDailySchedule } from "@/lib/data-sources/kbo/adapters/official-en/daily-schedule";
import { parsedScheduleRowSchema, type ParsedScheduleRow } from "@/lib/data-sources/kbo/dataset-types";
import { textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

type ScheduleServiceCell = {
  Text: string | null;
  Class: string | null;
};

type ScheduleServiceRow = {
  row: ScheduleServiceCell[];
};

type ScheduleServiceResponse = {
  rows: ScheduleServiceRow[];
};

type CombinedScheduleServiceResponse = {
  seasonYear: number;
  months: Array<{
    month: string;
    rows: ScheduleServiceRow[];
  }>;
};

function parseDateLabel(label: string | null) {
  const match = label?.match(/(\d{2})\.(\d{2})/);
  return match ? { month: match[1], day: match[2] } : null;
}

function stripHtml(value: string | null) {
  return textOrNull(load(`<div>${value ?? ""}</div>`)("div").text());
}

function parsePlayCell(playHtml: string | null) {
  const $ = load(`<div>${playHtml ?? ""}</div>`);
  const teamSpans = $("div > span");
  const awayTeamName = textOrNull(teamSpans.first().text());
  const homeTeamName = textOrNull(teamSpans.last().text());
  const emSpans = $("em span")
    .map((_, element) => textOrNull($(element).text()))
    .get()
    .filter((value): value is string => value !== null);
  const numericParts = emSpans.filter((value) => /^\d+$/.test(value)).map((value) => Number.parseInt(value, 10));

  return {
    awayTeamName,
    homeTeamName,
    awayScore: numericParts.length >= 2 ? numericParts[0] : null,
    homeScore: numericParts.length >= 2 ? numericParts[1] : null,
  };
}

function parseStatus(note: string | null, awayScore: number | null, homeScore: number | null): ParsedScheduleRow["status"] {
  const normalizedNote = note ?? "";
  if (normalizedNote.includes("취소")) {
    return "postponed";
  }
  if (normalizedNote.includes("서스펜디드") || normalizedNote.toLowerCase().includes("suspend")) {
    return "suspended";
  }
  if (awayScore !== null && homeScore !== null) {
    return "final";
  }
  return "scheduled";
}

function extractGameId(reviewHtml: string | null) {
  const match = reviewHtml?.match(/gameId=([^&'"]+)/);
  return match?.[1] ?? null;
}

function parseScheduleServiceRows(payload: ScheduleServiceResponse, fallbackYear = "1970"): ParsedScheduleRow[] {
  const rows: ParsedScheduleRow[] = [];
  let currentYear = fallbackYear;
  let currentDateLabel: string | null = null;

  for (const serviceRow of payload.rows) {
    const cells = serviceRow.row;
    const firstText = stripHtml(cells[0]?.Text ?? null);
    if (firstText?.match(/^\d{2}\.\d{2}\(/)) {
      currentDateLabel = firstText;
    }

    const dateInfo = parseDateLabel(currentDateLabel);
    if (!dateInfo) {
      continue;
    }

    const offset = firstText?.match(/^\d{2}\.\d{2}\(/) ? 1 : 0;
    const timeText = stripHtml(cells[offset]?.Text ?? null) ?? "18:30";
    const playHtml = cells[offset + 1]?.Text ?? null;
    const reviewHtml = cells[offset + 2]?.Text ?? null;
    const venueName = stripHtml(cells.at(-2)?.Text ?? null) ?? "Unknown";
    const noteText = stripHtml(cells.at(-1)?.Text ?? null);
    const gameDateMatch = reviewHtml?.match(/gameDate=(\d{4})(\d{2})(\d{2})/);

    if (gameDateMatch) {
      currentYear = gameDateMatch[1];
    }

    const date = gameDateMatch
      ? `${gameDateMatch[1]}-${gameDateMatch[2]}-${gameDateMatch[3]}`
      : `${currentYear}-${dateInfo.month}-${dateInfo.day}`;
    const { awayTeamName, homeTeamName, awayScore, homeScore } = parsePlayCell(playHtml);
    if (!awayTeamName || !homeTeamName) {
      continue;
    }

    const sourceGameKey = extractGameId(reviewHtml) ?? `${date.replace(/-/g, "")}${awayTeamName}${homeTeamName}`;
    const status = parseStatus(noteText, awayScore, homeScore);

    rows.push(
      parsedScheduleRowSchema.parse({
        sourceGameKey,
        date,
        scheduledAt: `${date}T${timeText}:00+09:00`,
        gameTimeLabel: timeText,
        homeTeamName,
        awayTeamName,
        venueName,
        status,
        note: noteText === "-" ? null : noteText,
        detailPath: reviewHtml ? `https://www.koreabaseball.com${extractGameId(reviewHtml) ? reviewHtml.match(/href='([^']+)'/)?.[1] ?? "" : ""}` : null,
        homeScore,
        awayScore,
        innings: null,
        isTie: status === "final" && homeScore !== null && awayScore !== null && homeScore === awayScore,
      }),
    );
  }

  return rows;
}

export function parseOfficialKoSchedule(payload: string) {
  const trimmed = payload.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as ScheduleServiceResponse | CombinedScheduleServiceResponse;
    if ("months" in parsed) {
      return parsed.months.flatMap((item) => parseScheduleServiceRows({ rows: item.rows }, String(parsed.seasonYear)));
    }
    return parseScheduleServiceRows(parsed);
  }

  return parseOfficialEnDailySchedule(payload);
}
