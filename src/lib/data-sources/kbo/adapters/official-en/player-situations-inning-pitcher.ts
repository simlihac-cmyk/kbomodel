import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSituationPitcherRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parsePcode(html: string) {
  const match = html.match(/situationsinning\.aspx\?pcode=(\d+)/i);
  return match?.[1] ?? "unknown";
}

function parseProfileMap($: ReturnType<typeof loadHtml>) {
  const profile = new Map<string, string>();
  $("div.player_detail li").each((_, item) => {
    const label = textOrNull($(item).find("b").text());
    const value = textOrNull($(item).text().replace($(item).find("b").text(), "").replace(":", ""));
    if (label && value) profile.set(label.toLowerCase(), value);
  });
  return profile;
}

function parseTeamName($: ReturnType<typeof loadHtml>) {
  const teamInfo = textOrNull($("span.team-info").first().text());
  return teamInfo?.split(/\s+/)[0] ?? "Unknown";
}

function parseDateDdMmYyyy(value: string | null) {
  if (!value) return null;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseDebutYear(value: string | null) {
  const match = value?.match(/^(\d{2})/);
  return match ? 2000 + Number.parseInt(match[1] ?? "0", 10) : 0;
}

export function parseOfficialEnPlayerSituationsInningPitcher(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);

  return $("div.tbl_common table[summary='inning'] tbody tr")
    .toArray()
    .map((rowElement) => {
      const row = $(rowElement);
      return parsedPlayerSituationPitcherRowSchema.parse({
        pcode,
        teamName,
        playerNameEn: profile.get("name") ?? "Unknown",
        position: profile.get("position") ?? "Pitcher",
        backNumber: profile.get("no") ?? null,
        birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
        debutYear: parseDebutYear(profile.get("debut") ?? null),
        situationKey: textOrNull(row.find("th[scope='row']").text()) ?? "UNKNOWN",
        hitsAllowed: parseInteger(textOrNull(row.find("td[title='H']").text())) ?? 0,
        doubles: parseInteger(textOrNull(row.find("td[title='2B']").text())) ?? 0,
        triples: parseInteger(textOrNull(row.find("td[title='3B']").text())) ?? 0,
        homeRunsAllowed: parseInteger(textOrNull(row.find("td[title='HR']").text())) ?? 0,
        walks: parseInteger(textOrNull(row.find("td[title='BB']").text())) ?? 0,
        hitByPitch: parseInteger(textOrNull(row.find("td[title='HBP']").text())) ?? 0,
        strikeouts: parseInteger(textOrNull(row.find("td[title='K']").text())) ?? 0,
        wildPitches: parseInteger(textOrNull(row.find("td[title='WP']").text())) ?? 0,
        balks: parseInteger(textOrNull(row.find("td[title='BK']").text())) ?? 0,
        opponentAvg: parseFloatNumber(textOrNull(row.find("td[title='OAVG']").text())) ?? 0,
      });
    });
}
