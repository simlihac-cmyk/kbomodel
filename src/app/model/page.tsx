import { ModelExplainer } from "@/components/model/model-explainer";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { kboRepository } from "@/lib/repositories/kbo";

export default async function ModelPage() {
  const currentSeason = await kboRepository.getCurrentSeason();
  const data = await getSeasonDashboardData(currentSeason.year);

  if (!data) {
    return null;
  }

  return <ModelExplainer data={data} />;
}
