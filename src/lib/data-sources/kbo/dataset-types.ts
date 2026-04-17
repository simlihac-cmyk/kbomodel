import { z } from "zod";

import {
  franchiseSchema,
  gameBoxScoreSchema,
  gameSchema,
  playerSchema,
  playerGameStatSchema,
  playerSplitStatSchema,
  playerSeasonStatSchema,
  rosterEventSchema,
  rulesetSchema,
  seriesSchema,
  teamBrandSchema,
} from "@/lib/domain/kbo/schemas";
import type { GameStatus, RosterEventType, TiebreakerKey } from "@/lib/domain/kbo/types";

export const sourceIdSchema = z.enum(["official-kbo-ko", "official-kbo-en", "statiz"]);
export type SourceId = z.infer<typeof sourceIdSchema>;

export const datasetIdSchema = z.enum([
  "schedule-calendar",
  "scoreboard",
  "standings",
  "batting-top5",
  "pitching-top5",
  "player-summary-hitter",
  "player-summary-pitcher",
  "player-game-logs-hitter",
  "player-game-logs-pitcher",
  "player-splits-month-hitter",
  "player-splits-month-pitcher",
  "player-situations-hitter",
  "player-situations-pitcher",
  "player-situations-count-hitter",
  "player-situations-count-pitcher",
  "player-situations-runner-hitter",
  "player-situations-runner-pitcher",
  "player-situations-out-hitter",
  "player-situations-out-pitcher",
  "player-situations-inning-hitter",
  "player-situations-inning-pitcher",
  "player-situations-batting-order-hitter",
  "player-situations-batting-order-pitcher",
  "player-register",
  "player-register-all",
  "roster-movement",
  "historical-team-record",
  "team-history",
  "team-hitter",
  "team-pitcher",
  "rules",
  "weather",
  "player-search",
  "team-information",
  "statiz-team-stats",
  "statiz-player-stats",
  "statiz-war",
]);
export type DatasetId = z.infer<typeof datasetIdSchema>;

export const normalizedDatasetFileNameSchema = z.enum([
  "series-games",
  "scoreboard",
  "standings",
  "players",
  "player-season-stats",
  "player-game-stats",
  "player-split-stats",
  "roster-events",
  "franchise-lineage",
  "historical-team-records",
  "team-hitter-stats",
  "team-pitcher-stats",
  "rulesets",
]);
export type NormalizedDatasetFileName = z.infer<typeof normalizedDatasetFileNameSchema>;

export const fetchStrategySchema = z.enum(["html"]);
export type FetchStrategy = z.infer<typeof fetchStrategySchema>;

export const sourceTrustTierSchema = z.enum(["official-baseline", "official-mirror", "optional-enrichment"]);
export type SourceTrustTier = z.infer<typeof sourceTrustTierSchema>;

export const kboSourceFeatureFlags = {
  officialKboOnly: process.env.OFFICIAL_KBO_ONLY !== "false",
  enableStatizEnrichment: process.env.ENABLE_STATIZ_ENRICHMENT === "true",
} as const;

export const rawSourceSnapshotMetadataSchema = z.object({
  sourceId: sourceIdSchema,
  datasetId: datasetIdSchema,
  snapshotKey: z.string(),
  fetchedAt: z.string(),
  sourceUrl: z.string().url(),
  httpStatus: z.number().int(),
  checksum: z.string(),
  parserVersion: z.string(),
  fixtureBacked: z.boolean(),
});
export type RawSourceSnapshotMetadata = z.infer<typeof rawSourceSnapshotMetadataSchema>;

export const rawSourceSnapshotSchema = rawSourceSnapshotMetadataSchema.extend({
  html: z.string(),
});
export type RawSourceSnapshot = z.infer<typeof rawSourceSnapshotSchema>;

export const normalizedSourceReferenceSchema = z.object({
  sourceId: sourceIdSchema,
  datasetId: datasetIdSchema,
  snapshotKey: z.string(),
  parserVersion: z.string(),
});
export type NormalizedSourceReference = z.infer<typeof normalizedSourceReferenceSchema>;

export const parsedScheduleRowSchema = z.object({
  sourceGameKey: z.string(),
  date: z.string(),
  scheduledAt: z.string(),
  gameTimeLabel: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  venueName: z.string(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
  note: z.string().nullable(),
  detailPath: z.string().nullable(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  innings: z.number().int().nullable(),
  isTie: z.boolean(),
});
export type ParsedScheduleRow = z.infer<typeof parsedScheduleRowSchema>;

export const parsedScoreboardLineSchema = z.object({
  inning: z.number().int().positive(),
  away: z.number().int(),
  home: z.number().int(),
});
export type ParsedScoreboardLine = z.infer<typeof parsedScoreboardLineSchema>;

export const parsedScoreboardRowSchema = parsedScheduleRowSchema.extend({
  lineScore: z.array(parsedScoreboardLineSchema),
  winningPitcherName: z.string().nullable(),
  losingPitcherName: z.string().nullable(),
  savePitcherName: z.string().nullable(),
  attendance: z.number().int().nullable(),
});
export type ParsedScoreboardRow = z.infer<typeof parsedScoreboardRowSchema>;

export const parsedStandingsRowSchema = z.object({
  rank: z.number().int().positive(),
  teamName: z.string(),
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  winPct: z.number().nonnegative(),
  gamesBehind: z.number().nonnegative(),
  last10: z.string(),
  streak: z.string(),
  homeRecord: z.string(),
  awayRecord: z.string(),
  runsScored: z.number().int().nullable(),
  runsAllowed: z.number().int().nullable(),
});
export type ParsedStandingsRow = z.infer<typeof parsedStandingsRowSchema>;

export const parsedPlayerRegisterRowSchema = z.object({
  teamName: z.string(),
  playerName: z.string(),
  position: z.string().nullable(),
  backNumber: z.string().nullable(),
  statusLabel: z.string().nullable(),
});
export type ParsedPlayerRegisterRow = z.infer<typeof parsedPlayerRegisterRowSchema>;

export const parsedRosterMovementRowSchema = z.object({
  movementId: z.string(),
  date: z.string(),
  teamName: z.string(),
  playerName: z.string(),
  eventType: z.enum(["joined", "activated", "injured", "transferred", "released"]),
  note: z.string(),
});
export type ParsedRosterMovementRow = z.infer<typeof parsedRosterMovementRowSchema>;

export const parsedHistoricalTeamRecordRowSchema = z.object({
  year: z.number().int(),
  teamName: z.string(),
  rank: z.number().int().positive(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  postseasonResult: z.string().nullable(),
});
export type ParsedHistoricalTeamRecordRow = z.infer<typeof parsedHistoricalTeamRecordRowSchema>;

export const parsedTeamHitterStatRowSchema = z.object({
  rank: z.number().int().positive(),
  teamName: z.string(),
  avg: z.number().nonnegative(),
  games: z.number().int().nonnegative(),
  plateAppearances: z.number().int().nonnegative(),
  atBats: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  totalBases: z.number().int().nonnegative(),
  rbi: z.number().int().nonnegative(),
  sacrificeBunts: z.number().int().nonnegative(),
  sacrificeFlies: z.number().int().nonnegative(),
});
export type ParsedTeamHitterStatRow = z.infer<typeof parsedTeamHitterStatRowSchema>;

export const parsedTeamPitcherStatRowSchema = z.object({
  rank: z.number().int().positive(),
  teamName: z.string(),
  era: z.number().nonnegative(),
  games: z.number().int().nonnegative(),
  completeGames: z.number().int().nonnegative(),
  shutouts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  holds: z.number().int().nonnegative(),
  winPct: z.number().nonnegative(),
  battersFaced: z.number().int().nonnegative(),
  inningsPitched: z.number().nonnegative(),
  hitsAllowed: z.number().int().nonnegative(),
  homeRunsAllowed: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  runsAllowed: z.number().int().nonnegative(),
  earnedRuns: z.number().int().nonnegative(),
});
export type ParsedTeamPitcherStatRow = z.infer<typeof parsedTeamPitcherStatRowSchema>;

export const parsedFranchiseBrandHistorySchema = z.object({
  displayNameKo: z.string(),
  shortNameKo: z.string(),
  shortCode: z.string(),
  seasonStartYear: z.number().int(),
  seasonEndYear: z.number().int().nullable(),
  notes: z.string().optional(),
});

export const parsedFranchiseHistoryRowSchema = z.object({
  franchiseId: z.string(),
  canonicalNameKo: z.string(),
  shortNameKo: z.string(),
  regionKo: z.string(),
  foundedYear: z.number().int(),
  primaryVenueName: z.string(),
  championships: z.number().int().nonnegative(),
  brandHistorySummary: z.string(),
  brands: z.array(parsedFranchiseBrandHistorySchema),
});
export type ParsedFranchiseHistoryRow = z.infer<typeof parsedFranchiseHistoryRowSchema>;

export const parsedRulesetRowSchema = z.object({
  year: z.number().int(),
  label: z.string(),
  regularSeasonGamesPerTeam: z.number().int().positive(),
  gamesPerOpponent: z.number().int().positive(),
  tiesAllowed: z.boolean(),
  tiebreakerOrder: z.array(z.enum(["headToHead", "runDifferential", "runScored", "teamCode"])),
  specialPlayoffGamePositions: z.array(z.number().int().positive()),
  postseasonFormat: z.array(
    z.object({
      round: z.enum(["wildcard", "semipo", "po", "ks"]),
      label: z.string(),
      bestOf: z.number().int().positive(),
      higherSeedAdvantageWins: z.number().int().nonnegative(),
    }),
  ),
  notes: z.array(z.string()),
});
export type ParsedRulesetRow = z.infer<typeof parsedRulesetRowSchema>;

export const parsedWeatherRowSchema = z.object({
  date: z.string(),
  venueName: z.string(),
  summary: z.string(),
  tempC: z.number().nullable(),
  precipitationProbability: z.number().nullable(),
});
export type ParsedWeatherRow = z.infer<typeof parsedWeatherRowSchema>;

export const parsedPlayerSearchRowSchema = z.object({
  teamName: z.string(),
  playerName: z.string(),
  pcode: z.string(),
  playerUrl: z.string().nullable(),
  position: z.string().nullable(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  heightWeight: z.string().nullable(),
  statType: z.enum(["hitter", "pitcher"]),
});
export type ParsedPlayerSearchRow = z.infer<typeof parsedPlayerSearchRowSchema>;

export const parsedPlayerTop5EntrySchema = z.object({
  statType: z.enum(["hitter", "pitcher"]),
  categoryLabel: z.string(),
  rank: z.number().int().positive(),
  pcode: z.string(),
  playerNameEn: z.string(),
  teamName: z.string(),
  metricValue: z.string(),
  playerUrl: z.string(),
});
export type ParsedPlayerTop5Entry = z.infer<typeof parsedPlayerTop5EntrySchema>;

export const parsedPlayerSummaryHitterRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  games: z.number().int().nonnegative(),
  plateAppearances: z.number().int().nonnegative(),
  atBats: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  ops: z.number().nonnegative(),
});
export type ParsedPlayerSummaryHitterRow = z.infer<typeof parsedPlayerSummaryHitterRowSchema>;

export const parsedPlayerSummaryPitcherRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  games: z.number().int().nonnegative(),
  era: z.number().nonnegative(),
  inningsPitched: z.number().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
export type ParsedPlayerSummaryPitcherRow = z.infer<typeof parsedPlayerSummaryPitcherRowSchema>;

export const parsedPlayerGameLogHitterRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  date: z.string(),
  opponentTeamName: z.string(),
  avg: z.number().nonnegative(),
  atBats: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  rbi: z.number().int().nonnegative(),
  stolenBases: z.number().int().nonnegative(),
  caughtStealing: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  gidp: z.number().int().nonnegative(),
});
export type ParsedPlayerGameLogHitterRow = z.infer<typeof parsedPlayerGameLogHitterRowSchema>;

export const parsedPlayerGameLogPitcherRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  date: z.string(),
  opponentTeamName: z.string(),
  era: z.number().nonnegative(),
  result: z.string().nullable(),
  plateAppearances: z.number().int().nonnegative(),
  inningsPitched: z.number().nonnegative(),
  hitsAllowed: z.number().int().nonnegative(),
  homeRunsAllowed: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  runsAllowed: z.number().int().nonnegative(),
  earnedRuns: z.number().int().nonnegative(),
  opponentAvg: z.number().nonnegative(),
});
export type ParsedPlayerGameLogPitcherRow = z.infer<typeof parsedPlayerGameLogPitcherRowSchema>;

export const parsedPlayerSplitMonthHitterRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  monthKey: z.string(),
  games: z.number().int().nonnegative(),
  avg: z.number().nonnegative(),
  atBats: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  rbi: z.number().int().nonnegative(),
  stolenBases: z.number().int().nonnegative(),
  caughtStealing: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  gidp: z.number().int().nonnegative(),
});
export type ParsedPlayerSplitMonthHitterRow = z.infer<typeof parsedPlayerSplitMonthHitterRowSchema>;

export const parsedPlayerSplitMonthPitcherRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  monthKey: z.string(),
  games: z.number().int().nonnegative(),
  era: z.number().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  holds: z.number().int().nonnegative(),
  winPct: z.number().nonnegative(),
  plateAppearances: z.number().int().nonnegative(),
  inningsPitched: z.number().nonnegative(),
  hitsAllowed: z.number().int().nonnegative(),
  homeRunsAllowed: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  runsAllowed: z.number().int().nonnegative(),
  earnedRuns: z.number().int().nonnegative(),
  opponentAvg: z.number().nonnegative(),
});
export type ParsedPlayerSplitMonthPitcherRow = z.infer<typeof parsedPlayerSplitMonthPitcherRowSchema>;

export const parsedPlayerSituationHitterRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  situationKey: z.string(),
  avg: z.number().nonnegative(),
  atBats: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  rbi: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  gidp: z.number().int().nonnegative(),
});
export type ParsedPlayerSituationHitterRow = z.infer<typeof parsedPlayerSituationHitterRowSchema>;

export const parsedPlayerSituationPitcherRowSchema = z.object({
  pcode: z.string(),
  teamName: z.string(),
  playerNameEn: z.string(),
  position: z.string(),
  backNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  debutYear: z.number().int(),
  situationKey: z.string(),
  hitsAllowed: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRunsAllowed: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  wildPitches: z.number().int().nonnegative(),
  balks: z.number().int().nonnegative(),
  opponentAvg: z.number().nonnegative(),
});
export type ParsedPlayerSituationPitcherRow = z.infer<typeof parsedPlayerSituationPitcherRowSchema>;

export const parsedTeamInformationRowSchema = z.object({
  teamName: z.string(),
  managerName: z.string().nullable(),
  venueName: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
});
export type ParsedTeamInformationRow = z.infer<typeof parsedTeamInformationRowSchema>;

export const parsedStatizTeamStatRowSchema = z.object({
  teamName: z.string(),
  games: z.number().int().nullable(),
  metric: z.string(),
  value: z.string(),
});
export type ParsedStatizTeamStatRow = z.infer<typeof parsedStatizTeamStatRowSchema>;

export const parsedStatizPlayerStatRowSchema = z.object({
  playerName: z.string(),
  teamName: z.string(),
  metric: z.string(),
  value: z.string(),
});
export type ParsedStatizPlayerStatRow = z.infer<typeof parsedStatizPlayerStatRowSchema>;

export const parsedStatizWarRowSchema = z.object({
  playerName: z.string(),
  teamName: z.string(),
  war: z.number().nullable(),
});
export type ParsedStatizWarRow = z.infer<typeof parsedStatizWarRowSchema>;

export const normalizedSeriesGamesSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  series: z.array(seriesSchema),
  games: z.array(gameSchema),
});
export type NormalizedSeriesGames = z.infer<typeof normalizedSeriesGamesSchema>;

export const normalizedScoreboardSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  games: z.array(gameSchema),
  boxScores: z.array(gameBoxScoreSchema),
});
export type NormalizedScoreboard = z.infer<typeof normalizedScoreboardSchema>;

export const normalizedStandingsRowSchema = z.object({
  seasonTeamId: z.string(),
  rank: z.number().int().positive(),
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  winPct: z.number().nonnegative(),
  gamesBehind: z.number().nonnegative(),
  last10: z.string(),
  streak: z.string(),
  homeRecord: z.string(),
  awayRecord: z.string(),
  runsScored: z.number().int().nullable(),
  runsAllowed: z.number().int().nullable(),
});
export const normalizedStandingsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(normalizedStandingsRowSchema),
});
export type NormalizedStandings = z.infer<typeof normalizedStandingsSchema>;

export const normalizedRosterEventsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  events: z.array(rosterEventSchema),
});
export type NormalizedRosterEvents = z.infer<typeof normalizedRosterEventsSchema>;

export const normalizedPlayersSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  players: z.array(playerSchema),
});
export type NormalizedPlayers = z.infer<typeof normalizedPlayersSchema>;

export const normalizedPlayerSeasonStatsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  players: z.array(playerSchema),
  stats: z.array(playerSeasonStatSchema),
});
export type NormalizedPlayerSeasonStats = z.infer<typeof normalizedPlayerSeasonStatsSchema>;

export const normalizedPlayerGameStatsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(playerGameStatSchema),
});
export type NormalizedPlayerGameStats = z.infer<typeof normalizedPlayerGameStatsSchema>;

export const normalizedPlayerSplitStatsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(playerSplitStatSchema),
});
export type NormalizedPlayerSplitStats = z.infer<typeof normalizedPlayerSplitStatsSchema>;

export const normalizedFranchiseLineageSchema = z.object({
  generatedAt: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  franchises: z.array(franchiseSchema),
  teamBrands: z.array(teamBrandSchema),
});
export type NormalizedFranchiseLineage = z.infer<typeof normalizedFranchiseLineageSchema>;

export const normalizedHistoricalTeamRecordRowSchema = z.object({
  year: z.number().int(),
  franchiseId: z.string(),
  brandLabel: z.string(),
  rank: z.number().int().positive(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  postseasonResult: z.string().nullable(),
});
export const normalizedHistoricalTeamRecordsSchema = z.object({
  generatedAt: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(normalizedHistoricalTeamRecordRowSchema),
});
export type NormalizedHistoricalTeamRecords = z.infer<typeof normalizedHistoricalTeamRecordsSchema>;

export const normalizedTeamHitterStatsRowSchema = z.object({
  seasonTeamId: z.string(),
  rank: z.number().int().positive(),
  avg: z.number().nonnegative(),
  games: z.number().int().nonnegative(),
  plateAppearances: z.number().int().nonnegative(),
  atBats: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  doubles: z.number().int().nonnegative(),
  triples: z.number().int().nonnegative(),
  homeRuns: z.number().int().nonnegative(),
  totalBases: z.number().int().nonnegative(),
  rbi: z.number().int().nonnegative(),
  sacrificeBunts: z.number().int().nonnegative(),
  sacrificeFlies: z.number().int().nonnegative(),
  offensePlus: z.number().int(),
});
export const normalizedTeamHitterStatsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(normalizedTeamHitterStatsRowSchema),
});
export type NormalizedTeamHitterStats = z.infer<typeof normalizedTeamHitterStatsSchema>;

export const normalizedTeamPitcherStatsRowSchema = z.object({
  seasonTeamId: z.string(),
  rank: z.number().int().positive(),
  era: z.number().nonnegative(),
  games: z.number().int().nonnegative(),
  completeGames: z.number().int().nonnegative(),
  shutouts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  holds: z.number().int().nonnegative(),
  winPct: z.number().nonnegative(),
  battersFaced: z.number().int().nonnegative(),
  inningsPitched: z.number().nonnegative(),
  hitsAllowed: z.number().int().nonnegative(),
  homeRunsAllowed: z.number().int().nonnegative(),
  walks: z.number().int().nonnegative(),
  hitByPitch: z.number().int().nonnegative(),
  strikeouts: z.number().int().nonnegative(),
  runsAllowed: z.number().int().nonnegative(),
  earnedRuns: z.number().int().nonnegative(),
  pitchingPlus: z.number().int(),
  bullpenEra: z.number(),
});
export const normalizedTeamPitcherStatsSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rows: z.array(normalizedTeamPitcherStatsRowSchema),
});
export type NormalizedTeamPitcherStats = z.infer<typeof normalizedTeamPitcherStatsSchema>;

export const normalizedRulesetsSchema = z.object({
  generatedAt: z.string(),
  sources: z.array(normalizedSourceReferenceSchema),
  rulesets: z.array(rulesetSchema),
});
export type NormalizedRulesets = z.infer<typeof normalizedRulesetsSchema>;

export const manualTeamAliasPatchSchema = z.object({
  sourceId: sourceIdSchema.optional(),
  alias: z.string(),
  seasonId: z.string().optional(),
  seasonTeamId: z.string(),
  note: z.string(),
});
export const manualVenueAliasPatchSchema = z.object({
  sourceId: sourceIdSchema.optional(),
  alias: z.string(),
  venueId: z.string(),
  note: z.string(),
});
export const manualGamePatchSchema = z.object({
  sourceGameKey: z.string().optional(),
  gameId: z.string().optional(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]).optional(),
  scheduledAt: z.string().optional(),
  venueId: z.string().optional(),
  note: z.string().optional(),
});
export const manualNamingPatchSchema = z.object({
  entityType: z.enum(["player", "team"]),
  sourceValue: z.string(),
  canonicalValue: z.string(),
  note: z.string(),
});
export const manualSeasonNotePatchSchema = z.object({
  seasonId: z.string(),
  note: z.string(),
});

export const manualSourcePatchBundleSchema = z.object({
  updatedAt: z.string(),
  teamAliases: z.array(manualTeamAliasPatchSchema),
  venueAliases: z.array(manualVenueAliasPatchSchema),
  gamePatches: z.array(manualGamePatchSchema),
  namingPatches: z.array(manualNamingPatchSchema),
  seasonNotes: z.array(manualSeasonNotePatchSchema),
});
export type ManualSourcePatchBundle = z.infer<typeof manualSourcePatchBundleSchema>;

export const simulationSeedInputSchema = z.object({
  seasonId: z.string(),
  generatedAt: z.string(),
  currentStandings: normalizedStandingsSchema,
  remainingSchedule: z.array(gameSchema),
  headToHeadRemainingGames: z.record(z.number().int().nonnegative()),
  homeAwaySplits: z.array(
    z.object({
      seasonTeamId: z.string(),
      homeRecord: z.string(),
      awayRecord: z.string(),
    }),
  ),
  rosterAvailabilityEvents: z.array(rosterEventSchema),
  teamOffenseInputs: z.array(
    z.object({
      seasonTeamId: z.string(),
      runsScored: z.number().int().nullable(),
      gamesPlayed: z.number().int().nonnegative(),
    }),
  ),
  pitcherUsageInputs: z.array(
    z.object({
      seasonTeamId: z.string(),
      recentInnings: z.number().nonnegative(),
      recentBullpenLoad: z.number().nonnegative(),
    }),
  ),
  weatherInputs: z.array(parsedWeatherRowSchema),
});
export type SimulationSeedInput = z.infer<typeof simulationSeedInputSchema>;

export type ParsedDatasetMap = {
  "schedule-calendar": ParsedScheduleRow[];
  scoreboard: ParsedScoreboardRow[];
  standings: ParsedStandingsRow[];
  "batting-top5": ParsedPlayerTop5Entry[];
  "pitching-top5": ParsedPlayerTop5Entry[];
  "player-summary-hitter": ParsedPlayerSummaryHitterRow[];
  "player-summary-pitcher": ParsedPlayerSummaryPitcherRow[];
  "player-game-logs-hitter": ParsedPlayerGameLogHitterRow[];
  "player-game-logs-pitcher": ParsedPlayerGameLogPitcherRow[];
  "player-splits-month-hitter": ParsedPlayerSplitMonthHitterRow[];
  "player-splits-month-pitcher": ParsedPlayerSplitMonthPitcherRow[];
  "player-situations-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-situations-count-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-count-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-situations-runner-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-runner-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-situations-out-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-out-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-situations-inning-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-inning-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-situations-batting-order-hitter": ParsedPlayerSituationHitterRow[];
  "player-situations-batting-order-pitcher": ParsedPlayerSituationPitcherRow[];
  "player-register": ParsedPlayerRegisterRow[];
  "player-register-all": ParsedPlayerRegisterRow[];
  "roster-movement": ParsedRosterMovementRow[];
  "historical-team-record": ParsedHistoricalTeamRecordRow[];
  "team-history": ParsedFranchiseHistoryRow[];
  "team-hitter": ParsedTeamHitterStatRow[];
  "team-pitcher": ParsedTeamPitcherStatRow[];
  rules: ParsedRulesetRow[];
  weather: ParsedWeatherRow[];
  "player-search": ParsedPlayerSearchRow[];
  "team-information": ParsedTeamInformationRow[];
  "statiz-team-stats": ParsedStatizTeamStatRow[];
  "statiz-player-stats": ParsedStatizPlayerStatRow[];
  "statiz-war": ParsedStatizWarRow[];
};

export type NormalizedDatasetOutputMap = {
  "series-games": NormalizedSeriesGames;
  scoreboard: NormalizedScoreboard;
  standings: NormalizedStandings;
  players: NormalizedPlayers;
  "player-season-stats": NormalizedPlayerSeasonStats;
  "player-game-stats": NormalizedPlayerGameStats;
  "player-split-stats": NormalizedPlayerSplitStats;
  "roster-events": NormalizedRosterEvents;
  "franchise-lineage": NormalizedFranchiseLineage;
  "historical-team-records": NormalizedHistoricalTeamRecords;
  "team-hitter-stats": NormalizedTeamHitterStats;
  "team-pitcher-stats": NormalizedTeamPitcherStats;
  rulesets: NormalizedRulesets;
};

export function normalizeGameStatusLabel(raw: string): GameStatus {
  const value = raw.trim().toLowerCase();
  if (value.includes("final")) {
    return "final";
  }
  if (value.includes("postponed") || value.includes("우천")) {
    return "postponed";
  }
  if (value.includes("suspended")) {
    return "suspended";
  }
  if (value.includes("tbd")) {
    return "tbd";
  }
  return "scheduled";
}

export function normalizeRosterEventType(raw: string): RosterEventType {
  const value = raw.trim().toLowerCase();
  if (value.includes("말소") || value.includes("inj") || value.includes("injured")) {
    return "injured";
  }
  if (value.includes("등록") || value.includes("activated")) {
    return "activated";
  }
  if (value.includes("trade") || value.includes("트레이드")) {
    return "transferred";
  }
  if (value.includes("release") || value.includes("방출")) {
    return "released";
  }
  return "joined";
}

export function parseTiebreakerTokens(raw: string): TiebreakerKey[] {
  const normalized = raw.toLowerCase();
  const tokens: TiebreakerKey[] = [];
  if (normalized.includes("head")) {
    tokens.push("headToHead");
  }
  if (normalized.includes("run differential")) {
    tokens.push("runDifferential");
  }
  if (normalized.includes("run scored")) {
    tokens.push("runScored");
  }
  if (normalized.includes("team code")) {
    tokens.push("teamCode");
  }
  return tokens.length > 0 ? tokens : ["headToHead", "runDifferential", "runScored", "teamCode"];
}
