import {
  normalizeRosterEventType,
  parsedRosterMovementRowSchema,
  type ParsedRosterMovementRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialKoTrade(html: string): ParsedRosterMovementRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='roster-movement'] tbody tr")
    .map((index, element) => {
      const row = $(element);
      const date = textOrNull(row.find("[data-col='date']").text()) ?? "1970-01-01";
      const teamName = textOrNull(row.find("[data-col='team']").text()) ?? "Unknown";
      const playerName = textOrNull(row.find("[data-col='player']").text()) ?? "Unknown";
      const rawEvent = textOrNull(row.find("[data-col='type']").text()) ?? "joined";
      return parsedRosterMovementRowSchema.parse({
        movementId: textOrNull(row.attr("data-movement-id")) ?? `${date}-${teamName}-${playerName}-${index + 1}`,
        date,
        teamName,
        playerName,
        eventType: normalizeRosterEventType(rawEvent),
        note: textOrNull(row.find("[data-col='note']").text()) ?? "",
      });
    })
    .get();
}
