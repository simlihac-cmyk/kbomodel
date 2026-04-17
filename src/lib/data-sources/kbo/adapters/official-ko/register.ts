import { parsedPlayerRegisterRowSchema, type ParsedPlayerRegisterRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

function parseLegacyRegisterFixture(html: string): ParsedPlayerRegisterRow[] {
  const $ = loadHtml(html);
  return $("table[data-kbo-dataset='player-register'] tbody tr")
    .map((_, element) =>
      parsedPlayerRegisterRowSchema.parse({
        teamName: textOrNull($(element).find("[data-col='team']").text()) ?? "Unknown",
        playerName: textOrNull($(element).find("[data-col='player']").text()) ?? "Unknown",
        position: textOrNull($(element).find("[data-col='position']").text()),
        backNumber: textOrNull($(element).find("[data-col='backNumber']").text()),
        statusLabel: textOrNull($(element).find("[data-col='status']").text()),
      }),
    )
    .get();
}

function splitRosterItem(rawText: string | null) {
  const normalized = textOrNull(rawText);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(.*?)(?:\(([^()]*)\))?$/);
  const playerName = textOrNull(match?.[1] ?? normalized);
  const backNumber = textOrNull(match?.[2] ?? null);
  if (!playerName) {
    return null;
  }

  return {
    playerName,
    backNumber,
  };
}

export function parseOfficialKoRegister(html: string): ParsedPlayerRegisterRow[] {
  const $ = loadHtml(html);
  const liveTables = $("table.tData.tDays");
  if (liveTables.length === 0) {
    return parseLegacyRegisterFixture(html);
  }

  const rows: ParsedPlayerRegisterRow[] = [];
  liveTables.each((_, tableElement) => {
    const table = $(tableElement);
    const headers = table
      .find("thead th")
      .map((__, headerElement) => textOrNull($(headerElement).text()))
      .get()
      .filter((value): value is string => value !== null);
    const bodyRow = table.find("tbody tr").first();
    const rawTeamCell = textOrNull(bodyRow.find("th[scope='row']").text());
    const teamName = textOrNull(rawTeamCell?.replace(/\s*\d+\s*명$/, "").trim() ?? null);
    const cells = bodyRow.find("td");

    if (!teamName) {
      return;
    }

    cells.each((index, cellElement) => {
      const headerLabel = headers[index + 1] ?? null;
      const position = textOrNull(headerLabel?.replace(/\(\d+\)/g, "") ?? null);
      $(cellElement)
        .find("li")
        .each((__, itemElement) => {
          const item = splitRosterItem($(itemElement).text());
          if (!item) {
            return;
          }
          rows.push(
            parsedPlayerRegisterRowSchema.parse({
              teamName,
              playerName: item.playerName,
              position,
              backNumber: item.backNumber,
              statusLabel: "registered",
            }),
          );
        });
    });
  });

  return rows;
}
