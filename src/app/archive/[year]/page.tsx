import { notFound } from "next/navigation";

import { ArchiveSeasonView } from "@/components/archive/archive-season-view";
import { getArchiveSeasonPageData } from "@/lib/repositories/kbo/view-models";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";

export default async function ArchiveSeasonPage({ params }: { params: YearRouteParams }) {
  const { year: yearParam } = await params;
  const year = parseYearParam(yearParam);
  const data = await getArchiveSeasonPageData(year);
  if (!data) {
    notFound();
  }

  return <ArchiveSeasonView year={year} data={data} />;
}
