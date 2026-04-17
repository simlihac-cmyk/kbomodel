import { parsedTeamInformationRowSchema, type ParsedTeamInformationRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialEnTeamInformation(html: string): ParsedTeamInformationRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='team-information'] tbody tr")
    .map((_, element) =>
      parsedTeamInformationRowSchema.parse({
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        managerName: textOrNull($(element).find("[data-col='manager']").text()),
        venueName: textOrNull($(element).find("[data-col='venue']").text()),
        foundedYear: parseInteger($(element).find("[data-col='founded']").text()),
      }),
    )
    .get();
}
