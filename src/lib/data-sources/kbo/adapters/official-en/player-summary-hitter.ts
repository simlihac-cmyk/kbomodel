import { loadHtml, parseFloatNumber, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSummaryHitterRowSchema } from "@/lib/data-sources/kbo/dataset-types";

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

function parseSeasonStatMap($: ReturnType<typeof loadHtml>, tableIndex: number) {
  const table = $("div.tbl_common.tbl_stats table").eq(tableIndex);
  const headers = table
    .find("thead th span")
    .toArray()
    .map((item) => textOrNull($(item).text()) ?? "");
  const values = table
    .find("tbody tr td")
    .toArray()
    .map((item) => textOrNull($(item).text()) ?? "");

  return new Map(headers.map((header, index) => [header, values[index] ?? ""] as const));
}

function parseCareerStatRows($: ReturnType<typeof loadHtml>) {
  const table = $("table[summary='Career Stats']").first();
  const headers = table
    .find("thead th span")
    .toArray()
    .map((item) => textOrNull($(item).text()) ?? "");

  return table
    .find("tbody tr")
    .toArray()
    .map((row) => {
      const values = $(row)
        .children("th, td")
        .toArray()
        .map((item) => textOrNull($(item).text()) ?? "");
      const statMap = new Map(headers.map((header, index) => [header, values[index] ?? ""] as const));
      const year = parseInteger(statMap.get("YEAR"));
      if (!year) {
        return null;
      }
      return {
        year,
        teamName: statMap.get("TEAM") ?? "Unknown",
        battingAverage: parseFloatNumber(statMap.get("AVG")) ?? 0,
        games: parseInteger(statMap.get("G")) ?? 0,
        atBats: parseInteger(statMap.get("AB")) ?? 0,
        runs: parseInteger(statMap.get("R")) ?? 0,
        hits: parseInteger(statMap.get("H")) ?? 0,
        homeRuns: parseInteger(statMap.get("HR")) ?? 0,
        rbi: parseInteger(statMap.get("RBI")) ?? 0,
        stolenBases: parseInteger(statMap.get("SB")) ?? 0,
        walks: parseInteger(statMap.get("BB")) ?? 0,
        strikeouts: parseInteger(statMap.get("SO")) ?? 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function parsePcode(html: string) {
  const match = html.match(/summary\.aspx\?pcode=(\d+)/i);
  return match?.[1] ?? "unknown";
}

export function parseOfficialEnPlayerSummaryHitter(html: string) {
  const $ = loadHtml(html);
  const profile = parseProfileMap($);
  const firstTable = parseSeasonStatMap($, 0);
  const secondTable = parseSeasonStatMap($, 1);

  return [
    parsedPlayerSummaryHitterRowSchema.parse({
      pcode: parsePcode(html),
      teamName: firstTable.get("TEAM") ?? profile.get("team") ?? "Unknown",
      playerNameEn: profile.get("name") ?? "Unknown",
      position: profile.get("position") ?? "Hitter",
      backNumber: profile.get("no") ?? null,
      birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
      debutYear: parseDebutYear(profile.get("debut") ?? null),
      games: parseInteger(firstTable.get("G")) ?? 0,
      plateAppearances: parseInteger(firstTable.get("PA")) ?? 0,
      battingAverage: parseFloatNumber(firstTable.get("AVG")) ?? 0,
      atBats: parseInteger(firstTable.get("AB")) ?? 0,
      runs: parseInteger(firstTable.get("R")) ?? 0,
      hits: parseInteger(firstTable.get("H")) ?? 0,
      homeRuns: parseInteger(firstTable.get("HR")) ?? 0,
      rbi: parseInteger(firstTable.get("RBI")) ?? 0,
      stolenBases: parseInteger(firstTable.get("SB")) ?? 0,
      walks: parseInteger(secondTable.get("BB")) ?? 0,
      strikeouts: parseInteger(secondTable.get("SO")) ?? 0,
      sluggingPct: parseFloatNumber(secondTable.get("SLG")) ?? 0,
      onBasePct: parseFloatNumber(secondTable.get("OBP")) ?? 0,
      ops: parseFloatNumber(secondTable.get("OPS")) ?? 0,
      careerStats: parseCareerStatRows($),
    }),
  ];
}
