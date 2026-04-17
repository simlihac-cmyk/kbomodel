import {
  parseTiebreakerTokens,
  parsedRulesetRowSchema,
  type ParsedRulesetRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialKoRules(html: string): ParsedRulesetRow[] {
  const $ = loadHtml(html);
  return $("section[data-kbo-dataset='rules'] article[data-season-year]")
    .map((_, element) => {
      const card = $(element);
      const postseasonFormat = card
        .find("table[data-role='postseason'] tbody tr")
        .map((__, rowElement) => ({
          round: (textOrNull($(rowElement).find("[data-col='round']").text()) ?? "wildcard") as
            | "wildcard"
            | "semipo"
            | "po"
            | "ks",
          label: textOrNull($(rowElement).find("[data-col='label']").text()) ?? "Unknown",
          bestOf: parseInteger($(rowElement).find("[data-col='bestOf']").text()) ?? 1,
          higherSeedAdvantageWins:
            parseInteger($(rowElement).find("[data-col='advantageWins']").text()) ?? 0,
        }))
        .get();

      const notes = card
        .find("ul[data-role='notes'] li")
        .map((__, noteElement) => textOrNull($(noteElement).text()) ?? "")
        .get()
        .filter(Boolean);

      return parsedRulesetRowSchema.parse({
        year: parseInteger(card.attr("data-season-year")) ?? 0,
        label: textOrNull(card.find("[data-col='label']").text()) ?? "KBO Ruleset",
        regularSeasonGamesPerTeam: parseInteger(card.find("[data-col='gamesPerTeam']").text()) ?? 144,
        gamesPerOpponent: parseInteger(card.find("[data-col='gamesPerOpponent']").text()) ?? 16,
        tiesAllowed: (textOrNull(card.find("[data-col='tiesAllowed']").text()) ?? "").toLowerCase() !== "no",
        tiebreakerOrder: parseTiebreakerTokens(textOrNull(card.find("[data-col='tiebreakers']").text()) ?? ""),
        specialPlayoffGamePositions: (textOrNull(card.find("[data-col='specialPlayoff']").text()) ?? "")
          .split(",")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value) && value > 0),
        postseasonFormat,
        notes,
      });
    })
    .get();
}
