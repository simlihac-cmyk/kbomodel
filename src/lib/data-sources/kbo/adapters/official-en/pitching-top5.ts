import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerTop5EntrySchema } from "@/lib/data-sources/kbo/dataset-types";

function parseRankName(raw: string) {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(\d+)\.\s+(.+)\(([^)]+)\)$/);
  if (!match) {
    return null;
  }

  return {
    rank: Number.parseInt(match[1] ?? "0", 10),
    playerNameEn: (match[2] ?? "").trim(),
    teamName: (match[3] ?? "").trim(),
  };
}

function parsePcode(href: string | null) {
  if (!href) {
    return null;
  }
  const match = href.match(/pcode=(\d+)/i);
  return match?.[1] ?? null;
}

export function parseOfficialEnPitchingTop5(html: string) {
  const $ = loadHtml(html);

  return $("div.rank_chart")
    .toArray()
    .flatMap((chart) => {
      const categoryLabel = textOrNull($(chart).find(".rank_tit h4 span").text());
      if (!categoryLabel) {
        return [];
      }

      return $(chart)
        .find(".rank_list ol li")
        .toArray()
        .map((item) => {
          const href = textOrNull($(item).find("a").attr("href"));
          const pcode = parsePcode(href);
          const parsedRankName = parseRankName(textOrNull($(item).find(".rank_name").text()) ?? "");
          const metricValue = textOrNull($(item).find(".rank_info").text());

          if (!href || !pcode || !parsedRankName || !metricValue) {
            return null;
          }

          return parsedPlayerTop5EntrySchema.parse({
            statType: "pitcher",
            categoryLabel,
            rank: parsedRankName.rank,
            pcode,
            playerNameEn: parsedRankName.playerNameEn,
            teamName: parsedRankName.teamName,
            metricValue,
            playerUrl: href,
          });
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    });
}
