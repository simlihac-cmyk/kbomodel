import { z } from "zod";

const externalLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

const explanationReasonSchema = z.object({
  key: z.string(),
  label: z.string(),
  direction: z.enum(["positive", "negative", "neutral"]),
  magnitude: z.number(),
  sentence: z.string(),
});

export const franchiseSchema = z.object({
  franchiseId: z.string(),
  slug: z.string(),
  canonicalNameKo: z.string(),
  shortNameKo: z.string(),
  regionKo: z.string(),
  foundedYear: z.number().int(),
  primaryVenueId: z.string(),
  championships: z.number().int().nonnegative(),
  brandHistorySummary: z.string(),
});

export const teamBrandSchema = z.object({
  brandId: z.string(),
  franchiseId: z.string(),
  displayNameKo: z.string(),
  shortNameKo: z.string(),
  shortCode: z.string(),
  seasonStartYear: z.number().int(),
  seasonEndYear: z.number().int().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  wordmarkText: z.string(),
  logoPath: z.string(),
  notes: z.string().optional(),
});

export const venueSchema = z.object({
  venueId: z.string(),
  slug: z.string(),
  nameKo: z.string(),
  cityKo: z.string(),
  openedYear: z.number().int().nullable(),
  capacity: z.number().int().nullable(),
  dome: z.boolean(),
});

export const seasonSchema = z.object({
  seasonId: z.string(),
  year: z.number().int(),
  label: z.string(),
  status: z.enum(["draft", "ongoing", "completed"]),
  phase: z.enum(["preseason", "regular", "postseason", "completed"]),
  rulesetId: z.string(),
  openingDay: z.string(),
  regularSeasonStart: z.string(),
  regularSeasonEnd: z.string(),
  postseasonStart: z.string().nullable(),
  postseasonEnd: z.string().nullable(),
  updatedAt: z.string(),
});

export const postseasonRoundConfigSchema = z.object({
  round: z.enum(["wildcard", "semipo", "po", "ks"]),
  label: z.string(),
  bestOf: z.number().int().positive(),
  higherSeedAdvantageWins: z.number().int().nonnegative(),
});

export const rulesetSchema = z.object({
  rulesetId: z.string(),
  label: z.string(),
  regularSeasonGamesPerTeam: z.number().int().positive(),
  gamesPerOpponent: z.number().int().positive(),
  tiesAllowed: z.boolean(),
  tiebreakerOrder: z.array(z.enum(["headToHead", "runDifferential", "runScored", "teamCode"])),
  specialPlayoffGamePositions: z.array(z.number().int().positive()),
  postseasonFormat: z.array(postseasonRoundConfigSchema),
  notes: z.array(z.string()),
});

export const strengthPriorsSchema = z.object({
  offenseRating: z.number(),
  starterRating: z.number(),
  bullpenRating: z.number(),
});

export const manualStrengthAdjustmentSchema = z.object({
  offenseDelta: z.number(),
  starterDelta: z.number(),
  bullpenDelta: z.number(),
  confidenceDelta: z.number(),
  note: z.string(),
});

export const seasonTeamSchema = z.object({
  seasonTeamId: z.string(),
  seasonId: z.string(),
  franchiseId: z.string(),
  brandId: z.string(),
  venueId: z.string(),
  managerNameKo: z.string(),
  preseasonPriors: strengthPriorsSchema,
  manualAdjustments: z.array(manualStrengthAdjustmentSchema),
  preseasonOutlook: z.string(),
});

export const seriesSchema = z.object({
  seriesId: z.string(),
  seasonId: z.string(),
  type: z.enum(["regular", "wildcard", "semipo", "po", "ks"]),
  homeSeasonTeamId: z.string(),
  awaySeasonTeamId: z.string(),
  plannedLength: z.number().int().positive(),
  actualLength: z.number().int().nonnegative(),
  startDate: z.string(),
  endDate: z.string(),
  venueId: z.string(),
  status: z.enum(["scheduled", "in_progress", "final", "postponed"]),
  importanceNote: z.string().optional(),
});

export const gameSchema = z.object({
  gameId: z.string(),
  seasonId: z.string(),
  seriesId: z.string(),
  homeSeasonTeamId: z.string(),
  awaySeasonTeamId: z.string(),
  scheduledAt: z.string(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
  originalScheduledAt: z.string().nullable(),
  rescheduledFromGameId: z.string().nullable(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  innings: z.number().int().nullable(),
  isTie: z.boolean(),
  note: z.string().nullable(),
  attendance: z.number().int().nullable(),
  externalLinks: z.array(externalLinkSchema),
});

export const gameBoxScoreSchema = z.object({
  gameId: z.string(),
  winningPitcherId: z.string().nullable(),
  losingPitcherId: z.string().nullable(),
  savePitcherId: z.string().nullable(),
  lineScore: z.array(
    z.object({
      inning: z.number().int(),
      home: z.number().int(),
      away: z.number().int(),
    }),
  ),
  highlights: z.array(
    z.object({
      playerId: z.string(),
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export const playerSchema = z.object({
  playerId: z.string(),
  slug: z.string(),
  nameKo: z.string(),
  nameEn: z.string(),
  birthDate: z.string().nullable(),
  batsThrows: z.string().nullable(),
  primaryPositions: z.array(z.string()),
  debutYear: z.number().int(),
  franchiseIds: z.array(z.string()),
  bio: z.string(),
});

export const rosterEventSchema = z.object({
  rosterEventId: z.string(),
  seasonId: z.string(),
  playerId: z.string(),
  seasonTeamId: z.string(),
  type: z.enum(["joined", "activated", "injured", "transferred", "released"]),
  date: z.string(),
  note: z.string(),
});

export const playerSeasonStatSchema = z.object({
  statId: z.string(),
  seasonId: z.string(),
  playerId: z.string(),
  seasonTeamId: z.string(),
  statType: z.enum(["hitter", "pitcher"]),
  games: z.number().int(),
  plateAppearances: z.number().nullable(),
  atBats: z.number().nullable(),
  hits: z.number().nullable(),
  homeRuns: z.number().nullable(),
  ops: z.number().nullable(),
  era: z.number().nullable(),
  inningsPitched: z.number().nullable(),
  strikeouts: z.number().nullable(),
  saves: z.number().nullable(),
  wins: z.number().nullable(),
  losses: z.number().nullable(),
  war: z.number().nullable(),
});

export const playerGameStatSchema = z.object({
  playerGameStatId: z.string(),
  gameId: z.string(),
  seasonId: z.string(),
  playerId: z.string(),
  seasonTeamId: z.string(),
  statType: z.enum(["hitter", "pitcher"]),
  summaryLine: z.string(),
});

export const playerSplitStatSchema = z.object({
  playerSplitStatId: z.string(),
  seasonId: z.string(),
  playerId: z.string(),
  seasonTeamId: z.string(),
  statType: z.enum(["hitter", "pitcher"]),
  splitType: z.enum(["month", "situation"]),
  splitKey: z.string(),
  splitLabel: z.string(),
  games: z.number().int(),
  plateAppearances: z.number().nullable(),
  atBats: z.number().nullable(),
  hits: z.number().nullable(),
  homeRuns: z.number().nullable(),
  ops: z.number().nullable(),
  era: z.number().nullable(),
  inningsPitched: z.number().nullable(),
  strikeouts: z.number().nullable(),
  saves: z.number().nullable(),
  wins: z.number().nullable(),
  losses: z.number().nullable(),
  summaryLine: z.string(),
});

export const teamSeasonStatSchema = z.object({
  seasonId: z.string(),
  seasonTeamId: z.string(),
  wins: z.number().int(),
  losses: z.number().int(),
  ties: z.number().int(),
  runsScored: z.number().int(),
  runsAllowed: z.number().int(),
  homeWins: z.number().int(),
  homeLosses: z.number().int(),
  awayWins: z.number().int(),
  awayLosses: z.number().int(),
  last10: z.string(),
  streak: z.string(),
  offensePlus: z.number(),
  pitchingPlus: z.number(),
  bullpenEra: z.number(),
  teamWar: z.number(),
});

export const teamSplitStatSchema = z.object({
  splitId: z.string(),
  seasonId: z.string(),
  seasonTeamId: z.string(),
  splitType: z.enum(["home", "away", "vsLeft", "vsRight", "oneRun", "extraInnings"]),
  wins: z.number().int(),
  losses: z.number().int(),
  ties: z.number().int(),
  metricLabel: z.string(),
  metricValue: z.string(),
});

export const awardSchema = z.object({
  awardId: z.string(),
  seasonId: z.string(),
  label: z.string(),
  playerId: z.string().nullable(),
  seasonTeamId: z.string().nullable(),
  note: z.string(),
});

export const seasonSummarySchema = z.object({
  seasonId: z.string(),
  headline: z.string(),
  championSeasonTeamId: z.string(),
  regularSeasonWinnerSeasonTeamId: z.string(),
  narrative: z.array(z.string()),
});

export const postseasonResultSchema = z.object({
  seasonId: z.string(),
  round: z.enum(["regular", "wildcard", "semipo", "po", "ks"]),
  winnerSeasonTeamId: z.string(),
  loserSeasonTeamId: z.string(),
  summary: z.string(),
});

export const scenarioOverrideSchema = z.object({
  overrideId: z.string(),
  targetType: z.enum(["game", "series"]),
  targetId: z.string(),
  forcedOutcome: z.enum([
    "model",
    "homeWin",
    "awayWin",
    "tie",
    "homeSeriesWin",
    "awaySeriesWin",
    "homeSweep",
    "awaySweep",
  ]),
  note: z.string(),
});

export const userScenarioSchema = z.object({
  scenarioId: z.string(),
  seasonId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  overrides: z.array(scenarioOverrideSchema),
});

export const manualAdjustmentPatchSchema = z.object({
  seasonTeamId: z.string(),
  offenseDelta: z.number(),
  starterDelta: z.number(),
  bullpenDelta: z.number(),
  confidenceDelta: z.number(),
  note: z.string(),
  updatedAt: z.string(),
});

export const manualAdjustmentBundleSchema = z.object({
  updatedAt: z.string(),
  patches: z.array(manualAdjustmentPatchSchema),
});

export const gameSchedulePatchSchema = z.object({
  gameId: z.string(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
  scheduledAt: z.string(),
  note: z.string().nullable(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  updatedAt: z.string(),
});

export const schedulePatchBundleSchema = z.object({
  updatedAt: z.string(),
  patches: z.array(gameSchedulePatchSchema),
});

export const seasonMetaPatchSchema = z.object({
  seasonId: z.string(),
  label: z.string(),
  status: z.enum(["draft", "ongoing", "completed"]),
  phase: z.enum(["preseason", "regular", "postseason", "completed"]),
  rulesetId: z.string(),
  updatedAt: z.string(),
});

export const seasonMetaPatchBundleSchema = z.object({
  updatedAt: z.string(),
  patches: z.array(seasonMetaPatchSchema),
});

export const teamBrandPatchSchema = z.object({
  brandId: z.string(),
  displayNameKo: z.string(),
  shortNameKo: z.string(),
  shortCode: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  wordmarkText: z.string(),
  updatedAt: z.string(),
});

export const teamBrandPatchBundleSchema = z.object({
  updatedAt: z.string(),
  patches: z.array(teamBrandPatchSchema),
});

export const importCandidateRowSchema = z.object({
  source: z.string(),
  gameId: z.string(),
  scheduledAt: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  status: z.enum(["scheduled", "final", "postponed", "suspended", "tbd"]),
  note: z.string(),
  importedAt: z.string(),
});

export const importCandidateBundleSchema = z.object({
  updatedAt: z.string(),
  rows: z.array(importCandidateRowSchema),
});

export const auditLogEntrySchema = z.object({
  auditLogId: z.string(),
  occurredAt: z.string(),
  actorUsername: z.string(),
  actorRole: z.enum(["admin"]),
  action: z.enum([
    "manualAdjustment.saved",
    "schedulePatch.saved",
    "seasonMetaPatch.saved",
    "teamBrandPatch.saved",
    "importPreview.applied",
    "importCandidates.queued",
    "importCandidates.dismissed",
    "importCandidates.cleared",
    "admin.login.succeeded",
    "admin.login.failed",
    "admin.logout",
  ]),
  targetType: z.enum(["manualAdjustment", "schedule", "season", "teamBrand", "import", "auth"]),
  targetId: z.string(),
  summary: z.string(),
  ipAddress: z.string().nullable(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const auditLogBundleSchema = z.object({
  updatedAt: z.string(),
  entries: z.array(auditLogEntrySchema),
});

export const teamStrengthSnapshotSchema = z.object({
  seasonTeamId: z.string(),
  offenseRating: z.number(),
  starterRating: z.number(),
  bullpenRating: z.number(),
  homeFieldAdjustment: z.number(),
  recentFormAdjustment: z.number(),
  confidenceScore: z.number(),
  priorWeight: z.number(),
  currentWeight: z.number(),
  scheduleDifficulty: z.number(),
  headToHeadLeverage: z.number(),
  explanationReasons: z.array(explanationReasonSchema),
});

export const gameProbabilitySnapshotSchema = z.object({
  gameId: z.string(),
  homeSeasonTeamId: z.string(),
  awaySeasonTeamId: z.string(),
  homeLikelyStarterId: z.string().nullable(),
  awayLikelyStarterId: z.string().nullable(),
  homeWinProb: z.number(),
  awayWinProb: z.number(),
  tieProb: z.number(),
  expectedRunsHome: z.number(),
  expectedRunsAway: z.number(),
  starterAdjustmentApplied: z.boolean(),
  explanationReasons: z.array(explanationReasonSchema),
});

export const simulationSnapshotSchema = z.object({
  seasonId: z.string(),
  generatedAt: z.string(),
  iterations: z.number().int().positive(),
  rankDistributions: z.array(
    z.object({
      seasonTeamId: z.string(),
      counts: z.array(z.number()),
      probabilities: z.array(z.number()),
    }),
  ),
  bucketOdds: z.array(
    z.object({
      seasonTeamId: z.string(),
      first: z.number(),
      second: z.number(),
      third: z.number(),
      fourth: z.number(),
      fifth: z.number(),
      missPostseason: z.number(),
    }),
  ),
  postseasonOdds: z.array(
    z.object({
      seasonTeamId: z.string(),
      wildcard: z.number(),
      semipo: z.number(),
      po: z.number(),
      ks: z.number(),
      champion: z.number(),
    }),
  ),
  expectedRecords: z.array(
    z.object({
      seasonTeamId: z.string(),
      expectedWins: z.number(),
      expectedLosses: z.number(),
      expectedTies: z.number(),
      averageRank: z.number(),
    }),
  ),
  tieAlerts: z.array(
    z.object({
      positions: z.array(z.number().int()),
      seasonTeamIds: z.array(z.string()),
      probability: z.number(),
      note: z.string(),
    }),
  ),
  gameProbabilities: z.array(gameProbabilitySnapshotSchema),
  teamStrengths: z.array(teamStrengthSnapshotSchema),
});

export const kboDataBundleSchema = z.object({
  franchises: z.array(franchiseSchema),
  teamBrands: z.array(teamBrandSchema),
  venues: z.array(venueSchema),
  seasons: z.array(seasonSchema),
  rulesets: z.array(rulesetSchema),
  seasonTeams: z.array(seasonTeamSchema),
  series: z.array(seriesSchema),
  games: z.array(gameSchema),
  gameBoxScores: z.array(gameBoxScoreSchema),
  players: z.array(playerSchema),
  rosterEvents: z.array(rosterEventSchema),
  playerSeasonStats: z.array(playerSeasonStatSchema),
  playerGameStats: z.array(playerGameStatSchema),
  playerSplitStats: z.array(playerSplitStatSchema).default([]),
  teamSeasonStats: z.array(teamSeasonStatSchema),
  teamSplitStats: z.array(teamSplitStatSchema),
  awards: z.array(awardSchema),
  seasonSummaries: z.array(seasonSummarySchema),
  postseasonResults: z.array(postseasonResultSchema),
});
