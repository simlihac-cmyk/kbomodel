import { loadHtml, parseFloatNumber, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedTeamHitterStatRowSchema } from "@/lib/data-sources/kbo/dataset-types";

export function parseOfficialKoTeamHitter(html: string) {
  const $ = loadHtml(html);

  return $("div.record_result table.tData tbody tr")
    .toArray()
    .map((row) => {
      const cells = $(row)
        .find("td")
        .toArray()
        .map((cell) => textOrNull($(cell).text()) ?? "");

      if (cells.length < 15) {
        return null;
      }

      return parsedTeamHitterStatRowSchema.parse({
        rank: parseInteger(cells[0]) ?? 0,
        teamName: cells[1],
        avg: parseFloatNumber(cells[2]) ?? 0,
        games: parseInteger(cells[3]) ?? 0,
        plateAppearances: parseInteger(cells[4]) ?? 0,
        atBats: parseInteger(cells[5]) ?? 0,
        runs: parseInteger(cells[6]) ?? 0,
        hits: parseInteger(cells[7]) ?? 0,
        doubles: parseInteger(cells[8]) ?? 0,
        triples: parseInteger(cells[9]) ?? 0,
        homeRuns: parseInteger(cells[10]) ?? 0,
        totalBases: parseInteger(cells[11]) ?? 0,
        rbi: parseInteger(cells[12]) ?? 0,
        sacrificeBunts: parseInteger(cells[13]) ?? 0,
        sacrificeFlies: parseInteger(cells[14]) ?? 0,
      });
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

