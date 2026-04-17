import {
  parsedHistoricalTeamRecordRowSchema,
  type ParsedHistoricalTeamRecordRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

function parseLegacyHistoricalFixture(html: string): ParsedHistoricalTeamRecordRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='historical-team-record'] tbody tr")
    .map((_, element) =>
      parsedHistoricalTeamRecordRowSchema.parse({
        year: parseInteger($(element).find("[data-col='year']").text()) ?? 0,
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        rank: parseInteger($(element).find("[data-col='rank']").text()) ?? 0,
        wins: parseInteger($(element).find("[data-col='wins']").text()) ?? 0,
        losses: parseInteger($(element).find("[data-col='losses']").text()) ?? 0,
        ties: parseInteger($(element).find("[data-col='ties']").text()) ?? 0,
        postseasonResult: textOrNull($(element).find("[data-col='postseason']").text()),
      }),
    )
    .get();
}

export function parseOfficialKoHistoricalTeamRecord(html: string): ParsedHistoricalTeamRecordRow[] {
  const $ = loadHtml(html);
  const liveTables = $("table.tData");
  if (liveTables.length === 0) {
    return parseLegacyHistoricalFixture(html);
  }

  const rows: ParsedHistoricalTeamRecordRow[] = [];
  liveTables.each((_, tableElement) => {
    const table = $(tableElement);
    const year = parseInteger(table.find("thead th").first().text());
    if (!year) {
      return;
    }

    table.find("tbody tr").each((__, rowElement) => {
      rows.push(
        parsedHistoricalTeamRecordRowSchema.parse({
          year,
          teamName: textOrNull($(rowElement).find("th[scope='row']").text()) ?? "Unknown",
          rank: table.find("tbody tr").index(rowElement) + 1,
          wins: parseInteger($(rowElement).find("td").eq(1).text()) ?? 0,
          losses: parseInteger($(rowElement).find("td").eq(2).text()) ?? 0,
          ties: parseInteger($(rowElement).find("td").eq(3).text()) ?? 0,
          postseasonResult: null,
        }),
      );
    });
  });

  return rows;
}
