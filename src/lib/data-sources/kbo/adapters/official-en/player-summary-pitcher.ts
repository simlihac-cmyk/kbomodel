import { loadHtml, parseFloatNumber, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerSummaryPitcherRowSchema } from "@/lib/data-sources/kbo/dataset-types";

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

function parsePcode(html: string) {
  const match = html.match(/summary\.aspx\?pcode=(\d+)/i);
  return match?.[1] ?? "unknown";
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

export function parseOfficialEnPlayerSummaryPitcher(html: string) {
  const $ = loadHtml(html);
  const profile = parseProfileMap($);
  const firstTable = parseSeasonStatMap($, 0);
  const secondTable = parseSeasonStatMap($, 1);

  return [
    parsedPlayerSummaryPitcherRowSchema.parse({
      pcode: parsePcode(html),
      teamName: firstTable.get("TEAM") ?? profile.get("team") ?? "Unknown",
      playerNameEn: profile.get("name") ?? "Unknown",
      position: profile.get("position") ?? "Pitcher",
      backNumber: profile.get("no") ?? null,
      birthDate: parseDateDdMmYyyy(profile.get("born") ?? null),
      debutYear: parseDebutYear(profile.get("debut") ?? null),
      games: parseInteger(firstTable.get("G")) ?? 0,
      era: parseFloatNumber(firstTable.get("ERA")) ?? 0,
      inningsPitched: parseInnings(firstTable.get("IP") ?? null),
      strikeouts: parseInteger(secondTable.get("SO")) ?? 0,
      saves: parseInteger(firstTable.get("SV")) ?? 0,
      wins: parseInteger(firstTable.get("W")) ?? 0,
      losses: parseInteger(firstTable.get("L")) ?? 0,
    }),
  ];
}
