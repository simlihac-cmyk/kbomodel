import { notFound } from "next/navigation";

import { FranchiseView } from "@/components/archive/franchise-view";
import { getFranchiseArchiveData } from "@/lib/repositories/kbo/view-models";
import { decodeRouteSegmentParam, type TeamRouteParams } from "@/lib/utils/routes";

export default async function TeamArchivePage({ params }: { params: TeamRouteParams }) {
  const { teamSlug: teamSlugParam } = await params;
  const teamSlug = decodeRouteSegmentParam(teamSlugParam);
  const data = await getFranchiseArchiveData(teamSlug);
  if (!data) {
    notFound();
  }

  return <FranchiseView data={data} />;
}
