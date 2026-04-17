import { parsedFranchiseHistoryRowSchema, type ParsedFranchiseHistoryRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialKoTeamHistory(html: string): ParsedFranchiseHistoryRow[] {
  const $ = loadHtml(html);
  return $("section[data-kbo-dataset='team-history'] article[data-franchise-id]")
    .map((_, element) => {
      const card = $(element);
      const brands = card
        .find("table[data-role='brand-history'] tbody tr")
        .map((__, brandElement) => ({
          displayNameKo: textOrNull($(brandElement).find("[data-col='display']").text()) ?? "Unknown",
          shortNameKo: textOrNull($(brandElement).find("[data-col='short']").text()) ?? "Unknown",
          shortCode: textOrNull($(brandElement).find("[data-col='code']").text()) ?? "UNK",
          seasonStartYear: parseInteger($(brandElement).find("[data-col='start']").text()) ?? 0,
          seasonEndYear: parseInteger($(brandElement).find("[data-col='end']").text()),
          notes: textOrNull($(brandElement).find("[data-col='notes']").text()) ?? undefined,
        }))
        .get();

      return parsedFranchiseHistoryRowSchema.parse({
        franchiseId: textOrNull(card.attr("data-franchise-id")) ?? "unknown",
        canonicalNameKo: textOrNull(card.find("[data-col='canonical']").text()) ?? "Unknown",
        shortNameKo: textOrNull(card.find("[data-col='short']").text()) ?? "Unknown",
        regionKo: textOrNull(card.find("[data-col='region']").text()) ?? "Unknown",
        foundedYear: parseInteger(card.find("[data-col='founded']").text()) ?? 0,
        primaryVenueName: textOrNull(card.find("[data-col='venue']").text()) ?? "Unknown",
        championships: parseInteger(card.find("[data-col='championships']").text()) ?? 0,
        brandHistorySummary: textOrNull(card.find("[data-col='summary']").text()) ?? "",
        brands,
      });
    })
    .get();
}
