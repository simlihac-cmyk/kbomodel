import { notFound } from "next/navigation";

import { PlayerRecordsView } from "@/components/records/player-records-view";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function PitcherRecordsPage({
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

  return <PlayerRecordsView year={year} data={data} statType="pitcher" />;
}
