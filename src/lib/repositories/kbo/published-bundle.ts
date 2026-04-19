import { promises as fs } from "node:fs";
import path from "node:path";

import { kboDataBundleSchema } from "@/lib/domain/kbo/schemas";
import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  kboSourceFeatureFlags,
  type NormalizedAwards,
  type NormalizedFranchiseLineage,
  type NormalizedPlayerGameStats,
  type NormalizedPlayerSplitStats,
  type NormalizedRosterEvents,
  type NormalizedRulesets,
  type NormalizedPlayers,
  type NormalizedPlayerSeasonStats,
  type NormalizedScoreboard,
  type NormalizedSeriesGames,
  type NormalizedStandings,
  type NormalizedTeamHitterStats,
  type NormalizedTeamPitcherStats,
} from "@/lib/data-sources/kbo/dataset-types";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { applyNormalizedIngestOverlay } from "@/lib/repositories/kbo/ingest-overlay";

export const FIXTURE_SOURCE_BUNDLE_PATH = path.join(process.cwd(), "data", "kbo", "bundle.json");
export const PUBLISHED_BUNDLE_PATH = path.join(
  process.cwd(),
  "data",
  "normalized",
  "kbo",
  "app-bundle",
  "latest.json",
);

export type PublishedBundleBuildOptions = {
  allowFixturePublish?: boolean;
  includePlayerDetailDatasets?: boolean;
};

type CurrentSeasonCoreDataset =
  | {
      sources: Array<{
        sourceId: string;
        datasetId: string;
        snapshotKey: string;
      }>;
    }
  | null;

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function loadFixtureSourceKboBundle(): Promise<KboDataBundle> {
  return kboDataBundleSchema.parse(await readJsonFile(FIXTURE_SOURCE_BUNDLE_PATH));
}

async function loadLatestCurrentSeasonDataset<T>(
  repository: FileNormalizedKboRepository,
  datasetName: "series-games" | "scoreboard" | "standings" | "roster-events" | "players" | "player-season-stats" | "player-game-stats" | "player-split-stats" | "team-hitter-stats" | "team-pitcher-stats",
  year: number,
): Promise<T | null> {
  const keys = await repository.listDatasetKeys(datasetName);
  const latestKey = keys
    .filter((item) => item.startsWith(`${year}-`))
    .sort()
    .at(-1);
  if (!latestKey) {
    return null;
  }
  return (await repository.getDatasetOutput(datasetName, latestKey)) as T | null;
}

async function loadLatestDataset<T>(
  repository: FileNormalizedKboRepository,
  datasetName: "franchise-lineage" | "rulesets" | "awards",
): Promise<T | null> {
  const keys = await repository.listDatasetKeys(datasetName);
  const latestKey = keys.sort().at(-1);
  if (!latestKey) {
    return null;
  }
  return (await repository.getDatasetOutput(datasetName, latestKey)) as T | null;
}

async function assertDatasetUsesLiveSnapshots(
  datasetName: "standings" | "series-games" | "scoreboard",
  dataset: CurrentSeasonCoreDataset,
) {
  if (!dataset) {
    throw new Error(`Cannot publish official KBO bundle: normalized ${datasetName} dataset is missing.`);
  }

  const rawRepository = new FileRawSourceRepository();
  const failures: string[] = [];

  for (const source of dataset.sources) {
    const snapshot = await rawRepository.getSnapshot(source.sourceId as never, source.datasetId as never, source.snapshotKey);
    if (!snapshot) {
      failures.push(`${datasetName}:${source.sourceId}/${source.datasetId}/${source.snapshotKey} is missing raw snapshot metadata`);
      continue;
    }
    if (snapshot.fixtureBacked) {
      failures.push(`${datasetName}:${source.sourceId}/${source.datasetId}/${source.snapshotKey} is fixture-backed`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Cannot publish official KBO bundle while fixture-backed current-season datasets remain.\n${failures.join("\n")}`,
    );
  }
}

async function coerceOptionalDatasetToLiveOnly<T extends CurrentSeasonCoreDataset>(
  dataset: T,
): Promise<T | null> {
  if (!kboSourceFeatureFlags.officialKboOnly || !dataset) {
    return dataset;
  }

  const rawRepository = new FileRawSourceRepository();
  for (const source of dataset.sources) {
    const snapshot = await rawRepository.getSnapshot(source.sourceId as never, source.datasetId as never, source.snapshotKey);
    if (!snapshot || snapshot.fixtureBacked) {
      return null;
    }
  }

  return dataset;
}

function pruneSampleDependentBundleSections(
  bundle: KboDataBundle,
  options: {
    preserveAwards: boolean;
    preserveRosterEvents: boolean;
    preservePlayerSeasonStats: boolean;
    preservePlayerGameStats: boolean;
    preservePlayerSplitStats: boolean;
  },
): KboDataBundle {
  if (!kboSourceFeatureFlags.officialKboOnly) {
    return bundle;
  }

  return {
    ...bundle,
    rosterEvents: options.preserveRosterEvents ? bundle.rosterEvents : [],
    playerSeasonStats: options.preservePlayerSeasonStats ? bundle.playerSeasonStats : [],
    playerGameStats: options.preservePlayerGameStats ? bundle.playerGameStats : [],
    playerSplitStats: options.preservePlayerSplitStats ? bundle.playerSplitStats : [],
    teamSplitStats: bundle.teamSplitStats.filter((item) => item.splitType === "home" || item.splitType === "away"),
    awards: options.preserveAwards ? bundle.awards : [],
    seasonSummaries: [],
    postseasonResults: [],
  };
}

export async function buildPublishedKboBundleFromNormalized(
  options: PublishedBundleBuildOptions = {},
): Promise<KboDataBundle> {
  const fixtureSourceBundle = await loadFixtureSourceKboBundle();
  const normalizedRepository = new FileNormalizedKboRepository();
  const includePlayerDetailDatasets = options.includePlayerDetailDatasets ?? false;
  const currentSeason =
    [...fixtureSourceBundle.seasons].sort((left, right) => right.year - left.year).find((season) => season.status === "ongoing") ??
    [...fixtureSourceBundle.seasons].sort((left, right) => right.year - left.year)[0];

  const [franchiseLineage, standings, seriesGames, scoreboard, players, awards, playerSeasonStats, playerGameStats, playerSplitStats, rosterEvents, rulesets, teamHitterStats, teamPitcherStats] = await Promise.all([
    loadLatestDataset<NormalizedFranchiseLineage>(normalizedRepository, "franchise-lineage"),
    loadLatestCurrentSeasonDataset<NormalizedStandings>(normalizedRepository, "standings", currentSeason.year),
    loadLatestCurrentSeasonDataset<NormalizedSeriesGames>(normalizedRepository, "series-games", currentSeason.year),
    loadLatestCurrentSeasonDataset<NormalizedScoreboard>(normalizedRepository, "scoreboard", currentSeason.year),
    loadLatestCurrentSeasonDataset<NormalizedPlayers>(normalizedRepository, "players", currentSeason.year),
    loadLatestDataset<NormalizedAwards>(normalizedRepository, "awards"),
    loadLatestCurrentSeasonDataset<NormalizedPlayerSeasonStats>(normalizedRepository, "player-season-stats", currentSeason.year),
    includePlayerDetailDatasets
      ? loadLatestCurrentSeasonDataset<NormalizedPlayerGameStats>(normalizedRepository, "player-game-stats", currentSeason.year)
      : Promise.resolve(null),
    includePlayerDetailDatasets
      ? loadLatestCurrentSeasonDataset<NormalizedPlayerSplitStats>(normalizedRepository, "player-split-stats", currentSeason.year)
      : Promise.resolve(null),
    loadLatestCurrentSeasonDataset<NormalizedRosterEvents>(normalizedRepository, "roster-events", currentSeason.year),
    loadLatestDataset<NormalizedRulesets>(normalizedRepository, "rulesets"),
    loadLatestCurrentSeasonDataset<NormalizedTeamHitterStats>(normalizedRepository, "team-hitter-stats", currentSeason.year),
    loadLatestCurrentSeasonDataset<NormalizedTeamPitcherStats>(normalizedRepository, "team-pitcher-stats", currentSeason.year),
  ]);

  const allowFixturePublish = options.allowFixturePublish ?? process.env.ALLOW_FIXTURE_PUBLISH === "true";

  if (kboSourceFeatureFlags.officialKboOnly && !allowFixturePublish) {
    await assertDatasetUsesLiveSnapshots("standings", standings);
    await assertDatasetUsesLiveSnapshots("series-games", seriesGames);
    await assertDatasetUsesLiveSnapshots("scoreboard", scoreboard);
  }

  const [livePlayers, liveAwards, livePlayerSeasonStats] = await Promise.all([
    coerceOptionalDatasetToLiveOnly(players),
    coerceOptionalDatasetToLiveOnly(awards),
    coerceOptionalDatasetToLiveOnly(playerSeasonStats),
  ]);
  const [livePlayerGameStats, livePlayerSplitStats] = includePlayerDetailDatasets
    ? await Promise.all([
        coerceOptionalDatasetToLiveOnly(playerGameStats),
        coerceOptionalDatasetToLiveOnly(playerSplitStats),
      ])
    : [null, null];
  const liveRosterEvents =
    kboSourceFeatureFlags.officialKboOnly
      ? null
      : await coerceOptionalDatasetToLiveOnly(rosterEvents);

  return kboDataBundleSchema.parse(
    pruneSampleDependentBundleSections(
      applyNormalizedIngestOverlay(fixtureSourceBundle, {
        franchiseLineage,
        players: livePlayers,
        awards: liveAwards,
        playerSeasonStats: livePlayerSeasonStats,
        playerGameStats: livePlayerGameStats,
        playerSplitStats: livePlayerSplitStats,
        standings,
        seriesGames,
        scoreboard,
        rosterEvents: liveRosterEvents,
        rulesets,
        teamHitterStats: await coerceOptionalDatasetToLiveOnly(teamHitterStats),
        teamPitcherStats: await coerceOptionalDatasetToLiveOnly(teamPitcherStats),
      }),
      {
        preserveAwards: liveAwards !== null,
        preserveRosterEvents: liveRosterEvents !== null,
        preservePlayerSeasonStats: livePlayerSeasonStats !== null,
        preservePlayerGameStats: livePlayerGameStats !== null,
        preservePlayerSplitStats: livePlayerSplitStats !== null,
      },
    ),
  );
}

export async function writePublishedKboBundle(bundle: KboDataBundle) {
  await fs.mkdir(path.dirname(PUBLISHED_BUNDLE_PATH), { recursive: true });
  await fs.writeFile(PUBLISHED_BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

export async function loadPublishedKboBundle(): Promise<KboDataBundle | null> {
  try {
    return kboDataBundleSchema.parse(await readJsonFile(PUBLISHED_BUNDLE_PATH));
  } catch {
    return null;
  }
}
