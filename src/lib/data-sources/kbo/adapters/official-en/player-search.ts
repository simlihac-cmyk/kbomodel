import { parsedPlayerSearchRowSchema, type ParsedPlayerSearchRow } from "@/lib/data-sources/kbo/dataset-types";
import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";

function parsePcode(href: string | null) {
  if (!href) {
    return null;
  }
  const match = href.match(/pcode=(\d+)/i);
  return match?.[1] ?? null;
}

export function parseOfficialEnPlayerSearch(html: string): ParsedPlayerSearchRow[] {
  const $ = loadHtml(html);

  return $("div.tbl_common table tbody tr")
    .map((_, element) =>
      (() => {
        const playerLink = $(element).find("th[title='player'] a");
        const playerUrl = textOrNull(playerLink.attr("href"));
        const pcode = parsePcode(playerUrl);
        const playerName = textOrNull(playerLink.text());
        const position = textOrNull($(element).find("td[title='position']").text());
        const teamName = textOrNull($("input[id$='hfTeam']").attr("value")) ?? "Unknown";

        if (!playerName || !playerUrl || !pcode || !position) {
          return null;
        }

        return parsedPlayerSearchRowSchema.parse({
          teamName,
          playerName,
          pcode,
          playerUrl,
          position,
          backNumber: textOrNull($(element).find("td[title='no.']").text()),
          birthDate: textOrNull($(element).find("td[title='born']").text()),
          heightWeight: textOrNull($(element).find("td[title='ht, wt']").text()),
          statType: playerUrl.toLowerCase().includes("pitcher") ? "pitcher" : "hitter",
        });
      })(),
    )
    .get()
    .filter((row): row is ParsedPlayerSearchRow => row !== null);
}
