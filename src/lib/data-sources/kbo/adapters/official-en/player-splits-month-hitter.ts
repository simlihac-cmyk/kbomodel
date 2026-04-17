import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSplitMonthHitterRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parsePcode(html: string) {
  const match = html.match(/splitsmonth\.aspx\?pcode=(\d+)/i);
  return match?.[1] ?? "unknown";
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

export function parseOfficialEnPlayerSplitsMonthHitter(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);

  return $("div.tbl_common table[summary='month'] tbody tr")
    .toArray()
    .map((rowElement) => {
      const row = $(rowElement);
      return parsedPlayerSplitMonthHitterRowSchema.parse({
        pcode,
        teamName,
        playerNameEn: profile.get("name") ?? "Unknown",
        position: profile.get("position") ?? "Hitter",
        backNumber: profile.get("no") ?? null,
        birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
        debutYear: parseDebutYear(profile.get("debut") ?? null),
        monthKey: textOrNull(row.find("td[title='MONTH']").text()) ?? "UNK",
        games: parseInteger(textOrNull(row.find("td[title='G']").text())) ?? 0,
        avg: parseFloatNumber(textOrNull(row.find("td[title='AVG']").text())) ?? 0,
        atBats: parseInteger(textOrNull(row.find("td[title='AB']").text())) ?? 0,
        runs: parseInteger(textOrNull(row.find("td[title='R']").text())) ?? 0,
        hits: parseInteger(textOrNull(row.find("td[title='H']").text())) ?? 0,
        doubles: parseInteger(textOrNull(row.find("td[title='2B']").text())) ?? 0,
        triples: parseInteger(textOrNull(row.find("td[title='3B']").text())) ?? 0,
        homeRuns: parseInteger(textOrNull(row.find("td[title='HR']").text())) ?? 0,
        rbi: parseInteger(textOrNull(row.find("td[title='RBI']").text())) ?? 0,
        stolenBases: parseInteger(textOrNull(row.find("td[title='SB']").text())) ?? 0,
        caughtStealing: parseInteger(textOrNull(row.find("td[title='CS']").text())) ?? 0,
        walks: parseInteger(textOrNull(row.find("td[title='BB']").text())) ?? 0,
        hitByPitch: parseInteger(textOrNull(row.find("td[title='HBP']").text())) ?? 0,
        strikeouts: parseInteger(textOrNull(row.find("td[title='SO']").text())) ?? 0,
        gidp: parseInteger(textOrNull(row.find("td[title='GIDP']").text())) ?? 0,
      });
    });
}
