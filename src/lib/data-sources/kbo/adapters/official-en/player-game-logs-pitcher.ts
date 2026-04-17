import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerGameLogPitcherRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parsePcode(html: string) {
  const match = html.match(/gamelogs\.aspx\?pcode=(\d+)/i);
  return match?.[1] ?? "unknown";
}

function monthToNumber(label: string) {
  const months: Record<string, string> = {
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
  };
  return months[label.toUpperCase()] ?? "01";
}

function parseProfileMap($: ReturnType<typeof loadHtml>) {
  const profile = new Map<string, string>();
  $("div.player_detail li").each((_, item) => {
    const label = textOrNull($(item).find("b").text());
    const value = textOrNull($(item).text().replace($(item).find("b").text(), "").replace(":", ""));
    if (label && value) {
      profile.set(label.toLowerCase(), value);
    }
  });
  return profile;
}

function parseTeamName($: ReturnType<typeof loadHtml>) {
  const teamInfo = textOrNull($("span.team-info").first().text());
  return teamInfo?.split(/\s+/)[0] ?? "Unknown";
}

function parseDateDdMmYyyy(value: string | null) {
  if (!value) {
    return null;
  }
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return null;
  }
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseDebutYear(value: string | null) {
  const match = value?.match(/^(\d{2})/);
  if (!match) {
    return 0;
  }
  return 2000 + Number.parseInt(match[1] ?? "0", 10);
}

function parseInnings(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }
  const mixed = normalized.match(/^(\d+)\s+(\d)\/3$/);
  if (mixed) {
    return Number.parseInt(mixed[1] ?? "0", 10) + Number.parseInt(mixed[2] ?? "0", 10) / 3;
  }
  return parseFloatNumber(normalized) ?? 0;
}

export function parseOfficialEnPlayerGameLogsPitcher(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);
  const rows: ReturnType<typeof parsedPlayerGameLogPitcherRowSchema.parse>[] = [];

  $("div.tbl_common table[summary='Game logs']").each((_, tableElement) => {
    const table = $(tableElement);
    const monthLabel = textOrNull(table.find("thead th span").first().text()) ?? "";
    const month = monthToNumber(monthLabel);

    table.find("tbody tr").each((__, rowElement) => {
      const row = $(rowElement);
      const dayLabel = textOrNull(row.find("td[title='DATE']").text());
      if (!dayLabel) {
        return;
      }

      rows.push(
        parsedPlayerGameLogPitcherRowSchema.parse({
          pcode,
          teamName,
          playerNameEn: profile.get("name") ?? "Unknown",
          position: profile.get("position") ?? "Pitcher",
          backNumber: profile.get("no") ?? null,
          birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
          debutYear: parseDebutYear(profile.get("debut") ?? null),
          date: `${month}-${dayLabel.replace(".", "-")}`,
          opponentTeamName: textOrNull(row.find("td[title='OPP']").text()) ?? "Unknown",
          era: parseFloatNumber(textOrNull(row.find("td[title='ERA']").text())) ?? 0,
          result: textOrNull(row.find("td[title='RES']").text()),
          plateAppearances: parseInteger(textOrNull(row.find("td[title='PA']").text())) ?? 0,
          inningsPitched: parseInnings(textOrNull(row.find("td[title='IP']").text())),
          hitsAllowed: parseInteger(textOrNull(row.find("td[title='H']").text())) ?? 0,
          homeRunsAllowed: parseInteger(textOrNull(row.find("td[title='HR']").text())) ?? 0,
          walks: parseInteger(textOrNull(row.find("td[title='BB']").text())) ?? 0,
          hitByPitch: parseInteger(textOrNull(row.find("td[title='HBP']").text())) ?? 0,
          strikeouts: parseInteger(textOrNull(row.find("td[title='K']").text())) ?? 0,
          runsAllowed: parseInteger(textOrNull(row.find("td[title='R']").text())) ?? 0,
          earnedRuns: parseInteger(textOrNull(row.find("td[title='ER']").text())) ?? 0,
          opponentAvg: parseFloatNumber(textOrNull(row.find("td[title='OAVG']").text())) ?? 0,
        }),
      );
    });
  });

  return rows;
}
