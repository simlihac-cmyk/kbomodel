import { parsedStatizWarRowSchema, type ParsedStatizWarRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseFloatNumber, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseStatizWar(html: string): ParsedStatizWarRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='statiz-war'] tbody tr")
    .map((_, element) =>
      parsedStatizWarRowSchema.parse({
        playerName: textOrNull($(element).find("[data-col='player']").text()) ?? "Unknown",
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        war: parseFloatNumber($(element).find("[data-col='war']").text()),
      }),
    )
    .get();
}
