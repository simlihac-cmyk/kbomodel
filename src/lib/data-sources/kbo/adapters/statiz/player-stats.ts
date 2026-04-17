import { parsedStatizPlayerStatRowSchema, type ParsedStatizPlayerStatRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseStatizPlayerStats(html: string): ParsedStatizPlayerStatRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='statiz-player-stats'] tbody tr")
    .map((_, element) =>
      parsedStatizPlayerStatRowSchema.parse({
        playerName: textOrNull($(element).find("[data-col='player']").text()) ?? "Unknown",
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        metric: textOrNull($(element).find("[data-col='metric']").text()) ?? "unknown",
        value: textOrNull($(element).find("[data-col='value']").text()) ?? "",
      }),
    )
    .get();
}
