import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSituationHitterRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parsePcode(html: string) {
  const match = html.match(/situationsbattingorder\.aspx\?pcode=(\d+)/i);
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

function parseRowCells($: ReturnType<typeof loadHtml>, row: ReturnType<ReturnType<typeof loadHtml>>) {
  const header = textOrNull(row.find("th[scope='row']").text());
  if (header) {
    return {
      situationKey: header,
      avg: parseFloatNumber(textOrNull(row.find("td[title='AVG']").text())) ?? 0,
      atBats: parseInteger(textOrNull(row.find("td[title='AB']").text())) ?? 0,
      hits: parseInteger(textOrNull(row.find("td[title='H']").text())) ?? 0,
      doubles: parseInteger(textOrNull(row.find("td[title='2B']").text())) ?? 0,
      triples: parseInteger(textOrNull(row.find("td[title='3B']").text())) ?? 0,
      homeRuns: parseInteger(textOrNull(row.find("td[title='HR']").text())) ?? 0,
      rbi: parseInteger(textOrNull(row.find("td[title='RBI']").text())) ?? 0,
      walks: parseInteger(textOrNull(row.find("td[title='BB']").text())) ?? 0,
      hitByPitch: parseInteger(textOrNull(row.find("td[title='HBP']").text())) ?? 0,
      strikeouts: parseInteger(textOrNull(row.find("td[title='SO']").text())) ?? 0,
      gidp: parseInteger(textOrNull(row.find("td[title='GIDP']").text())) ?? 0,
    };
  }

  const cells = row.find("td").toArray().map((item) => textOrNull($(item).text()) ?? "0");
  if (cells.length < 12) return null;
  return {
    situationKey: cells[0] ?? "UNKNOWN",
    avg: parseFloatNumber(cells[1]) ?? 0,
    atBats: parseInteger(cells[2]) ?? 0,
    hits: parseInteger(cells[3]) ?? 0,
    doubles: parseInteger(cells[4]) ?? 0,
    triples: parseInteger(cells[5]) ?? 0,
    homeRuns: parseInteger(cells[6]) ?? 0,
    rbi: parseInteger(cells[7]) ?? 0,
    walks: parseInteger(cells[8]) ?? 0,
    hitByPitch: parseInteger(cells[9]) ?? 0,
    strikeouts: parseInteger(cells[10]) ?? 0,
    gidp: parseInteger(cells[11]) ?? 0,
  };
}

export function parseOfficialEnPlayerSituationsBattingOrderHitter(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);

  return $("div.tbl_common table[summary='batting order'] tbody tr")
    .toArray()
    .map((rowElement) => {
      const row = $(rowElement);
      const parsed = parseRowCells($, row);
      if (!parsed) return null;
      return parsedPlayerSituationHitterRowSchema.parse({
        pcode,
        teamName,
        playerNameEn: profile.get("name") ?? "Unknown",
        position: profile.get("position") ?? "Hitter",
        backNumber: profile.get("no") ?? null,
        birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
        debutYear: parseDebutYear(profile.get("debut") ?? null),
        ...parsed,
      });
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
