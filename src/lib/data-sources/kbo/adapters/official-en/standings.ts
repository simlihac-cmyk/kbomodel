import { parsedStandingsRowSchema, type ParsedStandingsRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseFloatNumber, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialEnStandings(html: string): ParsedStandingsRow[] {
  const $ = loadHtml(html);
  const rows: ParsedStandingsRow[] = [];

  const table =
    $("table[data-kbo-dataset='standings']").first() ||
    $(".tbl_common table[summary='team standings']").first();

  const targetRows =
    table.length > 0 ? table.find("tbody tr") : $(".tbl_common table[summary='team standings']").first().find("tbody tr");

  targetRows.each((_, element) => {
    const row = $(element);
    const cells = row.find("td");
    rows.push(
      parsedStandingsRowSchema.parse({
        rank: parseInteger(row.find("[data-col='rank']").text()) ?? parseInteger(cells.eq(0).text()) ?? rows.length + 1,
        teamName: textOrNull(row.find("[data-col='team']").text()) ?? textOrNull(cells.eq(1).text()) ?? "Unknown",
        games: parseInteger(row.find("[data-col='games']").text()) ?? parseInteger(cells.eq(2).text()) ?? 0,
        wins: parseInteger(row.find("[data-col='wins']").text()) ?? parseInteger(cells.eq(3).text()) ?? 0,
        losses: parseInteger(row.find("[data-col='losses']").text()) ?? parseInteger(cells.eq(4).text()) ?? 0,
        ties: parseInteger(row.find("[data-col='ties']").text()) ?? parseInteger(cells.eq(5).text()) ?? 0,
        winPct: parseFloatNumber(row.find("[data-col='pct']").text()) ?? parseFloatNumber(cells.eq(6).text()) ?? 0,
        gamesBehind: parseFloatNumber(row.find("[data-col='gb']").text()) ?? parseFloatNumber(cells.eq(7).text()) ?? 0,
        last10: textOrNull(row.find("[data-col='last10']").text()) ?? "0-0-0",
        streak: textOrNull(row.find("[data-col='streak']").text()) ?? textOrNull(cells.eq(8).text()) ?? "-",
        homeRecord: textOrNull(row.find("[data-col='home']").text()) ?? textOrNull(cells.eq(9).text()) ?? "0-0-0",
        awayRecord: textOrNull(row.find("[data-col='away']").text()) ?? textOrNull(cells.eq(10).text()) ?? "0-0-0",
        runsScored: parseInteger(row.find("[data-col='rs']").text()),
        runsAllowed: parseInteger(row.find("[data-col='ra']").text()),
      }),
    );
  });

  return rows;
}
