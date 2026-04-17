import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSplitMonthPitcherRowSchema } from "@/lib/data-sources/kbo/dataset-types";

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

export function parseOfficialEnPlayerSplitsMonthPitcher(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);

  return $("div.tbl_common table[summary='month'] tbody tr")
    .toArray()
    .map((rowElement) => {
      const row = $(rowElement);
      return parsedPlayerSplitMonthPitcherRowSchema.parse({
        pcode,
        teamName,
        playerNameEn: profile.get("name") ?? "Unknown",
        position: profile.get("position") ?? "Pitcher",
        backNumber: profile.get("no") ?? null,
        birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
        debutYear: parseDebutYear(profile.get("debut") ?? null),
        monthKey: textOrNull(row.find("td[title='MONTH']").text()) ?? "UNK",
        games: parseInteger(textOrNull(row.find("td[title='G']").text())) ?? 0,
        era: parseFloatNumber(textOrNull(row.find("td[title='ERA']").text())) ?? 0,
        wins: parseInteger(textOrNull(row.find("td[title='W']").text())) ?? 0,
        losses: parseInteger(textOrNull(row.find("td[title='L']").text())) ?? 0,
        saves: parseInteger(textOrNull(row.find("td[title='SV']").text())) ?? 0,
        holds: parseInteger(textOrNull(row.find("td[title='HLD']").text())) ?? 0,
        winPct: parseFloatNumber(textOrNull(row.find("td[title='WPCT']").text())) ?? 0,
        plateAppearances: parseInteger(textOrNull(row.find("td[title='PA']").text())) ?? 0,
        inningsPitched: parseFloatNumber(textOrNull(row.find("td[title='IP']").text())) ?? 0,
        hitsAllowed: parseInteger(textOrNull(row.find("td[title='H']").text())) ?? 0,
        homeRunsAllowed: parseInteger(textOrNull(row.find("td[title='HR']").text())) ?? 0,
        walks: parseInteger(textOrNull(row.find("td[title='BB']").text())) ?? 0,
        hitByPitch: parseInteger(textOrNull(row.find("td[title='HBP']").text())) ?? 0,
        strikeouts: parseInteger(textOrNull(row.find("td[title='K']").text())) ?? 0,
        runsAllowed: parseInteger(textOrNull(row.find("td[title='R']").text())) ?? 0,
        earnedRuns: parseInteger(textOrNull(row.find("td[title='ER']").text())) ?? 0,
        opponentAvg: parseFloatNumber(textOrNull(row.find("td[title='OAVG']").text())) ?? 0,
      });
    });
}
