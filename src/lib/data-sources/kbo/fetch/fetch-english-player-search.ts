import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { fetchHtml, type FetchHtmlResult } from "@/lib/data-sources/kbo/fetch/fetch-html";

const PLAYER_SEARCH_URL = "https://eng.koreabaseball.com/Teams/PlayerSearch.aspx";
const EVENT_TARGET = "ctl00$ctl00$ctl00$ctl00$cphContainer$cphContainer$cphContent$cphContent$lbtnSearch";
const HF_TEAM = "ctl00$ctl00$ctl00$ctl00$cphContainer$cphContainer$cphContent$cphContent$hfTeam";
const HF_POSITION = "ctl00$ctl00$ctl00$ctl00$cphContainer$cphContainer$cphContent$cphContent$hfPosition";

type AspNetTokens = {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
};

function extractHiddenValue(html: string, id: string) {
  const escaped = id.replace(/[$]/g, "\\$");
  const pattern = new RegExp(`id="${escaped}" value="([^"]*)"`);
  const match = html.match(pattern);
  return match?.[1] ?? "";
}

export function extractPlayerSearchAspNetTokens(html: string): AspNetTokens {
  return {
    viewState: extractHiddenValue(html, "__VIEWSTATE"),
    viewStateGenerator: extractHiddenValue(html, "__VIEWSTATEGENERATOR"),
    eventValidation: extractHiddenValue(html, "__EVENTVALIDATION"),
  };
}

export async function fetchOfficialEnPlayerSearchFiltered(teamCode: string, positionCode: string): Promise<FetchHtmlResult> {
  const initial = await fetchHtml(PLAYER_SEARCH_URL);
  const tokens = extractPlayerSearchAspNetTokens(initial.html);
  const body = new URLSearchParams();

  body.set("__VIEWSTATE", tokens.viewState);
  body.set("__VIEWSTATEGENERATOR", tokens.viewStateGenerator);
  body.set("__EVENTVALIDATION", tokens.eventValidation);
  body.set("__EVENTTARGET", EVENT_TARGET);
  body.set("__EVENTARGUMENT", "");
  body.set(HF_TEAM, teamCode);
  body.set(HF_POSITION, positionCode);

  const result = await fetchHtml(PLAYER_SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return {
    ...result,
    checksum: result.checksum ?? checksumHtml(result.html),
  };
}
