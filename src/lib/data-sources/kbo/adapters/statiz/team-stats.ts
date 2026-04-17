import { parsedStatizTeamStatRowSchema, type ParsedStatizTeamStatRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseStatizTeamStats(html: string): ParsedStatizTeamStatRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='statiz-team-stats'] tbody tr")
    .map((_, element) =>
      parsedStatizTeamStatRowSchema.parse({
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        games: parseInteger($(element).find("[data-col='games']").text()),
        metric: textOrNull($(element).find("[data-col='metric']").text()) ?? "unknown",
        value: textOrNull($(element).find("[data-col='value']").text()) ?? "",
      }),
    )
    .get();
}
