import { parsedWeatherRowSchema, type ParsedWeatherRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, parseFloatNumber, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

export function parseOfficialKoWeather(html: string): ParsedWeatherRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='weather'] tbody tr")
    .map((_, element) =>
      parsedWeatherRowSchema.parse({
        date: textOrNull($(element).find("[data-col='date']").text()) ?? "1970-01-01",
        venueName: textOrNull($(element).find("[data-col='venue']").text()) ?? "Unknown",
        summary: textOrNull($(element).find("[data-col='summary']").text()) ?? "",
        tempC: parseFloatNumber($(element).find("[data-col='temp']").text()),
        precipitationProbability: parseFloatNumber($(element).find("[data-col='precip']").text()),
      }),
    )
    .get();
}
