import { promises as fs } from "node:fs";
import path from "node:path";

import {
  kboDataBundleSchema,
  manualAdjustmentBundleSchema,
  schedulePatchBundleSchema,
  seasonMetaPatchBundleSchema,
  teamBrandPatchBundleSchema,
} from "@/lib/domain/kbo/schemas";
import type {
  GameSchedulePatch,
  KboDataBundle,
  ManualAdjustmentBundle,
  ManualAdjustmentPatch,
  PlayerCareerStat,
  PlayerGameStat,
  PlayerSplitStat,
  SchedulePatchBundle,
  SeasonMetaPatch,
  SeasonMetaPatchBundle,
  TeamBrandPatch,
  TeamBrandPatchBundle,
} from "@/lib/domain/kbo/types";
import type {
  NormalizedPlayerCareerStats,
  NormalizedPlayerGameStats,
  NormalizedPlayerSplitStats,
} from "@/lib/data-sources/kbo/dataset-types";
import { kboSourceFeatureFlags } from "@/lib/data-sources/kbo/dataset-types";
import type { KboRepository } from "@/lib/repositories/kbo/contracts";
import { MemoryKboRepository } from "@/lib/repositories/kbo/memory-adapter";
import {
  FIXTURE_SOURCE_BUNDLE_PATH,
  PUBLISHED_BUNDLE_PATH,
  loadPublishedKboBundle,
} from "@/lib/repositories/kbo/published-bundle";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";

const BUNDLE_PATH = FIXTURE_SOURCE_BUNDLE_PATH;
const MANUAL_ADJUSTMENTS_PATH = path.join(process.cwd(), "data", "kbo", "manual-adjustments.json");
const SCHEDULE_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "schedule-patches.json");
const SEASON_META_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "season-meta-patches.json");
const TEAM_BRAND_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "team-brand-patches.json");
const NORMALIZED_KBO_ROOT = path.join(process.cwd(), "data", "normalized", "kbo");

type CachedFileValue<TValue> = {
  sourcePath: string;
  mtimeMs: number;
  value: TValue;
};

type CachedPlayerDetails = {
  careerStatsKey: string | null;
  careerStatsMtimeMs: number | null;
  gameStatsKey: string | null;
  gameStatsMtimeMs: number | null;
  splitStatsKey: string | null;
  splitStatsMtimeMs: number | null;
  playerCareerStats: PlayerCareerStat[];
  playerGameStats: PlayerGameStat[];
  playerSplitStats: PlayerSplitStat[];
};

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

export class FileKboRepository implements KboRepository {
  private readonly normalizedRepository = new FileNormalizedKboRepository();
  private baseBundleCache: CachedFileValue<KboDataBundle> | null = null;
  private manualAdjustmentsCache: CachedFileValue<ManualAdjustmentBundle> | null = null;
  private schedulePatchesCache: CachedFileValue<SchedulePatchBundle> | null = null;
  private seasonMetaPatchesCache: CachedFileValue<SeasonMetaPatchBundle> | null = null;
  private teamBrandPatchesCache: CachedFileValue<TeamBrandPatchBundle> | null = null;
  private playerDetailCache = new Map<number, CachedPlayerDetails>();

  private async statFile(filePath: string) {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  private normalizedDatasetPath(
    datasetName: "player-career-stats" | "player-game-stats" | "player-split-stats",
    snapshotKey: string,
  ) {
    return path.join(NORMALIZED_KBO_ROOT, datasetName, `${snapshotKey}.json`);
  }

  private async loadCachedData<TValue>(
    filePath: string,
    parser: (raw: unknown) => TValue,
    cache: CachedFileValue<TValue> | null,
  ) {
    const stat = await this.statFile(filePath);
    if (stat && cache && cache.sourcePath === filePath && cache.mtimeMs === stat.mtimeMs) {
      return cache;
    }

    const parsed = parser(await readJsonFile(filePath));
    return {
      sourcePath: filePath,
      mtimeMs: stat?.mtimeMs ?? Date.now(),
      value: parsed,
    } satisfies CachedFileValue<TValue>;
  }

  private seasonYearById(bundle: KboDataBundle, seasonId: string) {
    return bundle.seasons.find((season) => season.seasonId === seasonId)?.year ?? null;
  }

  private currentSeasonYear(bundle: KboDataBundle) {
    const seasons = [...bundle.seasons].sort((left, right) => right.year - left.year);
    return seasons.find((season) => season.status === "ongoing")?.year ?? seasons[0]?.year ?? null;
  }

  private async loadLatestSeasonDatasetHandle(
    datasetName: "player-career-stats" | "player-game-stats" | "player-split-stats",
    seasonYear: number,
  ) {
    const keys = await this.normalizedRepository.listDatasetKeys(datasetName);
    const latestKey = keys
      .filter((item) => item.startsWith(`${seasonYear}-`))
      .sort()
      .at(-1);
    if (!latestKey) {
      return null;
    }

    const filePath = this.normalizedDatasetPath(datasetName, latestKey);
    const stat = await this.statFile(filePath);
    return {
      latestKey,
      mtimeMs: stat?.mtimeMs ?? null,
    };
  }

  private async loadSeasonPlayerDetails(seasonYear: number): Promise<CachedPlayerDetails> {
    const [careerStatsHandle, gameStatsHandle, splitStatsHandle] = await Promise.all([
      this.loadLatestSeasonDatasetHandle("player-career-stats", seasonYear),
      this.loadLatestSeasonDatasetHandle("player-game-stats", seasonYear),
      this.loadLatestSeasonDatasetHandle("player-split-stats", seasonYear),
    ]);
    const cached = this.playerDetailCache.get(seasonYear);
    const nextCareerStatsKey = careerStatsHandle?.latestKey ?? null;
    const nextCareerStatsMtimeMs = careerStatsHandle?.mtimeMs ?? null;
    const nextGameStatsKey = gameStatsHandle?.latestKey ?? null;
    const nextGameStatsMtimeMs = gameStatsHandle?.mtimeMs ?? null;
    const nextSplitStatsKey = splitStatsHandle?.latestKey ?? null;
    const nextSplitStatsMtimeMs = splitStatsHandle?.mtimeMs ?? null;

    if (
      cached &&
      cached.careerStatsKey === nextCareerStatsKey &&
      cached.careerStatsMtimeMs === nextCareerStatsMtimeMs &&
      cached.gameStatsKey === nextGameStatsKey &&
      cached.gameStatsMtimeMs === nextGameStatsMtimeMs &&
      cached.splitStatsKey === nextSplitStatsKey &&
      cached.splitStatsMtimeMs === nextSplitStatsMtimeMs
    ) {
      return cached;
    }

    const [normalizedCareerStats, normalizedGameStats, normalizedSplitStats] = await Promise.all([
      careerStatsHandle
        ? this.normalizedRepository.getDatasetOutput("player-career-stats", careerStatsHandle.latestKey)
        : Promise.resolve(null),
      gameStatsHandle
        ? this.normalizedRepository.getDatasetOutput("player-game-stats", gameStatsHandle.latestKey)
        : Promise.resolve(null),
      splitStatsHandle
        ? this.normalizedRepository.getDatasetOutput("player-split-stats", splitStatsHandle.latestKey)
        : Promise.resolve(null),
    ]);

    const nextCache = {
      careerStatsKey: nextCareerStatsKey,
      careerStatsMtimeMs: nextCareerStatsMtimeMs,
      gameStatsKey: nextGameStatsKey,
      gameStatsMtimeMs: nextGameStatsMtimeMs,
      splitStatsKey: nextSplitStatsKey,
      splitStatsMtimeMs: nextSplitStatsMtimeMs,
      playerCareerStats: (normalizedCareerStats as NormalizedPlayerCareerStats | null)?.rows ?? [],
      playerGameStats: (normalizedGameStats as NormalizedPlayerGameStats | null)?.rows ?? [],
      playerSplitStats: (normalizedSplitStats as NormalizedPlayerSplitStats | null)?.rows ?? [],
    } satisfies CachedPlayerDetails;

    this.playerDetailCache.set(seasonYear, nextCache);
    return nextCache;
  }

  private async attachSeasonPlayerDetails(bundle: KboDataBundle, seasonYears: number[]) {
    const uniqueYears = [...new Set(seasonYears)].filter((year): year is number => Number.isFinite(year));
    if (uniqueYears.length === 0) {
      return bundle;
    }

    const details = await Promise.all(
      uniqueYears.map(async (seasonYear) => {
        const season = bundle.seasons.find((item) => item.year === seasonYear);
        if (!season) {
          return null;
        }

        const seasonDetails = await this.loadSeasonPlayerDetails(seasonYear);
        return {
          seasonId: season.seasonId,
          playerGameStats: seasonDetails.playerGameStats,
          playerSplitStats: seasonDetails.playerSplitStats,
        };
      }),
    );

    const detailBySeasonId = new Map(
      details
        .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
        .map((detail) => [detail.seasonId, detail] as const),
    );
    if (detailBySeasonId.size === 0) {
      return bundle;
    }

    return {
      ...bundle,
      playerGameStats: [
        ...bundle.playerGameStats.filter((item) => !detailBySeasonId.has(item.seasonId)),
        ...details.flatMap((detail) => detail?.playerGameStats ?? []),
      ],
      playerSplitStats: [
        ...bundle.playerSplitStats.filter((item) => !detailBySeasonId.has(item.seasonId)),
        ...details.flatMap((detail) => detail?.playerSplitStats ?? []),
      ],
    };
  }

  private async loadBaseBundle(): Promise<KboDataBundle> {
    const publishedStat = await this.statFile(PUBLISHED_BUNDLE_PATH);
    if (publishedStat) {
      if (
        this.baseBundleCache &&
        this.baseBundleCache.sourcePath === PUBLISHED_BUNDLE_PATH &&
        this.baseBundleCache.mtimeMs === publishedStat.mtimeMs
      ) {
        return this.baseBundleCache.value;
      }

      const published = await loadPublishedKboBundle();
      if (published) {
        const sanitizedPublished = {
          ...published,
          playerGameStats: [],
          playerSplitStats: [],
        };
        this.baseBundleCache = {
          sourcePath: PUBLISHED_BUNDLE_PATH,
          mtimeMs: publishedStat.mtimeMs,
          value: sanitizedPublished,
        };
        return sanitizedPublished;
      }
    }

    if (kboSourceFeatureFlags.officialKboOnly) {
      throw new Error(
        "No published official KBO bundle is available. Run a live ingest first, for example `pnpm ingest:kbo:current`.",
      );
    }

    this.baseBundleCache = await this.loadCachedData(BUNDLE_PATH, kboDataBundleSchema.parse, this.baseBundleCache);
    return this.baseBundleCache.value;
  }

  private async loadManualAdjustments(): Promise<ManualAdjustmentBundle> {
    this.manualAdjustmentsCache = await this.loadCachedData(
      MANUAL_ADJUSTMENTS_PATH,
      manualAdjustmentBundleSchema.parse,
      this.manualAdjustmentsCache,
    );
    return this.manualAdjustmentsCache.value;
  }

  private async loadSchedulePatches(): Promise<SchedulePatchBundle> {
    this.schedulePatchesCache = await this.loadCachedData(
      SCHEDULE_PATCHES_PATH,
      schedulePatchBundleSchema.parse,
      this.schedulePatchesCache,
    );
    return this.schedulePatchesCache.value;
  }

  private async loadSeasonMetaPatches(): Promise<SeasonMetaPatchBundle> {
    this.seasonMetaPatchesCache = await this.loadCachedData(
      SEASON_META_PATCHES_PATH,
      seasonMetaPatchBundleSchema.parse,
      this.seasonMetaPatchesCache,
    );
    return this.seasonMetaPatchesCache.value;
  }

  private async loadTeamBrandPatches(): Promise<TeamBrandPatchBundle> {
    this.teamBrandPatchesCache = await this.loadCachedData(
      TEAM_BRAND_PATCHES_PATH,
      teamBrandPatchBundleSchema.parse,
      this.teamBrandPatchesCache,
    );
    return this.teamBrandPatchesCache.value;
  }

  private async createMemoryRepository(options: { detailSeasonYears?: number[] } = {}): Promise<MemoryKboRepository> {
    const [bundle, adjustments, schedulePatches, seasonMetaPatches, teamBrandPatches] = await Promise.all([
      this.loadBaseBundle(),
      this.loadManualAdjustments(),
      this.loadSchedulePatches(),
      this.loadSeasonMetaPatches(),
      this.loadTeamBrandPatches(),
    ]);
    const bundleWithPlayerDetails = options.detailSeasonYears?.length
      ? await this.attachSeasonPlayerDetails(bundle, options.detailSeasonYears)
      : bundle;
    return new MemoryKboRepository(
      bundleWithPlayerDetails,
      adjustments,
      schedulePatches,
      seasonMetaPatches,
      teamBrandPatches,
    );
  }

  async getBundle() {
    return (await this.createMemoryRepository()).getBundle();
  }

  async getManualAdjustments() {
    return (await this.createMemoryRepository()).getManualAdjustments();
  }

  async getSchedulePatches() {
    return (await this.createMemoryRepository()).getSchedulePatches();
  }

  async getSeasonMetaPatches() {
    return (await this.createMemoryRepository()).getSeasonMetaPatches();
  }

  async getTeamBrandPatches() {
    return (await this.createMemoryRepository()).getTeamBrandPatches();
  }

  async getCurrentSeason() {
    return (await this.createMemoryRepository()).getCurrentSeason();
  }

  async listSeasons() {
    return (await this.createMemoryRepository()).listSeasons();
  }

  async listArchiveSeasons() {
    return (await this.createMemoryRepository()).listArchiveSeasons();
  }

  async getSeasonByYear(year: number) {
    return (await this.createMemoryRepository()).getSeasonByYear(year);
  }

  async getSeasonContext(year: number) {
    return (await this.createMemoryRepository({ detailSeasonYears: [year] })).getSeasonContext(year);
  }

  async getFranchiseBySlug(teamSlug: string) {
    return (await this.createMemoryRepository()).getFranchiseBySlug(teamSlug);
  }

  async getGameContext(gameId: string) {
    const bundle = await this.loadBaseBundle();
    const game = bundle.games.find((item) => item.gameId === gameId);
    const seasonYear = game ? this.seasonYearById(bundle, game.seasonId) : null;
    return (await this.createMemoryRepository({ detailSeasonYears: seasonYear ? [seasonYear] : [] })).getGameContext(gameId);
  }

  async getPlayerContext(playerId: string) {
    const bundle = await this.loadBaseBundle();
    const detailSeasonYears = new Set<number>();

    for (const stat of bundle.playerSeasonStats.filter((item) => item.playerId === playerId)) {
      const seasonYear = this.seasonYearById(bundle, stat.seasonId);
      if (seasonYear !== null) {
        detailSeasonYears.add(seasonYear);
      }
    }

    const currentSeasonYear = this.currentSeasonYear(bundle);
    if (currentSeasonYear !== null) {
      detailSeasonYears.add(currentSeasonYear);
    }

    const repository = await this.createMemoryRepository({ detailSeasonYears: [...detailSeasonYears] });
    const playerContext = await repository.getPlayerContext(playerId);
    if (!playerContext) {
      return null;
    }

    const careerStats =
      currentSeasonYear !== null
        ? (await this.loadSeasonPlayerDetails(currentSeasonYear)).playerCareerStats.filter(
            (item) => item.playerId === playerId,
          )
        : [];

    return {
      ...playerContext,
      careerStats,
    };
  }

  async saveManualAdjustment(patch: ManualAdjustmentPatch) {
    const current = await this.loadManualAdjustments();
    const next = {
      updatedAt: patch.updatedAt,
      patches: [
        ...current.patches.filter((item) => item.seasonTeamId !== patch.seasonTeamId),
        patch,
      ],
    };
    await fs.writeFile(MANUAL_ADJUSTMENTS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async saveGameSchedulePatch(patch: GameSchedulePatch) {
    const current = await this.loadSchedulePatches();
    const next = {
      updatedAt: patch.updatedAt,
      patches: [
        ...current.patches.filter((item) => item.gameId !== patch.gameId),
        patch,
      ],
    };
    await fs.writeFile(SCHEDULE_PATCHES_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async saveSeasonMetaPatch(patch: SeasonMetaPatch) {
    const current = await this.loadSeasonMetaPatches();
    const next = {
      updatedAt: patch.updatedAt,
      patches: [
        ...current.patches.filter((item) => item.seasonId !== patch.seasonId),
        patch,
      ],
    };
    await fs.writeFile(SEASON_META_PATCHES_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async saveTeamBrandPatch(patch: TeamBrandPatch) {
    const current = await this.loadTeamBrandPatches();
    const next = {
      updatedAt: patch.updatedAt,
      patches: [
        ...current.patches.filter((item) => item.brandId !== patch.brandId),
        patch,
      ],
    };
    await fs.writeFile(TEAM_BRAND_PATCHES_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }
}
