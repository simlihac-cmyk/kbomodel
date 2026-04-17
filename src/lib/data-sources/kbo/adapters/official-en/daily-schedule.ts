import { parsedScheduleRowSchema, type ParsedScheduleRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

function parseMonthContext(label: string | null) {
  const match = label?.match(/(\d{4})\.(\d{2})/);
  return {
    year: match?.[1] ?? "1970",
    month: match?.[2] ?? "01",
  };
}

function parseDate(year: string, fallbackMonth: string, rawDate: string | null) {
  const match = rawDate?.match(/(\d{2})\.(\d{2})/);
  if (!match) {
    return `${year}-${fallbackMonth}-01`;
  }
  return `${year}-${match[1]}-${match[2]}`;
}

function parseStatus(scoreText: string | null, note: string | null, gameTimeLabel: string | null): ParsedScheduleRow["status"] {
  const normalizedScore = scoreText?.toUpperCase() ?? "";
  const normalizedNote = note?.toUpperCase() ?? "";
  const normalizedTime = gameTimeLabel?.toUpperCase() ?? "";

  if (normalizedNote.includes("POSTPON") || normalizedNote.includes("CANCEL") || normalizedNote.includes("RAIN")) {
    return "postponed";
  }
  if (normalizedNote.includes("SUSPEND")) {
    return "suspended";
  }
  if (/^\d+\s*:\s*\d+$/.test(normalizedScore)) {
    return "final";
  }
  if (normalizedTime === "TBD") {
    return "tbd";
  }
  return "scheduled";
}

function parseScores(scoreText: string | null) {
  const match = scoreText?.match(/(\d+)\s*:\s*(\d+)/);
  if (!match) {
    return { awayScore: null, homeScore: null };
  }
  return {
    awayScore: Number.parseInt(match[1], 10),
    homeScore: Number.parseInt(match[2], 10),
  };
}

function buildSourceGameKey(args: {
  date: string;
  awayTeamName: string;
  homeTeamName: string;
  venueName: string;
  seen: Map<string, number>;
}) {
  const base = [
    args.date.replace(/-/g, ""),
    args.awayTeamName.replace(/\s+/g, "").toUpperCase(),
    args.homeTeamName.replace(/\s+/g, "").toUpperCase(),
    args.venueName.replace(/\s+/g, "").toUpperCase(),
  ].join("-");
  const count = (args.seen.get(base) ?? 0) + 1;
  args.seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

export function parseOfficialEnDailySchedule(html: string): ParsedScheduleRow[] {
  const $ = loadHtml(html);
  const rows: ParsedScheduleRow[] = [];
  const seenGameKeys = new Map<string, number>();
  const monthContext = parseMonthContext(textOrNull($("span[id$='lblGameMonth']").first().text()));

  let currentDateLabel: string | null = null;
  let currentTypeLabel: string | null = null;

  const targetRows =
    $("table[data-kbo-dataset='daily-schedule'] tbody tr").length > 0
      ? $("table[data-kbo-dataset='daily-schedule'] tbody tr")
      : $(".tbl_common table[summary='schdule'] tbody tr");

  targetRows.each((_, element) => {
    const row = $(element);
    const dateCell = textOrNull(row.find("td[title='DATE']").first().text());
    const typeCell = textOrNull(row.find("td[title='TYPE']").first().text());
    if (dateCell) {
      currentDateLabel = dateCell;
    }
    if (typeCell) {
      currentTypeLabel = typeCell;
    }

    const gameCells = row.find("td[title='GAME']");
    const awayTeamName = textOrNull(row.find("td.loop_r").first().text()) ?? textOrNull(gameCells.eq(0).text());
    const scoreText = textOrNull(gameCells.eq(1).text());
    const homeTeamName = textOrNull(row.find("td.loop_l").last().text()) ?? textOrNull(gameCells.eq(2).text());
    const venueName = textOrNull(row.find("td.LOCATION").text()) ?? "Unknown";
    const gameTimeLabel = textOrNull(row.find("td.TIME").text()) ?? "18:30";
    const note = textOrNull(row.find("td.ETC").text());

    if (!awayTeamName || !homeTeamName || !currentDateLabel || currentTypeLabel === "EXHIBITION") {
      return;
    }

    const date = parseDate(monthContext.year, monthContext.month, currentDateLabel);
    const status = parseStatus(scoreText, note, gameTimeLabel);
    const { awayScore, homeScore } = parseScores(scoreText);
    const sourceGameKey = buildSourceGameKey({
      date,
      awayTeamName,
      homeTeamName,
      venueName,
      seen: seenGameKeys,
    });

    rows.push(
      parsedScheduleRowSchema.parse({
        sourceGameKey,
        date,
        scheduledAt: `${date}T${/^\d{1,2}:\d{2}$/.test(gameTimeLabel) ? gameTimeLabel : "18:30"}:00+09:00`,
        gameTimeLabel,
        homeTeamName,
        awayTeamName,
        venueName,
        status,
        note: note === "-" ? null : note,
        detailPath: null,
        homeScore,
        awayScore,
        innings: null,
        isTie: status === "final" && homeScore !== null && awayScore !== null && homeScore === awayScore,
      }),
    );
  });

  return rows;
}
