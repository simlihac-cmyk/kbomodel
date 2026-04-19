import { loadHtml, parseInteger, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import type { ParsedPlayerAwardRow } from "@/lib/data-sources/kbo/dataset-types";
import { parsedPlayerAwardRowSchema } from "@/lib/data-sources/kbo/dataset-types";

function normalizeEntries(values: string[], chunkSize: number) {
  const rows: string[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    rows.push(values.slice(index, index + chunkSize));
  }
  return rows;
}

function extractCellEntries(
  $: ReturnType<typeof loadHtml>,
  cell: Parameters<ReturnType<typeof loadHtml>>[0],
  chunkSize: number,
) {
  const paragraphs = $(cell).find("p").toArray();
  if (paragraphs.length > 0) {
    return paragraphs
      .map((paragraph) =>
        $(paragraph)
          .find("span")
          .toArray()
          .map((item) => textOrNull($(item).text()))
          .filter((item): item is string => item !== null),
      )
      .filter((entry) => entry.length >= chunkSize);
  }

  const values = $(cell)
    .find("span")
    .toArray()
    .map((item) => textOrNull($(item).text()))
    .filter((item): item is string => item !== null);

  return normalizeEntries(values, chunkSize).filter((entry) => entry.length >= chunkSize);
}

export function parseOfficialKoAwardGridPage(
  html: string,
  awardPrefix: string,
) {
  const $ = loadHtml(html);
  const headers = $("table.tData.award thead tr")
    .first()
    .find("th")
    .toArray()
    .map((item) => textOrNull($(item).text()))
    .filter((item): item is string => item !== null)
    .slice(1);

  return $("table.tData.award tbody tr")
    .toArray()
    .flatMap((row) => {
      const year = parseInteger($(row).children("td").first().text());
      if (!year) {
        return [];
      }

      const cells = $(row).children("td").slice(1).toArray();
      return cells.flatMap((cell, index) => {
        const awardLabel = headers[index];
        if (!awardLabel) {
          return [];
        }

        return extractCellEntries($, cell, 2)
          .map(([playerName, teamName]) => {
            if (!playerName || !teamName || playerName === "-" || teamName === "-") {
              return null;
            }

            return parsedPlayerAwardRowSchema.parse({
              year,
              awardLabel: `${awardPrefix} ${awardLabel}`,
              playerName,
              teamName,
              position: awardLabel,
            });
          })
          .filter((entry): entry is ParsedPlayerAwardRow => entry !== null);
      });
    });
}

export function parseOfficialKoAwardDualPage(
  html: string,
) {
  const $ = loadHtml(html);
  const labels = $("table.tData.award thead tr")
    .first()
    .find("th")
    .toArray()
    .map((item) => textOrNull($(item).text()))
    .filter((item): item is string => item !== null)
    .slice(1);

  return $("table.tData.award tbody tr")
    .toArray()
    .flatMap((row) => {
      const year = parseInteger($(row).children("td").first().text());
      if (!year) {
        return [];
      }

      const cells = $(row).children("td").slice(1).toArray();
      return cells.flatMap((cell, index) => {
        const awardLabel = labels[index];
        if (!awardLabel) {
          return [];
        }

        return extractCellEntries($, cell, 3)
          .map(([playerName, teamName, position]) => {
            if (!playerName || !teamName || !position || playerName === "-" || teamName === "-") {
              return null;
            }

            return parsedPlayerAwardRowSchema.parse({
              year,
              awardLabel,
              playerName,
              teamName,
              position,
            });
          })
          .filter((entry): entry is ParsedPlayerAwardRow => entry !== null);
      });
    });
}
