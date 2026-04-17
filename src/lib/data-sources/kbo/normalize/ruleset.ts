import { normalizedRulesetsSchema, type NormalizedSourceReference, type ParsedRulesetRow } from "@/lib/data-sources/kbo/dataset-types";

type NormalizeRulesetArgs = {
  rows: ParsedRulesetRow[];
  sourceRef: NormalizedSourceReference;
};

export function normalizeRulesets({ rows, sourceRef }: NormalizeRulesetArgs) {
  return normalizedRulesetsSchema.parse({
    generatedAt: new Date().toISOString(),
    sources: [sourceRef],
    rulesets: rows.map((row) => ({
      rulesetId: `kbo-rules-${row.year}`,
      label: row.label,
      regularSeasonGamesPerTeam: row.regularSeasonGamesPerTeam,
      gamesPerOpponent: row.gamesPerOpponent,
      tiesAllowed: row.tiesAllowed,
      tiebreakerOrder: row.tiebreakerOrder,
      specialPlayoffGamePositions: row.specialPlayoffGamePositions,
      postseasonFormat: row.postseasonFormat,
      notes: row.notes,
    })),
  });
}
