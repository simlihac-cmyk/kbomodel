import { loadHtml } from "@/lib/data-sources/kbo/adapters/shared/html";
import { fetchHtml, type FetchHtmlResult } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";

export const officialHistoricalTeamRecordPageUrls = [
  "https://www.koreabaseball.com/Record/History/Team/Record.aspx?startYear=2020&halfSc=T",
  "https://www.koreabaseball.com/Record/History/Team/Record.aspx?startYear=2010&halfSc=T",
  "https://www.koreabaseball.com/Record/History/Team/Record.aspx?startYear=2000&halfSc=T",
  "https://www.koreabaseball.com/Record/History/Team/Record.aspx?startYear=1990&halfSc=T",
  "https://www.koreabaseball.com/Record/History/Team/Record.aspx?startYear=1980&halfSc=T",
] as const;

export function mergeHistoricalTeamRecordPages(results: FetchHtmlResult[]): FetchHtmlResult {
  const tables = results.flatMap((result) => {
    const $ = loadHtml(result.html);
    return $("table.tData")
      .map((_, element) => $.html(element))
      .get()
      .filter((table): table is string => Boolean(table));
  });

  if (!tables.length) {
    throw new Error("No historical team record tables were found in the fetched pages.");
  }

  const html = [
    "<!doctype html>",
    '<html lang="ko">',
    "<body>",
    ...tables,
    "</body>",
    "</html>",
  ].join("\n");
  const latestFetchedAt = [...results]
    .map((result) => result.fetchedAt)
    .sort()
    .at(-1) ?? new Date().toISOString();
  const worstHttpStatus = [...results]
    .map((result) => result.httpStatus)
    .sort((left, right) => right - left)[0] ?? 200;

  return {
    html,
    fetchedAt: latestFetchedAt,
    httpStatus: worstHttpStatus,
    checksum: checksumHtml(html),
    sourceUrl: officialHistoricalTeamRecordPageUrls.join(" | "),
  };
}

export async function fetchOfficialHistoricalTeamRecordPages() {
  const results: FetchHtmlResult[] = [];

  for (const sourceUrl of officialHistoricalTeamRecordPageUrls) {
    results.push(await fetchHtml(sourceUrl));
  }

  return mergeHistoricalTeamRecordPages(results);
}
