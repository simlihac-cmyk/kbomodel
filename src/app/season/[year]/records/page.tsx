import { notFound } from "next/navigation";

import { RecordsView } from "@/components/records/records-view";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function RecordsPage({ params }: { params: YearRouteParams }) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  return <RecordsView year={year} data={data} />;
}
