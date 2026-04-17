import { buildCurrentStateSnapshot } from "@/lib/data-sources/kbo/derive/build-current-state";
import { buildFreshnessEntries } from "@/lib/data-sources/kbo/derive/build-freshness";
import { buildLatestSimulationSeedInput } from "@/lib/data-sources/kbo/derive/build-simulation-input";
import { type Game, type TeamSeasonStat } from "@/lib/domain/kbo/types";
import { kboRepository } from "@/lib/repositories/kbo";
import { FileKboManifestRepository } from "@/lib/repositories/kbo/manifest-repository";
import { loadPublishedKboBundle, writePublishedKboBundle, buildPublishedKboBundleFromNormalized } from "@/lib/repositories/kbo/published-bundle";
import { getPublisherFromEnv } from "@/lib/publish";
import type { CurrentManifest, PublishArtifact, PublishManifest, SimulationManifest, TodayManifest } from "@/lib/publish/contracts";
import { hashSemanticPayload } from "@/lib/scheduler/kbo/semantic-change";
import { determineKboPhase } from "@/lib/scheduler/kbo/decisions";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";
import { simulateSeason } from "@/lib/sim/kbo";
import { buildSimulationInputFromSeasonContext } from "@/lib/sim/kbo/inputs/build-from-domain";
import { refreshCurrentLiveBundle } from "@/lib/data-sources/kbo/pipeline/refresh-current";
import { refreshColdPathSources } from "@/lib/data-sources/kbo/pipeline/refresh-cold";
import { detectChangedGames, detectSimulationTriggerEvents, shouldRerunFullSimulationForEvent } from "@/lib/scheduler/kbo/triggers";

type AutomationMode = "hot" | "preflight" | "nightly" | "weekly";

export type AutomationRunSummary = {
  mode: AutomationMode;
  phase: string;
  reasonCodes: string[];
  semanticChanges: string[];
  changedGames: string[];
  simulationRerun: boolean;
  publishResults: string[];
};

function filterPreviousSeasonStats(currentYear: number, seasons: Awaited<ReturnType<typeof kboRepository.listSeasons>>, allStats: TeamSeasonStat[]) {
  const previous = [...seasons]
    .filter((season) => season.year < currentYear)
    .sort((left, right) => right.year - left.year)[0];
  return previous ? allStats.filter((item) => item.seasonId === previous.seasonId) : [];
}

async function buildArtifacts(
  previousTodayGames: Game[],
  rerunSimulation: boolean,
  previousSimulationVersion: string | null,
) {
  const [bundle, seasons, currentSeason, currentState, simulationSeedInput] = await Promise.all([
    kboRepository.getBundle(),
    kboRepository.listSeasons(),
    kboRepository.getCurrentSeason(),
    buildCurrentStateSnapshot(),
    buildLatestSimulationSeedInput((await kboRepository.getCurrentSeason()).year),
  ]);
  const seasonContext = await kboRepository.getSeasonContext(currentSeason.year);
  if (!seasonContext || !currentState) {
    throw new Error("Current season context is unavailable for automation publish.");
  }

  const changedGames = detectChangedGames(previousTodayGames, currentState.gamesToday);
  const freshnessByDataset = await buildFreshnessEntries([
    { dataset: "schedule", sourceId: "official-kbo-ko", datasetId: "schedule-calendar", staleAfterMs: 1000 * 60 * 30 },
    { dataset: "scoreboard", sourceId: "official-kbo-en", datasetId: "scoreboard", staleAfterMs: 1000 * 60 * 10 },
    { dataset: "standings", sourceId: "official-kbo-en", datasetId: "standings", staleAfterMs: 1000 * 60 * 30 },
    { dataset: "players", sourceId: "official-kbo-ko", datasetId: "player-register-all", staleAfterMs: 1000 * 60 * 60 * 24 },
    { dataset: "team-offense", sourceId: "official-kbo-ko", datasetId: "team-hitter", staleAfterMs: 1000 * 60 * 60 * 12 },
    { dataset: "team-pitching", sourceId: "official-kbo-ko", datasetId: "team-pitcher", staleAfterMs: 1000 * 60 * 60 * 12 },
  ]);
  const scheduleVersion = hashSemanticPayload(seasonContext.series);
  const scoreboardVersion = hashSemanticPayload(currentState.gamesToday);
  const standingsVersion = hashSemanticPayload(seasonContext.teamSeasonStats);
  const currentDataVersion = hashSemanticPayload({
    season: currentSeason.seasonId,
    scheduleVersion,
    scoreboardVersion,
    standingsVersion,
  });

  const artifacts: PublishArtifact[] = [
    {
      dataset: "current-state",
      version: currentDataVersion,
      payload: currentState,
    },
    {
      dataset: "today-snapshot",
      version: hashSemanticPayload({
        gamesToday: currentState.gamesToday,
        hasLiveGames: currentState.hasLiveGames,
      }),
      payload: {
        generatedAt: new Date().toISOString(),
        seasonId: currentSeason.seasonId,
        gamesToday: currentState.gamesToday,
        hasLiveGames: currentState.hasLiveGames,
        allGamesFinal: currentState.allGamesFinal,
      },
    },
    {
      dataset: "live-scoreboard",
      version: scoreboardVersion,
      payload: {
        generatedAt: new Date().toISOString(),
        gamesToday: currentState.gamesToday,
      },
    },
  ];

  let simulationVersion: string | null = previousSimulationVersion;
  let simulationRecomputed = false;
  let simulationTriggers: string[] = [];

  if (rerunSimulation) {
    const previousSeasonStats = filterPreviousSeasonStats(currentSeason.year, seasons, bundle.teamSeasonStats);
    const simulationInput = buildSimulationInputFromSeasonContext(seasonContext, previousSeasonStats);
    const simulationResult = simulateSeason(simulationInput, 400);
    simulationVersion = hashSemanticPayload(simulationResult);
    simulationRecomputed = true;
    simulationTriggers = detectSimulationTriggerEvents(previousTodayGames, currentState.gamesToday).filter((event) =>
      shouldRerunFullSimulationForEvent(event),
    );

    artifacts.push(
      {
        dataset: "simulation-input",
        version: hashSemanticPayload(simulationSeedInput ?? simulationInput),
        payload: simulationSeedInput ?? simulationInput,
      },
      {
        dataset: "simulation-result",
        version: simulationVersion,
        payload: simulationResult,
      },
    );
  }

  const currentManifest: CurrentManifest = {
    manifestType: "current",
    publishedAt: new Date().toISOString(),
    dataVersion: currentDataVersion,
    scheduleVersion,
    scoreboardVersion,
    standingsVersion,
    simulationVersion,
    hasLiveGames: currentState.hasLiveGames,
    allGamesFinal: currentState.allGamesFinal,
    changedGames,
    freshnessByDataset,
    simulationFreshness: currentState.hasLiveGames ? "waiting-for-final" : simulationVersion ? "fresh" : "stale",
  };

  const todayManifest: TodayManifest = {
    manifestType: "today",
    publishedAt: currentManifest.publishedAt,
    dataVersion: hashSemanticPayload(currentState.gamesToday),
    scheduleVersion,
    scoreboardVersion,
    hasLiveGames: currentState.hasLiveGames,
    allGamesFinal: currentState.allGamesFinal,
    changedGames,
    freshnessByDataset,
  };

  const simulationManifest: SimulationManifest = {
    manifestType: "simulation",
    publishedAt: currentManifest.publishedAt,
    dataVersion: currentDataVersion,
    simulationVersion,
    standingsVersion,
    scheduleVersion,
    recomputedBecause: simulationTriggers,
    freshnessByDataset,
  };

  return {
    artifacts,
    manifests: [currentManifest, todayManifest, simulationManifest] satisfies PublishManifest[],
    changedGames,
    simulationRecomputed,
  };
}

export async function runAutomationMode(mode: AutomationMode): Promise<AutomationRunSummary> {
  const manifestRepository = new FileKboManifestRepository();
  const previousBundle = await loadPublishedKboBundle();
  const previousCurrentSeason = previousBundle
    ? previousBundle.seasons.sort((left, right) => right.year - left.year).find((season) => season.status === "ongoing") ?? previousBundle.seasons[0]
    : null;
  const previousTodayGames = previousBundle && previousCurrentSeason
    ? previousBundle.games.filter(
        (game) => game.seasonId === previousCurrentSeason.seasonId && game.scheduledAt.slice(0, 10) === getKboDateKey(),
      )
    : [];
  const previousManifest = (await manifestRepository.getManifest("current")) as CurrentManifest | null;

  const currentBundle = await kboRepository.getBundle();
  const currentSeason =
    currentBundle.seasons.sort((left, right) => right.year - left.year).find((season) => season.status === "ongoing") ?? currentBundle.seasons[0];
  const currentSeasonContext = await kboRepository.getSeasonContext(currentSeason.year);
  const todayIso = getKboDateKey();
  const currentGamesToday = currentSeasonContext?.games.filter((game) => game.scheduledAt.slice(0, 10) === todayIso) ?? [];

  const decision = determineKboPhase({
    gamesToday: currentGamesToday,
    previousTodayGames,
    currentManifest: previousManifest,
    stalePregameData: mode === "preflight",
    staleColdPath: mode === "weekly",
  });

  if (mode === "nightly") {
    decision.phase = "NIGHTLY_RECONCILE";
    decision.shouldRefreshHotPath = true;
    decision.shouldRefreshColdPath = true;
    decision.shouldPublish = true;
    decision.shouldRerunSimulation = true;
  } else if (mode === "weekly") {
    decision.phase = "WEEKLY_COLD_SYNC";
    decision.shouldRefreshColdPath = true;
  }

  if (!decision.shouldRefreshHotPath && !decision.shouldRefreshColdPath && !decision.shouldPublish) {
    return {
      mode,
      phase: decision.phase,
      reasonCodes: decision.reasonCodes,
      semanticChanges: [],
      changedGames: [],
      simulationRerun: false,
      publishResults: [],
    };
  }

  if (decision.shouldRefreshHotPath) {
    await refreshCurrentLiveBundle();
  }
  if (decision.shouldRefreshColdPath) {
    await refreshColdPathSources();
  }

  const rebuiltBundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(rebuiltBundle);

  const { artifacts, manifests, changedGames, simulationRecomputed } = await buildArtifacts(
    previousTodayGames,
    decision.shouldRerunSimulation,
    previousManifest?.simulationVersion ?? null,
  );
  const publisher = getPublisherFromEnv();
  const publishResults = decision.shouldPublish
    ? await publisher.publishArtifacts(artifacts, manifests)
    : [];

  return {
    mode,
    phase: decision.phase,
    reasonCodes: decision.shouldPublish ? [...decision.reasonCodes, "publish-completed"] : [...decision.reasonCodes, "publish-skipped"],
    semanticChanges: manifests.map((manifest) => `${manifest.manifestType}:${manifest.dataVersion}`),
    changedGames,
    simulationRerun: simulationRecomputed,
    publishResults: publishResults.map((result) => `${result.mode}:${result.target}`),
  };
}
