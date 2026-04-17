import { z } from "zod";

export const historyTrainingTeamMetaSchema = z.object({
  teamKey: z.string(),
  franchiseId: z.string(),
  brandId: z.string().nullable(),
  brandLabel: z.string(),
  shortCode: z.string(),
});
export type HistoryTrainingTeamMeta = z.infer<typeof historyTrainingTeamMetaSchema>;

export const historyTrainingGameSchema = z.object({
  gameKey: z.string(),
  date: z.string(),
  scheduledAt: z.string(),
  homeFranchiseId: z.string(),
  awayFranchiseId: z.string(),
  homeBrandLabel: z.string(),
  awayBrandLabel: z.string(),
  venueName: z.string(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  innings: z.number().int().nullable(),
  isTie: z.boolean(),
  scheduleSeen: z.boolean(),
  scoreboardSeen: z.boolean(),
});
export type HistoryTrainingGame = z.infer<typeof historyTrainingGameSchema>;

export const historyTrainingTeamSnapshotSchema = z.object({
  teamKey: z.string(),
  franchiseId: z.string(),
  brandId: z.string().nullable(),
  brandLabel: z.string(),
  shortCode: z.string(),
  rank: z.number().int().positive(),
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  pct: z.number().nonnegative(),
  gamesBack: z.number().nonnegative(),
  recent10: z.string(),
  streak: z.string(),
  runsScored: z.number().int().nonnegative(),
  runsAllowed: z.number().int().nonnegative(),
  runDifferential: z.number().int(),
  homeWins: z.number().int().nonnegative(),
  homeLosses: z.number().int().nonnegative(),
  homeTies: z.number().int().nonnegative(),
  awayWins: z.number().int().nonnegative(),
  awayLosses: z.number().int().nonnegative(),
  awayTies: z.number().int().nonnegative(),
  remainingGames: z.number().int().nonnegative(),
  remainingHomeGames: z.number().int().nonnegative(),
  remainingAwayGames: z.number().int().nonnegative(),
  remainingByOpponent: z.record(z.number().int().nonnegative()),
  nextGameDate: z.string().nullable(),
  nextOpponentFranchiseId: z.string().nullable(),
  nextOpponentBrandLabel: z.string().nullable(),
  finalRank: z.number().int().positive(),
  finalWins: z.number().int().nonnegative(),
  finalLosses: z.number().int().nonnegative(),
  finalTies: z.number().int().nonnegative(),
  winsRemainingToFinal: z.number().int(),
  lossesRemainingToFinal: z.number().int(),
  tiesRemainingToFinal: z.number().int(),
});
export type HistoryTrainingTeamSnapshot = z.infer<typeof historyTrainingTeamSnapshotSchema>;

export const historyTrainingDailySnapshotSchema = z.object({
  asOfDate: z.string(),
  completedGames: z.number().int().nonnegative(),
  remainingGames: z.number().int().nonnegative(),
  teams: z.array(historyTrainingTeamSnapshotSchema),
});
export type HistoryTrainingDailySnapshot = z.infer<typeof historyTrainingDailySnapshotSchema>;

export const historyTrainingSeasonSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  year: z.number().int(),
  teamCount: z.number().int().positive(),
  scheduledGameCount: z.number().int().nonnegative(),
  completedGameCount: z.number().int().nonnegative(),
  scheduleSnapshotCount: z.number().int().nonnegative(),
  scoreboardSnapshotCount: z.number().int().nonnegative(),
  historicalRecordSnapshotKey: z.string(),
  teams: z.array(historyTrainingTeamMetaSchema),
  gameLedger: z.array(historyTrainingGameSchema),
  snapshots: z.array(historyTrainingDailySnapshotSchema),
});
export type HistoryTrainingSeason = z.infer<typeof historyTrainingSeasonSchema>;
