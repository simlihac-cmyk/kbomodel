import { notFound } from "next/navigation";

import { ScenarioStudio } from "@/components/scenario/scenario-studio";
import { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { parseScenarioShareToken, type ScenarioTargetKey } from "@/lib/sim/kbo";
import { parseYearParam, type YearRouteParams } from "@/lib/utils/routes";
import type { UserScenario } from "@/lib/domain/kbo/types";

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: YearRouteParams;
  searchParams?: Promise<{
    team?: string;
    mode?: string;
    race?: string;
    target?: string;
    share?: string;
  }>;
}) {
  const { year: yearParam } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const year = parseYearParam(yearParam);
  const data = await getSeasonDashboardData(year);
  if (!data) {
    notFound();
  }

  const initialTeamSlug =
    typeof resolvedSearchParams.team === "string" ? resolvedSearchParams.team : null;
  const initialMode =
    resolvedSearchParams.mode === "team" ||
    resolvedSearchParams.mode === "quick" ||
    resolvedSearchParams.mode === "race" ||
    resolvedSearchParams.mode === "advanced"
      ? resolvedSearchParams.mode
      : null;
  const initialRaceFilter =
    resolvedSearchParams.race === "first" ||
    resolvedSearchParams.race === "second" ||
    resolvedSearchParams.race === "fifth" ||
    resolvedSearchParams.race === "all"
      ? resolvedSearchParams.race
      : null;
  const initialTarget: ScenarioTargetKey =
    resolvedSearchParams.target === "first" ||
    resolvedSearchParams.target === "top2" ||
    resolvedSearchParams.target === "postseason" ||
    resolvedSearchParams.target === "ks" ||
    resolvedSearchParams.target === "champion"
      ? resolvedSearchParams.target
      : "postseason";
  const initialShareToken =
    typeof resolvedSearchParams.share === "string" ? resolvedSearchParams.share : null;
  let initialSharedScenario: UserScenario | null = null;
  let initialSharedScenarioError: string | null = null;

  if (initialShareToken) {
    try {
      initialSharedScenario = parseScenarioShareToken(
        initialShareToken,
        data.season.seasonId,
      );
    } catch {
      initialSharedScenarioError = "공유 링크를 해석하지 못했습니다.";
    }
  }

  return (
    <ScenarioStudio
      year={year}
      data={data}
      initialTeamSlug={initialTeamSlug}
      initialMode={initialMode}
      initialRaceFilter={initialRaceFilter}
      initialTarget={initialTarget}
      initialSharedScenario={initialSharedScenario}
      initialSharedScenarioError={initialSharedScenarioError}
      initialShareToken={initialShareToken}
    />
  );
}
