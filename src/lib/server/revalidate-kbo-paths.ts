import { revalidatePath } from "next/cache";

import {
  buildGameRoute,
  buildSeasonRecordsRoute,
  buildSeasonTeamConditionRoute,
  buildSeasonTeamRoute,
  buildTeamArchiveRoute,
  normalizeTeamSlug,
} from "@/lib/utils/routes";

type RevalidateKboPublicPathOptions = {
  years?: number[];
  teamSlugs?: string[];
  gameIds?: string[];
  includeRoot?: boolean;
  includeArchiveHub?: boolean;
};

export function collectKboPublicRevalidationPaths({
  years = [],
  teamSlugs = [],
  gameIds = [],
  includeRoot = true,
  includeArchiveHub = true,
}: RevalidateKboPublicPathOptions): string[] {
  const paths = new Set<string>();
  const normalizedYears = [...new Set(years)];
  const normalizedTeamSlugs = [...new Set(teamSlugs.map(normalizeTeamSlug))];

  if (includeRoot) {
    paths.add("/");
  }

  if (includeArchiveHub) {
    paths.add("/archive");
  }

  for (const year of normalizedYears) {
    paths.add(`/season/${year}`);
    paths.add(`/season/${year}/race`);
    paths.add(`/season/${year}/scenario`);
    paths.add(buildSeasonRecordsRoute(year));
    paths.add(buildSeasonRecordsRoute(year, "teams"));
    paths.add(buildSeasonRecordsRoute(year, "pitchers"));
    paths.add(buildSeasonRecordsRoute(year, "hitters"));
    paths.add(`/season/${year}/postseason`);
    paths.add(`/archive/${year}`);

    for (const teamSlug of normalizedTeamSlugs) {
      paths.add(buildSeasonTeamRoute(year, teamSlug));
      paths.add(buildSeasonTeamConditionRoute(year, teamSlug));
    }
  }

  for (const teamSlug of normalizedTeamSlugs) {
    paths.add(buildTeamArchiveRoute(teamSlug));
  }

  for (const gameId of [...new Set(gameIds)]) {
    paths.add(buildGameRoute(gameId));
  }

  return [...paths];
}

export function revalidateKboPublicPaths(options: RevalidateKboPublicPathOptions) {
  for (const path of collectKboPublicRevalidationPaths(options)) {
    revalidatePath(path);
  }
}
