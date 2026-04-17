import type { TeamSeasonStat } from "@/lib/domain/kbo/types";
import type {
  GameOutcomeTrainingExample,
  TrainingCorpusSeason,
} from "@/lib/data-sources/kbo/training-corpus-types";

type TrainingLikeGame = {
  sampleId: string;
  year: number;
  scheduledAt: string;
  gameKey: string;
  homeFranchiseId: string;
  awayFranchiseId: string;
  homeWin: boolean;
  awayWin: boolean;
  tie: boolean;
};

type RuntimeLikeGame = {
  gameId: string;
  scheduledAt: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  isTie: boolean;
};

export type DirectGameEloConfig = {
  baseRating: number;
  kFactor: number;
  homeFieldAdvantage: number;
  offseasonCarry: number;
  previousSeasonPctScale: number;
};

export const DEFAULT_DIRECT_GAME_ELO_CONFIG: DirectGameEloConfig = {
  baseRating: 1500,
  kFactor: 24,
  homeFieldAdvantage: 35,
  offseasonCarry: 0.72,
  previousSeasonPctScale: 400,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseFranchiseIdFromSeasonTeamId(seasonTeamId: string) {
  const parts = seasonTeamId.split(":");
  return parts.at(-1) ?? seasonTeamId;
}

function sortByScheduledAt<T extends { scheduledAt: string }>(left: T, right: T) {
  return left.scheduledAt.localeCompare(right.scheduledAt);
}

function buildPregameExpectedHomeWin(
  homeRating: number,
  awayRating: number,
  config: DirectGameEloConfig,
) {
  return 1 / (1 + 10 ** ((awayRating - (homeRating + config.homeFieldAdvantage)) / 400));
}

function buildActualHomeScore(game: Pick<TrainingLikeGame, "homeWin" | "awayWin" | "tie">) {
  if (game.tie) {
    return 0.5;
  }
  return game.homeWin ? 1 : 0;
}

function regressRatingsForNewSeason(
  ratings: Map<string, number>,
  config: DirectGameEloConfig,
) {
  for (const [franchiseId, rating] of ratings.entries()) {
    const regressed =
      config.baseRating + (rating - config.baseRating) * config.offseasonCarry;
    ratings.set(franchiseId, Number(regressed.toFixed(6)));
  }
}

function seedRatingsFromPreviousSeasonStats(
  previousSeasonStats: TeamSeasonStat[] | undefined,
  config: DirectGameEloConfig,
) {
  const seeded = new Map<string, number>();

  for (const stat of previousSeasonStats ?? []) {
    const games = stat.wins + stat.losses + stat.ties;
    const pct = games > 0 ? (stat.wins + stat.ties * 0.5) / games : 0.5;
    const franchiseId = parseFranchiseIdFromSeasonTeamId(stat.seasonTeamId);
    const rating =
      config.baseRating + (pct - 0.5) * config.previousSeasonPctScale;
    seeded.set(franchiseId, Number(clamp(rating, 1350, 1650).toFixed(6)));
  }

  return seeded;
}

export function buildPregameEloDiffBySampleId(
  seasons: TrainingCorpusSeason[],
  config: DirectGameEloConfig = DEFAULT_DIRECT_GAME_ELO_CONFIG,
) {
  const orderedGames: TrainingLikeGame[] = seasons
    .flatMap((season) =>
      season.gameExamples.map((game) => ({
        sampleId: game.sampleId,
        year: game.year,
        scheduledAt: game.scheduledAt,
        gameKey: game.gameKey,
        homeFranchiseId: game.homeFranchiseId,
        awayFranchiseId: game.awayFranchiseId,
        homeWin: game.homeWin,
        awayWin: game.awayWin,
        tie: game.tie,
      })),
    )
    .sort((left, right) =>
      sortByScheduledAt(left, right) || left.gameKey.localeCompare(right.gameKey),
    );

  const ratings = new Map<string, number>();
  const diffBySampleId: Record<string, number> = {};
  let currentYear: number | null = null;

  for (const game of orderedGames) {
    if (currentYear !== null && currentYear !== game.year) {
      regressRatingsForNewSeason(ratings, config);
    }
    currentYear = game.year;

    const homeRating = ratings.get(game.homeFranchiseId) ?? config.baseRating;
    const awayRating = ratings.get(game.awayFranchiseId) ?? config.baseRating;
    diffBySampleId[game.sampleId] = Number((homeRating - awayRating).toFixed(6));

    const expectedHome = buildPregameExpectedHomeWin(homeRating, awayRating, config);
    const actualHome = buildActualHomeScore(game);
    const delta = config.kFactor * (actualHome - expectedHome);

    ratings.set(game.homeFranchiseId, Number((homeRating + delta).toFixed(6)));
    ratings.set(game.awayFranchiseId, Number((awayRating - delta).toFixed(6)));
  }

  return diffBySampleId;
}

export function buildPregameEloDiffByGameId(args: {
  games: RuntimeLikeGame[];
  previousSeasonStats?: TeamSeasonStat[];
  config?: DirectGameEloConfig;
}) {
  const config = args.config ?? DEFAULT_DIRECT_GAME_ELO_CONFIG;
  const ratings = seedRatingsFromPreviousSeasonStats(args.previousSeasonStats, config);
  const diffByGameId: Record<string, number> = {};
  const orderedGames = [...args.games].sort((left, right) =>
    sortByScheduledAt(left, right) || left.gameId.localeCompare(right.gameId),
  );

  for (const game of orderedGames) {
    const homeFranchiseId = parseFranchiseIdFromSeasonTeamId(game.homeSeasonTeamId);
    const awayFranchiseId = parseFranchiseIdFromSeasonTeamId(game.awaySeasonTeamId);
    const homeRating = ratings.get(homeFranchiseId) ?? config.baseRating;
    const awayRating = ratings.get(awayFranchiseId) ?? config.baseRating;
    diffByGameId[game.gameId] = Number((homeRating - awayRating).toFixed(6));

    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) {
      continue;
    }

    const expectedHome = buildPregameExpectedHomeWin(homeRating, awayRating, config);
    const actualHome =
      game.isTie ? 0.5 : game.homeScore > game.awayScore ? 1 : 0;
    const delta = config.kFactor * (actualHome - expectedHome);
    ratings.set(homeFranchiseId, Number((homeRating + delta).toFixed(6)));
    ratings.set(awayFranchiseId, Number((awayRating - delta).toFixed(6)));
  }

  return diffByGameId;
}

export function buildBinaryHomeWinTarget(example: {
  homeWin: boolean;
  awayWin: boolean;
  tie: boolean;
}) {
  if (example.tie) {
    return null;
  }
  return example.homeWin ? 1 : 0;
}
