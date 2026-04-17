export type YearRouteParams = Promise<{ year: string }>;
export type TeamRouteParams = Promise<{ teamSlug: string }>;
export type GameRouteParams = Promise<{ gameId: string }>;
export type PlayerRouteParams = Promise<{ playerId: string }>;

const TEAM_SLUG_ALIASES: Record<string, string> = {
  "ssg-랜더스": "ssg-landers",
  "키움-히어로즈": "kiwoom-heroes",
};

export function normalizeTeamSlug(teamSlug: string): string {
  return TEAM_SLUG_ALIASES[teamSlug] ?? teamSlug;
}

export function buildSeasonTeamRoute(year: number, teamSlug: string): string {
  return `/season/${year}/teams/${encodeURIComponent(normalizeTeamSlug(teamSlug))}`;
}

export function buildScenarioRoute(
  year: number,
  options?: {
    mode?: "quick" | "team" | "race" | "advanced";
    raceFilter?: "first" | "second" | "fifth" | "all";
    target?: "first" | "top2" | "postseason" | "ks" | "champion";
    teamSlug?: string | null;
    shareToken?: string | null;
  },
): string {
  const params = new URLSearchParams();
  if (options?.mode) {
    params.set("mode", options.mode);
  }
  if (options?.raceFilter) {
    params.set("race", options.raceFilter);
  }
  if (options?.target) {
    params.set("target", options.target);
  }
  if (options?.teamSlug) {
    params.set("team", normalizeTeamSlug(options.teamSlug));
  }
  if (options?.shareToken) {
    params.set("share", options.shareToken);
  }
  const query = params.toString();
  return query ? `/season/${year}/scenario?${query}` : `/season/${year}/scenario`;
}

export function buildTeamArchiveRoute(teamSlug: string): string {
  return `/teams/${encodeURIComponent(normalizeTeamSlug(teamSlug))}`;
}

export function buildPlayerRoute(playerId: string): string {
  return `/players/${encodeURIComponent(playerId)}`;
}

export function buildGameRoute(gameId: string): string {
  return `/games/${encodeURIComponent(gameId)}`;
}

export function decodeRouteEntityParam(param: string): string {
  return decodeURIComponent(param);
}

export function decodeRouteSegmentParam(param: string): string {
  return normalizeTeamSlug(decodeURIComponent(param));
}

export function parseYearParam(yearParam: string): number {
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    throw new Error(`Invalid year param: ${yearParam}`);
  }

  return year;
}
