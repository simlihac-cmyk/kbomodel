import { notFound } from "next/navigation";

import { PlayerDetailView } from "@/components/player/player-detail-view";
import { getPlayerPageData } from "@/lib/repositories/kbo/view-models";
import { decodeRouteEntityParam, type PlayerRouteParams } from "@/lib/utils/routes";

export default async function PlayerPage({ params }: { params: PlayerRouteParams }) {
  const { playerId } = await params;
  const data = await getPlayerPageData(decodeRouteEntityParam(playerId));
  if (!data) {
    notFound();
  }

  return <PlayerDetailView data={data} />;
}
