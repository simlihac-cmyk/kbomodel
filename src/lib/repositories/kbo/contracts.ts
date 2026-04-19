import type {
  Franchise,
  Game,
  GameSchedulePatch,
  GameBoxScore,
  KboDataBundle,
  KboSeasonRuleset,
  ManualAdjustmentBundle,
  ManualAdjustmentPatch,
  Player,
  PlayerCareerStat,
  PlayerGameStat,
  PlayerSplitStat,
  PlayerSeasonStat,
  PostseasonResult,
  RosterEvent,
  SchedulePatchBundle,
  Season,
  SeasonMetaPatch,
  SeasonMetaPatchBundle,
  SeasonSummary,
  SeasonTeam,
  Series,
  TeamDisplay,
  TeamBrandPatch,
  TeamBrandPatchBundle,
  TeamSeasonStat,
  TeamSplitStat,
  Venue,
} from "@/lib/domain/kbo/types";
import type {
  DatasetId,
  ManualSourcePatchBundle,
  NormalizedDatasetFileName,
  NormalizedDatasetOutputMap,
  RawSourceSnapshot,
  RawSourceSnapshotMetadata,
  SourceId,
} from "@/lib/data-sources/kbo/dataset-types";

export type SeasonContext = {
  season: Season;
  ruleset: KboSeasonRuleset;
  seasonTeams: SeasonTeam[];
  teamDisplays: TeamDisplay[];
  venues: Venue[];
  series: Series[];
  games: Game[];
  teamSeasonStats: TeamSeasonStat[];
  teamSplitStats: TeamSplitStat[];
  players: Player[];
  rosterEvents: RosterEvent[];
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  playerSplitStats: PlayerSplitStat[];
  summary: SeasonSummary | null;
  postseasonResults: PostseasonResult[];
};

export type GameContext = {
  game: Game;
  series: Series | null;
  boxScore: GameBoxScore | null;
  relatedPlayerStats: PlayerGameStat[];
};

export type PlayerContext = {
  player: Player;
  seasonStats: PlayerSeasonStat[];
  careerStats: PlayerCareerStat[];
  gameStats: PlayerGameStat[];
  splitStats: PlayerSplitStat[];
};

export type FranchiseContext = {
  franchise: Franchise;
  brands: { brandId: string; displayNameKo: string; seasonStartYear: number; seasonEndYear: number | null }[];
  seasons: {
    year: number;
    seasonTeamId: string;
    brandId: string;
    wins: number;
    losses: number;
    ties: number;
  }[];
};

export interface KboRepository {
  getBundle(): Promise<KboDataBundle>;
  getManualAdjustments(): Promise<ManualAdjustmentBundle>;
  getSchedulePatches(): Promise<SchedulePatchBundle>;
  getSeasonMetaPatches(): Promise<SeasonMetaPatchBundle>;
  getTeamBrandPatches(): Promise<TeamBrandPatchBundle>;
  getCurrentSeason(): Promise<Season>;
  listSeasons(): Promise<Season[]>;
  listArchiveSeasons(): Promise<Season[]>;
  getSeasonByYear(year: number): Promise<Season | null>;
  getSeasonContext(year: number): Promise<SeasonContext | null>;
  getFranchiseBySlug(teamSlug: string): Promise<FranchiseContext | null>;
  getGameContext(gameId: string): Promise<GameContext | null>;
  getPlayerContext(playerId: string): Promise<PlayerContext | null>;
  saveManualAdjustment(patch: ManualAdjustmentPatch): Promise<ManualAdjustmentBundle>;
  saveGameSchedulePatch(patch: GameSchedulePatch): Promise<SchedulePatchBundle>;
  saveSeasonMetaPatch(patch: SeasonMetaPatch): Promise<SeasonMetaPatchBundle>;
  saveTeamBrandPatch(patch: TeamBrandPatch): Promise<TeamBrandPatchBundle>;
}

export interface RawSourceRepository {
  saveSnapshot(snapshot: RawSourceSnapshot): Promise<RawSourceSnapshotMetadata>;
  getSnapshot(sourceId: SourceId, datasetId: DatasetId, snapshotKey: string): Promise<RawSourceSnapshot | null>;
  getLatestSnapshot(sourceId: SourceId, datasetId: DatasetId): Promise<RawSourceSnapshot | null>;
  listSnapshotMetadata(sourceId: SourceId, datasetId: DatasetId): Promise<RawSourceSnapshotMetadata[]>;
}

export interface NormalizedKboSourceRepository {
  saveDatasetOutput<TDataset extends NormalizedDatasetFileName>(
    datasetName: TDataset,
    snapshotKey: string,
    payload: NormalizedDatasetOutputMap[TDataset],
  ): Promise<void>;
  getDatasetOutput<TDataset extends NormalizedDatasetFileName>(
    datasetName: TDataset,
    snapshotKey: string,
  ): Promise<NormalizedDatasetOutputMap[TDataset] | null>;
  listDatasetKeys(datasetName: NormalizedDatasetFileName): Promise<string[]>;
}

export interface KboIngestPatchRepository {
  getManualSourcePatches(): Promise<ManualSourcePatchBundle>;
}
