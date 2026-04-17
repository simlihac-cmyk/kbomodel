import { loadHtml, parseFloatNumber, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedTeamPitcherStatRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function parseInningsPitched(value: string) {
  const text = textOrNull(value);
  if (!text) {
    return 0;
  }

  const fractionMatch = text.match(/^(\d+)\s+(\d)\/3$/);
  if (fractionMatch) {
    const whole = Number.parseInt(fractionMatch[1] ?? "0", 10) || 0;
    const outs = Number.parseInt(fractionMatch[2] ?? "0", 10) || 0;
    return whole + outs / 3;
  }

  return parseFloatNumber(text) ?? 0;
}

export function parseOfficialKoTeamPitcher(html: string) {
  const $ = loadHtml(html);

  return $("div.record_result table.tData tbody tr")
    .toArray()
    .map((row) => {
      const cells = $(row)
        .find("td")
        .toArray()
        .map((cell) => textOrNull($(cell).text()) ?? "");

      if (cells.length < 18) {
        return null;
      }

      if (cells.length >= 18 && cells.length < 20) {
        return parsedTeamPitcherStatRowSchema.parse({
          rank: parseInteger(cells[0]) ?? 0,
          teamName: cells[1],
          era: parseFloatNumber(cells[2]) ?? 0,
          games: parseInteger(cells[3]) ?? 0,
          completeGames: 0,
          shutouts: 0,
          wins: parseInteger(cells[4]) ?? 0,
          losses: parseInteger(cells[5]) ?? 0,
          saves: parseInteger(cells[6]) ?? 0,
          holds: parseInteger(cells[7]) ?? 0,
          winPct: parseFloatNumber(cells[8]) ?? 0,
          battersFaced: 0,
          inningsPitched: parseInningsPitched(cells[9]),
          hitsAllowed: parseInteger(cells[10]) ?? 0,
          homeRunsAllowed: parseInteger(cells[11]) ?? 0,
          walks: parseInteger(cells[12]) ?? 0,
          hitByPitch: parseInteger(cells[13]) ?? 0,
          strikeouts: parseInteger(cells[14]) ?? 0,
          runsAllowed: parseInteger(cells[15]) ?? 0,
          earnedRuns: parseInteger(cells[16]) ?? 0,
        });
      }

      return parsedTeamPitcherStatRowSchema.parse({
        rank: parseInteger(cells[0]) ?? 0,
        teamName: cells[1],
        era: parseFloatNumber(cells[2]) ?? 0,
        games: parseInteger(cells[3]) ?? 0,
        completeGames: parseInteger(cells[4]) ?? 0,
        shutouts: parseInteger(cells[5]) ?? 0,
        wins: parseInteger(cells[6]) ?? 0,
        losses: parseInteger(cells[7]) ?? 0,
        saves: parseInteger(cells[8]) ?? 0,
        holds: parseInteger(cells[9]) ?? 0,
        winPct: parseFloatNumber(cells[10]) ?? 0,
        battersFaced: parseInteger(cells[11]) ?? 0,
        inningsPitched: parseInningsPitched(cells[12]),
        hitsAllowed: parseInteger(cells[13]) ?? 0,
        homeRunsAllowed: parseInteger(cells[14]) ?? 0,
        walks: parseInteger(cells[15]) ?? 0,
        hitByPitch: parseInteger(cells[16]) ?? 0,
        strikeouts: parseInteger(cells[17]) ?? 0,
        runsAllowed: parseInteger(cells[18]) ?? 0,
        earnedRuns: parseInteger(cells[19]) ?? 0,
      });
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
