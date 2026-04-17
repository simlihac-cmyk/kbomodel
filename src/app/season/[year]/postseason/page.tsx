import { notFound } from "next/navigation";

import { PostseasonView } from "@/components/postseason/postseason-view";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function PostseasonPage({ params }: { params: YearRouteParams }) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  return <PostseasonView year={year} data={data} />;
}
