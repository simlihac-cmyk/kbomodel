import { notFound } from "next/navigation";

import { TeamConditionView } from "@/components/team/team-condition-view";
import { getTeamConditionPageData } from "@/lib/team/team-condition-data";
import {
  decodeRouteSegmentParam,
  parseYearParam,
  type TeamRouteParams,
  type YearRouteParams,
} from "@/lib/utils/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamConditionPage({
  params,
}: {
  params: Promise<Awaited<YearRouteParams> & Awaited<TeamRouteParams>>;
}) {
  const { year: yearParam, teamSlug: teamSlugParam } = await params;
  const year = parseYearParam(yearParam);
  const teamSlug = decodeRouteSegmentParam(teamSlugParam);
  const data = await getTeamConditionPageData(year, teamSlug);

  if (!data) {
    notFound();
  }

  return <TeamConditionView year={year} teamSlug={teamSlug} data={data} />;
}
