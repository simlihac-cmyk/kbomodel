import type {
  GameSchedulePatch,
  KboDataBundle,
  ManualAdjustmentBundle,
  ManualAdjustmentPatch,
  SchedulePatchBundle,
  Season,
  SeasonMetaPatch,
  SeasonMetaPatchBundle,
  TeamBrand,
  TeamBrandPatch,
  TeamBrandPatchBundle,
  TeamSeasonStat,
} from "@/lib/domain/kbo/types";
import type {
  FranchiseContext,
  GameContext,
  KboRepository,
  PlayerContext,
  SeasonContext,
} from "@/lib/repositories/kbo/contracts";
import { normalizeTeamSlug } from "@/lib/utils/routes";

function buildTeamDisplays(bundle: KboDataBundle, seasonYear: number) {
  const season = bundle.seasons.find((item) => item.year === seasonYear);
  if (!season) {
    return [];
  }

  const brandsById = Object.fromEntries(bundle.teamBrands.map((brand) => [brand.brandId, brand]));
  const franchisesById = Object.fromEntries(bundle.franchises.map((franchise) => [franchise.franchiseId, franchise]));

  return bundle.seasonTeams
    .filter((seasonTeam) => seasonTeam.seasonId === season.seasonId)
    .map((seasonTeam) => {
      const brand = brandsById[seasonTeam.brandId] as TeamBrand;
      const franchise = franchisesById[seasonTeam.franchiseId];
      return {
        seasonTeamId: seasonTeam.seasonTeamId,
        brandId: seasonTeam.brandId,
        franchiseId: seasonTeam.franchiseId,
        teamSlug: normalizeTeamSlug(franchise.slug),
        displayNameKo: brand.displayNameKo,
        shortNameKo: brand.shortNameKo,
        shortCode: brand.shortCode,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
      };
    });
}

function mergeManualAdjustments(
  bundle: KboDataBundle,
  adjustments: ManualAdjustmentBundle,
): KboDataBundle {
  const patchBySeasonTeam = Object.fromEntries(
    adjustments.patches.map((patch) => [patch.seasonTeamId, patch]),
  );

  return {
    ...bundle,
    seasonTeams: bundle.seasonTeams.map((seasonTeam) => {
      const patch = patchBySeasonTeam[seasonTeam.seasonTeamId];
      if (!patch) {
        return seasonTeam;
      }

      return {
        ...seasonTeam,
        manualAdjustments: [
          ...seasonTeam.manualAdjustments.filter((item) => item.note !== patch.note),
          {
            offenseDelta: patch.offenseDelta,
            starterDelta: patch.starterDelta,
            bullpenDelta: patch.bullpenDelta,
            confidenceDelta: patch.confidenceDelta,
            note: patch.note,
          },
        ],
      };
    }),
  };
}

function mergeSchedulePatches(
  bundle: KboDataBundle,
  schedulePatches: SchedulePatchBundle,
): KboDataBundle {
  const patchByGameId = Object.fromEntries(
    schedulePatches.patches.map((patch) => [patch.gameId, patch]),
  );

  return {
    ...bundle,
    games: bundle.games.map((game) => {
      const patch = patchByGameId[game.gameId];
      if (!patch) {
        return game;
      }

      return {
        ...game,
        status: patch.status,
        scheduledAt: patch.scheduledAt,
        note: patch.note,
        homeScore: patch.homeScore,
        awayScore: patch.awayScore,
        innings:
          patch.status === "final" && patch.homeScore !== null && patch.awayScore !== null
            ? game.innings ?? 9
            : null,
        isTie:
          patch.status === "final" &&
          patch.homeScore !== null &&
          patch.awayScore !== null &&
          patch.homeScore === patch.awayScore,
        attendance:
          patch.status === "final" && game.attendance === null
            ? 12000
            : game.attendance,
      };
    }),
  };
}

function mergeSeasonMetaPatches(
  bundle: KboDataBundle,
  seasonMetaPatches: SeasonMetaPatchBundle,
): KboDataBundle {
  const patchBySeasonId = Object.fromEntries(
    seasonMetaPatches.patches.map((patch) => [patch.seasonId, patch]),
  );

  return {
    ...bundle,
    seasons: bundle.seasons.map((season) => {
      const patch = patchBySeasonId[season.seasonId];
      return patch
        ? {
            ...season,
            label: patch.label,
            status: patch.status,
            phase: patch.phase,
            rulesetId: patch.rulesetId,
            updatedAt: patch.updatedAt,
          }
        : season;
    }),
  };
}

function mergeTeamBrandPatches(
  bundle: KboDataBundle,
  teamBrandPatches: TeamBrandPatchBundle,
): KboDataBundle {
  const patchByBrandId = Object.fromEntries(
    teamBrandPatches.patches.map((patch) => [patch.brandId, patch]),
  );

  return {
    ...bundle,
    teamBrands: bundle.teamBrands.map((brand) => {
      const patch = patchByBrandId[brand.brandId];
      return patch
        ? {
            ...brand,
            displayNameKo: patch.displayNameKo,
            shortNameKo: patch.shortNameKo,
            shortCode: patch.shortCode,
            primaryColor: patch.primaryColor,
            secondaryColor: patch.secondaryColor,
            wordmarkText: patch.wordmarkText,
          }
        : brand;
    }),
  };
}

export class MemoryKboRepository implements KboRepository {
  constructor(
    private readonly baseBundle: KboDataBundle,
    private manualAdjustmentBundle: ManualAdjustmentBundle,
    private schedulePatchBundle: SchedulePatchBundle,
    private seasonMetaPatchBundle: SeasonMetaPatchBundle,
    private teamBrandPatchBundle: TeamBrandPatchBundle,
  ) {}

  async getBundle(): Promise<KboDataBundle> {
    return mergeSchedulePatches(
      mergeManualAdjustments(
        mergeTeamBrandPatches(
          mergeSeasonMetaPatches(this.baseBundle, this.seasonMetaPatchBundle),
          this.teamBrandPatchBundle,
        ),
        this.manualAdjustmentBundle,
      ),
      this.schedulePatchBundle,
    );
  }

  async getManualAdjustments(): Promise<ManualAdjustmentBundle> {
    return this.manualAdjustmentBundle;
  }

  async getSchedulePatches(): Promise<SchedulePatchBundle> {
    return this.schedulePatchBundle;
  }

  async getSeasonMetaPatches(): Promise<SeasonMetaPatchBundle> {
    return this.seasonMetaPatchBundle;
  }

  async getTeamBrandPatches(): Promise<TeamBrandPatchBundle> {
    return this.teamBrandPatchBundle;
  }

  async getCurrentSeason(): Promise<Season> {
    const seasons = [...this.baseBundle.seasons].sort((left, right) => right.year - left.year);
    const ongoing = seasons.find((season) => season.status === "ongoing");
    return ongoing ?? seasons[0];
  }

  async listSeasons(): Promise<Season[]> {
    return [...this.baseBundle.seasons].sort((left, right) => right.year - left.year);
  }

  async listArchiveSeasons(): Promise<Season[]> {
    return [...this.baseBundle.seasons]
      .filter((season) => season.status === "completed")
      .sort((left, right) => right.year - left.year);
  }

  async getSeasonByYear(year: number): Promise<Season | null> {
    return this.baseBundle.seasons.find((season) => season.year === year) ?? null;
  }

  async getSeasonContext(year: number): Promise<SeasonContext | null> {
    const bundle = await this.getBundle();
    const season = bundle.seasons.find((item) => item.year === year);
    if (!season) {
      return null;
    }

    return {
      season,
      ruleset: bundle.rulesets.find((ruleset) => ruleset.rulesetId === season.rulesetId)!,
      seasonTeams: bundle.seasonTeams.filter((item) => item.seasonId === season.seasonId),
      teamDisplays: buildTeamDisplays(bundle, year),
      venues: bundle.venues,
      series: bundle.series.filter((item) => item.seasonId === season.seasonId),
      games: bundle.games.filter((item) => item.seasonId === season.seasonId),
      teamSeasonStats: bundle.teamSeasonStats.filter((item) => item.seasonId === season.seasonId),
      teamSplitStats: bundle.teamSplitStats.filter((item) => item.seasonId === season.seasonId),
      players: bundle.players,
      rosterEvents: bundle.rosterEvents.filter((item) => item.seasonId === season.seasonId),
      playerSeasonStats: bundle.playerSeasonStats.filter((item) => item.seasonId === season.seasonId),
      playerGameStats: bundle.playerGameStats.filter((item) => item.seasonId === season.seasonId),
      playerSplitStats: bundle.playerSplitStats.filter((item) => item.seasonId === season.seasonId),
      summary: bundle.seasonSummaries.find((item) => item.seasonId === season.seasonId) ?? null,
      postseasonResults: bundle.postseasonResults.filter((item) => item.seasonId === season.seasonId),
    };
  }

  async getFranchiseBySlug(teamSlug: string): Promise<FranchiseContext | null> {
    const bundle = await this.getBundle();
    const franchise = bundle.franchises.find(
      (item) => normalizeTeamSlug(item.slug) === normalizeTeamSlug(teamSlug),
    );
    if (!franchise) {
      return null;
    }

    const brandIds = bundle.teamBrands.filter((brand) => brand.franchiseId === franchise.franchiseId);
    const seasonTeamStatsById = Object.fromEntries(
      bundle.teamSeasonStats.map((item) => [item.seasonTeamId, item] satisfies [string, TeamSeasonStat]),
    );

    return {
      franchise,
      brands: brandIds.map((brand) => ({
        brandId: brand.brandId,
        displayNameKo: brand.displayNameKo,
        seasonStartYear: brand.seasonStartYear,
        seasonEndYear: brand.seasonEndYear,
      })),
      seasons: bundle.seasonTeams
        .filter((seasonTeam) => seasonTeam.franchiseId === franchise.franchiseId)
        .map((seasonTeam) => {
          const season = bundle.seasons.find((item) => item.seasonId === seasonTeam.seasonId)!;
          const stat = seasonTeamStatsById[seasonTeam.seasonTeamId];
          return {
            year: season.year,
            seasonTeamId: seasonTeam.seasonTeamId,
            brandId: seasonTeam.brandId,
            wins: stat?.wins ?? 0,
            losses: stat?.losses ?? 0,
            ties: stat?.ties ?? 0,
          };
        })
        .sort((left, right) => right.year - left.year),
    };
  }

  async getGameContext(gameId: string): Promise<GameContext | null> {
    const bundle = await this.getBundle();
    const game = bundle.games.find((item) => item.gameId === gameId);
    if (!game) {
      return null;
    }

    return {
      game,
      series: bundle.series.find((item) => item.seriesId === game.seriesId) ?? null,
      boxScore: bundle.gameBoxScores.find((item) => item.gameId === gameId) ?? null,
      relatedPlayerStats: bundle.playerGameStats.filter((item) => item.gameId === gameId),
    };
  }

  async getPlayerContext(playerId: string): Promise<PlayerContext | null> {
    const bundle = await this.getBundle();
    const player = bundle.players.find((item) => item.playerId === playerId);
    if (!player) {
      return null;
    }

    return {
      player,
      seasonStats: bundle.playerSeasonStats.filter((item) => item.playerId === playerId),
      gameStats: bundle.playerGameStats.filter((item) => item.playerId === playerId),
      splitStats: bundle.playerSplitStats.filter((item) => item.playerId === playerId),
    };
  }

  async saveManualAdjustment(patch: ManualAdjustmentPatch): Promise<ManualAdjustmentBundle> {
    const remaining = this.manualAdjustmentBundle.patches.filter(
      (item) => item.seasonTeamId !== patch.seasonTeamId,
    );
    this.manualAdjustmentBundle = {
      updatedAt: patch.updatedAt,
      patches: [...remaining, patch],
    };
    return this.manualAdjustmentBundle;
  }

  async saveGameSchedulePatch(patch: GameSchedulePatch): Promise<SchedulePatchBundle> {
    const remaining = this.schedulePatchBundle.patches.filter(
      (item) => item.gameId !== patch.gameId,
    );
    this.schedulePatchBundle = {
      updatedAt: patch.updatedAt,
      patches: [...remaining, patch],
    };
    return this.schedulePatchBundle;
  }

  async saveSeasonMetaPatch(patch: SeasonMetaPatch): Promise<SeasonMetaPatchBundle> {
    const remaining = this.seasonMetaPatchBundle.patches.filter(
      (item) => item.seasonId !== patch.seasonId,
    );
    this.seasonMetaPatchBundle = {
      updatedAt: patch.updatedAt,
      patches: [...remaining, patch],
    };
    return this.seasonMetaPatchBundle;
  }

  async saveTeamBrandPatch(patch: TeamBrandPatch): Promise<TeamBrandPatchBundle> {
    const remaining = this.teamBrandPatchBundle.patches.filter(
      (item) => item.brandId !== patch.brandId,
    );
    this.teamBrandPatchBundle = {
      updatedAt: patch.updatedAt,
      patches: [...remaining, patch],
    };
    return this.teamBrandPatchBundle;
  }
}
