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
  SchedulePatchBundle,
  SeasonMetaPatch,
  SeasonMetaPatchBundle,
  TeamBrandPatch,
  TeamBrandPatchBundle,
} from "@/lib/domain/kbo/types";
import { kboSourceFeatureFlags } from "@/lib/data-sources/kbo/dataset-types";
import type { KboRepository } from "@/lib/repositories/kbo/contracts";
import { MemoryKboRepository } from "@/lib/repositories/kbo/memory-adapter";
import {
  FIXTURE_SOURCE_BUNDLE_PATH,
  loadPublishedKboBundle,
} from "@/lib/repositories/kbo/published-bundle";

const BUNDLE_PATH = FIXTURE_SOURCE_BUNDLE_PATH;
const MANUAL_ADJUSTMENTS_PATH = path.join(process.cwd(), "data", "kbo", "manual-adjustments.json");
const SCHEDULE_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "schedule-patches.json");
const SEASON_META_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "season-meta-patches.json");
const TEAM_BRAND_PATCHES_PATH = path.join(process.cwd(), "data", "kbo", "team-brand-patches.json");

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

export class FileKboRepository implements KboRepository {
  private async loadBaseBundle(): Promise<KboDataBundle> {
    const published = await loadPublishedKboBundle();
    if (published) {
      return published;
    }

    if (kboSourceFeatureFlags.officialKboOnly) {
      throw new Error(
        "No published official KBO bundle is available. Run a live ingest first, for example `pnpm ingest:kbo:current`.",
      );
    }

    const raw = await readJsonFile(BUNDLE_PATH);
    return kboDataBundleSchema.parse(raw);
  }

  private async loadManualAdjustments(): Promise<ManualAdjustmentBundle> {
    const raw = await readJsonFile(MANUAL_ADJUSTMENTS_PATH);
    return manualAdjustmentBundleSchema.parse(raw);
  }

  private async loadSchedulePatches(): Promise<SchedulePatchBundle> {
    const raw = await readJsonFile(SCHEDULE_PATCHES_PATH);
    return schedulePatchBundleSchema.parse(raw);
  }

  private async loadSeasonMetaPatches(): Promise<SeasonMetaPatchBundle> {
    const raw = await readJsonFile(SEASON_META_PATCHES_PATH);
    return seasonMetaPatchBundleSchema.parse(raw);
  }

  private async loadTeamBrandPatches(): Promise<TeamBrandPatchBundle> {
    const raw = await readJsonFile(TEAM_BRAND_PATCHES_PATH);
    return teamBrandPatchBundleSchema.parse(raw);
  }

  private async createMemoryRepository(): Promise<MemoryKboRepository> {
    const [bundle, adjustments, schedulePatches, seasonMetaPatches, teamBrandPatches] = await Promise.all([
      this.loadBaseBundle(),
      this.loadManualAdjustments(),
      this.loadSchedulePatches(),
      this.loadSeasonMetaPatches(),
      this.loadTeamBrandPatches(),
    ]);
    return new MemoryKboRepository(
      bundle,
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
    return (await this.createMemoryRepository()).getSeasonContext(year);
  }

  async getFranchiseBySlug(teamSlug: string) {
    return (await this.createMemoryRepository()).getFranchiseBySlug(teamSlug);
  }

  async getGameContext(gameId: string) {
    return (await this.createMemoryRepository()).getGameContext(gameId);
  }

  async getPlayerContext(playerId: string) {
    return (await this.createMemoryRepository()).getPlayerContext(playerId);
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
