import { notFound } from "next/navigation";

import { RaceOverview } from "@/components/race/race-overview";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function RacePage({ params }: { params: YearRouteParams }) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  return <RaceOverview year={year} data={data} />;
}
