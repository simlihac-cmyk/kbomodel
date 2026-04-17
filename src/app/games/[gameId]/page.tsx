import { notFound } from "next/navigation";

import { GameDetailView } from "@/components/game/game-detail-view";
import { getGamePageData } from "@/lib/repositories/kbo/view-models";
import { decodeRouteEntityParam, type GameRouteParams } from "@/lib/utils/routes";

export default async function GamePage({ params }: { params: GameRouteParams }) {
  const { gameId } = await params;
  const data = await getGamePageData(decodeRouteEntityParam(gameId));
  if (!data) {
    notFound();
  }

  return <GameDetailView data={data} />;
}
