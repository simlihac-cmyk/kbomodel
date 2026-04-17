import { notFound } from "next/navigation";

import { SeasonDashboard } from "@/components/dashboard/season-dashboard";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function SeasonPage({ params }: { params: YearRouteParams }) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  return <SeasonDashboard year={year} data={data} />;
}
