import { parsedScoreboardRowSchema, type ParsedScoreboardRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

function cleanTeamName(value: string | null) {
  return value?.replace(/\d+$/g, "").trim() ?? "Unknown";
}

function parseScoreboardDate(label: string | null) {
  const match = label?.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) {
    return "1970-01-01";
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseVenueAndTime(value: string | null) {
  const match = value?.match(/^(.*?)(?:\s+(\d{1,2}:\d{2}))?$/);
  return {
    venueName: textOrNull(match?.[1]) ?? "Unknown",
    time: match?.[2] ?? null,
  };
}

function parseStatus(state: string | null): ParsedScoreboardRow["status"] {
  const normalized = state?.toUpperCase() ?? "";
  if (normalized === "FINAL") {
    return "final";
  }
  if (normalized.includes("POSTPON") || normalized.includes("CANCEL") || normalized.includes("RAIN")) {
    return "postponed";
  }
  if (normalized.includes("SUSPEND")) {
    return "suspended";
  }
  if (normalized === "TBD") {
    return "tbd";
  }
  return "scheduled";
}

function parsePitcherLabel(text: string | null, prefix: "W:" | "L:" | "S:") {
  if (!text) {
    return null;
  }
  return text.replace(prefix, "").trim() || null;
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

export function parseOfficialEnScoreboard(html: string): ParsedScoreboardRow[] {
  const $ = loadHtml(html);
  const rows: ParsedScoreboardRow[] = [];
  const seenGameKeys = new Map<string, number>();
  const pageDate = parseScoreboardDate(textOrNull($("input[id$='txtSearchDate']").first().val()?.toString() ?? null));

  const fixtureCards = $("section[data-kbo-dataset='scoreboard'] article[data-game-key]");
  if (fixtureCards.length > 0) {
    fixtureCards.each((_, element) => {
      const card = $(element);
      const date = textOrNull(card.attr("data-date")) ?? "1970-01-01";
      const time = textOrNull(card.attr("data-time")) ?? "18:30";
      const lineScore = card
        .find("table[data-role='linescore'] tbody tr")
        .map((__, rowElement) => {
          const row = $(rowElement);
          return {
            inning: parseInteger(row.find("[data-col='inning']").text()) ?? 0,
            away: parseInteger(row.find("[data-col='away']").text()) ?? 0,
            home: parseInteger(row.find("[data-col='home']").text()) ?? 0,
          };
        })
        .get()
        .filter((line) => line.inning > 0);

      const homeScore = parseInteger(card.find("[data-col='homeScore']").text());
      const awayScore = parseInteger(card.find("[data-col='awayScore']").text());

      rows.push(
        parsedScoreboardRowSchema.parse({
          sourceGameKey: textOrNull(card.attr("data-game-key")) ?? `${date}-${rows.length + 1}`,
          date,
          scheduledAt: `${date}T${time}:00+09:00`,
          gameTimeLabel: time,
          homeTeamName: cleanTeamName(textOrNull(card.find("[data-col='home']").text())),
          awayTeamName: cleanTeamName(textOrNull(card.find("[data-col='away']").text())),
          venueName: textOrNull(card.find("[data-col='venue']").text()) ?? "Unknown",
          status: card.attr("data-status") ?? "scheduled",
          note: textOrNull(card.find("[data-col='note']").text()),
          detailPath: textOrNull(card.find("[data-col='detail'] a").attr("href")),
          homeScore,
          awayScore,
          innings: parseInteger(card.find("[data-col='innings']").text()),
          isTie:
            homeScore !== null &&
            awayScore !== null &&
            homeScore === awayScore &&
            (card.attr("data-status") ?? "scheduled") === "final",
          lineScore,
          winningPitcherName: textOrNull(card.find("[data-col='winningPitcher']").text()),
          losingPitcherName: textOrNull(card.find("[data-col='losingPitcher']").text()),
          savePitcherName: textOrNull(card.find("[data-col='savePitcher']").text()),
          attendance: parseInteger(card.find("[data-col='attendance']").text()),
        }),
      );
    });
    return rows;
  }

  $(".scoreboard_time").each((index, element) => {
    const card = $(element);
    const local = card.nextAll(".scoreboard_local").first();
    const table = local.nextAll(".tbl_scoreboard, .tbl_common.tbl_scoreboard").first().find("table[summary='scoreboard']");
    const teamNames = card.find(".team_name");
    const teamScores = card.find(".team_score");
    const gameState = textOrNull(card.find(".timer").text()) ?? "18:30";
    const localInfo = parseVenueAndTime(textOrNull(local.find(".local_time").text()));
    const awayTeamName = cleanTeamName(textOrNull(teamNames.eq(0).text()));
    const homeTeamName = cleanTeamName(textOrNull(teamNames.eq(1).text()));
    const awayScore = parseInteger(teamScores.eq(0).text());
    const homeScore = parseInteger(teamScores.eq(1).text());
    const rowElements = table.find("tbody tr");
    const awayRow = rowElements.eq(0);
    const homeRow = rowElements.eq(1);
    const awayCells = awayRow.find("td");
    const homeCells = homeRow.find("td");
    const inningsCellCount = Math.max(0, awayCells.length - 4);
    const lineScore = [];

    for (let inning = 1; inning <= inningsCellCount; inning += 1) {
      const awayValue = parseInteger(awayCells.eq(inning - 1).text());
      const homeValue = parseInteger(homeCells.eq(inning - 1).text());
      if (awayValue === null && homeValue === null) {
        continue;
      }
      lineScore.push({
        inning,
        away: awayValue ?? 0,
        home: homeValue ?? 0,
      });
    }

    const sourceGameKey = buildSourceGameKey({
      date: pageDate,
      awayTeamName,
      homeTeamName,
      venueName: localInfo.venueName,
      seen: seenGameKeys,
    });

    rows.push(
      parsedScoreboardRowSchema.parse({
        sourceGameKey,
        date: pageDate,
        scheduledAt: `${pageDate}T${localInfo.time ?? "18:30"}:00+09:00`,
        gameTimeLabel: localInfo.time ?? gameState,
        homeTeamName,
        awayTeamName,
        venueName: localInfo.venueName,
        status: parseStatus(gameState),
        note: null,
        detailPath: null,
        homeScore,
        awayScore,
        innings: lineScore.at(-1)?.inning ?? null,
        isTie: homeScore !== null && awayScore !== null && homeScore === awayScore && parseStatus(gameState) === "final",
        lineScore,
        winningPitcherName: parsePitcherLabel(textOrNull(local.find(".local_w").text()), "W:"),
        losingPitcherName: parsePitcherLabel(textOrNull(local.find(".local_l").text()), "L:"),
        savePitcherName: parsePitcherLabel(textOrNull(local.find(".local_s").text()), "S:"),
        attendance: null,
      }),
    );
  });

  return rows;
}
