import {
  loadHtml,
  parseFloatNumber,
  parseInteger,
  textOrNull,
} from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSituationPitcherRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parsePcode(html: string) {
  const match = html.match(/situationsrunner\.aspx\?pcode=(\d+)/i);
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

function parseRowCells(row: ReturnType<ReturnType<typeof loadHtml>>, $: ReturnType<typeof loadHtml>) {
  const header = textOrNull(row.find("th[scope='row']").text());
  if (header) {
    return {
      situationKey: header,
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
    };
  }

  const cells = row.find("td").toArray().map((item) => textOrNull($(item).text()) ?? "0");
  if (cells.length < 11) {
    return null;
  }
  return {
    situationKey: cells[0] ?? "UNKNOWN",
    hitsAllowed: parseInteger(cells[1]) ?? 0,
    doubles: parseInteger(cells[2]) ?? 0,
    triples: parseInteger(cells[3]) ?? 0,
    homeRunsAllowed: parseInteger(cells[4]) ?? 0,
    walks: parseInteger(cells[5]) ?? 0,
    hitByPitch: parseInteger(cells[6]) ?? 0,
    strikeouts: parseInteger(cells[7]) ?? 0,
    wildPitches: parseInteger(cells[8]) ?? 0,
    balks: parseInteger(cells[9]) ?? 0,
    opponentAvg: parseFloatNumber(cells[10]) ?? 0,
  };
}

export function parseOfficialEnPlayerSituationsRunnerPitcher(html: string) {
  const $ = loadHtml(html);
  const pcode = parsePcode(html);
  const profile = parseProfileMap($);
  const teamName = parseTeamName($);

  return $("div.tbl_common table[summary='runner'] tbody tr")
    .toArray()
    .map((rowElement) => {
      const row = $(rowElement);
      const parsed = parseRowCells(row, $);
      if (!parsed) {
        return null;
      }
      return parsedPlayerSituationPitcherRowSchema.parse({
        pcode,
        teamName,
        playerNameEn: profile.get("name") ?? "Unknown",
        position: profile.get("position") ?? "Pitcher",
        backNumber: profile.get("no") ?? null,
        birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
        debutYear: parseDebutYear(profile.get("debut") ?? null),
        ...parsed,
      });
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
