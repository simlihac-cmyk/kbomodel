import { notFound } from "next/navigation";

import { TeamSeasonView } from "@/components/team/team-season-view";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { decodeRouteSegmentParam, parseYearParam, type TeamRouteParams, type YearRouteParams } from "@/lib/utils/routes";

export default async function TeamSeasonPage({
  params,
}: {
  params: Promise<Awaited<YearRouteParams> & Awaited<TeamRouteParams>>;
}) {
  const { year: yearParam, teamSlug: teamSlugParam } = await params;
  const year = parseYearParam(yearParam);
  const teamSlug = decodeRouteSegmentParam(teamSlugParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }
  if (
    data.season.status === "completed" &&
    (!data.hasCompleteArchiveGameCoverage || !data.hasCompleteArchivePlayerCoverage)
  ) {
    notFound();
  }

  return <TeamSeasonView year={year} teamSlug={teamSlug} data={data} />;
}
