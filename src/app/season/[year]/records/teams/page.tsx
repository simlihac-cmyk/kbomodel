import { notFound } from "next/navigation";

import { TeamRecordsView } from "@/components/records/team-records-view";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function TeamRecordsPage({
  params,
}: {
  params: YearRouteParams;
}) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  return <TeamRecordsView year={year} data={data} />;
}
