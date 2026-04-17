export type SeasonStatus = "draft" | "ongoing" | "completed";
export type SeasonPhase = "preseason" | "regular" | "postseason" | "completed";
export type SeriesType = "regular" | "wildcard" | "semipo" | "po" | "ks";
export type SeriesStatus = "scheduled" | "in_progress" | "final" | "postponed";
export type GameStatus = "scheduled" | "final" | "postponed" | "suspended" | "tbd";
export type TiebreakerKey = "headToHead" | "runDifferential" | "runScored" | "teamCode";
export type ScenarioTargetType = "game" | "series";
export type ScenarioForcedOutcome =
  | "model"
  | "homeWin"
  | "awayWin"
  | "tie"
  | "homeSeriesWin"
  | "awaySeriesWin"
  | "homeSweep"
  | "awaySweep";
export type RecordOutcome = "W" | "L" | "T";
export type PlayerStatType = "hitter" | "pitcher";
export type PlayerSplitType = "month" | "situation";
export type RosterEventType =
  | "joined"
  | "activated"
  | "injured"
  | "transferred"
  | "released";
export type TeamSplitType =
  | "home"
  | "away"
  | "vsLeft"
  | "vsRight"
  | "oneRun"
  | "extraInnings";
export type ExplanationDirection = "positive" | "negative" | "neutral";

export type Franchise = {
  franchiseId: string;
  slug: string;
  canonicalNameKo: string;
  shortNameKo: string;
  regionKo: string;
  foundedYear: number;
  primaryVenueId: string;
  championships: number;
  brandHistorySummary: string;
};

export type TeamBrand = {
  brandId: string;
  franchiseId: string;
  displayNameKo: string;
  shortNameKo: string;
  shortCode: string;
  seasonStartYear: number;
  seasonEndYear: number | null;
  primaryColor: string;
  secondaryColor: string;
  wordmarkText: string;
  logoPath: string;
  notes?: string;
};

export type Venue = {
  venueId: string;
  slug: string;
  nameKo: string;
  cityKo: string;
  openedYear: number | null;
  capacity: number | null;
  dome: boolean;
};

export type Season = {
  seasonId: string;
  year: number;
  label: string;
  status: SeasonStatus;
  phase: SeasonPhase;
  rulesetId: string;
  openingDay: string;
  regularSeasonStart: string;
  regularSeasonEnd: string;
  postseasonStart: string | null;
  postseasonEnd: string | null;
  updatedAt: string;
};

export type PostseasonRoundConfig = {
  round: "wildcard" | "semipo" | "po" | "ks";
  label: string;
  bestOf: number;
  higherSeedAdvantageWins: number;
};

export type KboSeasonRuleset = {
  rulesetId: string;
  label: string;
  regularSeasonGamesPerTeam: number;
  gamesPerOpponent: number;
  tiesAllowed: boolean;
  tiebreakerOrder: TiebreakerKey[];
  specialPlayoffGamePositions: number[];
  postseasonFormat: PostseasonRoundConfig[];
  notes: string[];
};

export type StrengthPriors = {
  offenseRating: number;
  starterRating: number;
  bullpenRating: number;
};

export type ManualStrengthAdjustment = {
  offenseDelta: number;
  starterDelta: number;
  bullpenDelta: number;
  confidenceDelta: number;
  note: string;
};

export type SeasonTeam = {
  seasonTeamId: string;
  seasonId: string;
  franchiseId: string;
  brandId: string;
  venueId: string;
  managerNameKo: string;
  preseasonPriors: StrengthPriors;
  manualAdjustments: ManualStrengthAdjustment[];
  preseasonOutlook: string;
};

export type Series = {
  seriesId: string;
  seasonId: string;
  type: SeriesType;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  plannedLength: number;
  actualLength: number;
  startDate: string;
  endDate: string;
  venueId: string;
  status: SeriesStatus;
  importanceNote?: string;
};

export type ExternalLink = {
  label: string;
  url: string;
};

export type Game = {
  gameId: string;
  seasonId: string;
  seriesId: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  scheduledAt: string;
  status: GameStatus;
  originalScheduledAt: string | null;
  rescheduledFromGameId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  innings: number | null;
  isTie: boolean;
  note: string | null;
  attendance: number | null;
  externalLinks: ExternalLink[];
};

export type LineScoreInning = {
  inning: number;
  home: number;
  away: number;
};

export type BoxScoreHighlight = {
  playerId: string;
  label: string;
  value: string;
};

export type GameBoxScore = {
  gameId: string;
  winningPitcherId: string | null;
  losingPitcherId: string | null;
  savePitcherId: string | null;
  lineScore: LineScoreInning[];
  highlights: BoxScoreHighlight[];
};

export type Player = {
  playerId: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  birthDate: string | null;
  batsThrows: string | null;
  primaryPositions: string[];
  debutYear: number;
  franchiseIds: string[];
  bio: string;
};

export type RosterEvent = {
  rosterEventId: string;
  seasonId: string;
  playerId: string;
  seasonTeamId: string;
  type: RosterEventType;
  date: string;
  note: string;
};

export type PlayerSeasonStat = {
  statId: string;
  seasonId: string;
  playerId: string;
  seasonTeamId: string;
  statType: PlayerStatType;
  games: number;
  plateAppearances: number | null;
  atBats: number | null;
  hits: number | null;
  homeRuns: number | null;
  ops: number | null;
  era: number | null;
  inningsPitched: number | null;
  strikeouts: number | null;
  saves: number | null;
  wins: number | null;
  losses: number | null;
  war: number | null;
};

export type PlayerGameStat = {
  playerGameStatId: string;
  gameId: string;
  seasonId: string;
  playerId: string;
  seasonTeamId: string;
  statType: PlayerStatType;
  summaryLine: string;
};

export type PlayerSplitStat = {
  playerSplitStatId: string;
  seasonId: string;
  playerId: string;
  seasonTeamId: string;
  statType: PlayerStatType;
  splitType: PlayerSplitType;
  splitKey: string;
  splitLabel: string;
  games: number;
  plateAppearances: number | null;
  atBats: number | null;
  hits: number | null;
  homeRuns: number | null;
  ops: number | null;
  era: number | null;
  inningsPitched: number | null;
  strikeouts: number | null;
  saves: number | null;
  wins: number | null;
  losses: number | null;
  summaryLine: string;
};

export type TeamSeasonStat = {
  seasonId: string;
  seasonTeamId: string;
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  last10: string;
  streak: string;
  offensePlus: number;
  pitchingPlus: number;
  bullpenEra: number;
  teamWar: number;
};

export type TeamSplitStat = {
  splitId: string;
  seasonId: string;
  seasonTeamId: string;
  splitType: TeamSplitType;
  wins: number;
  losses: number;
  ties: number;
  metricLabel: string;
  metricValue: string;
};

export type Award = {
  awardId: string;
  seasonId: string;
  label: string;
  playerId: string | null;
  seasonTeamId: string | null;
  note: string;
};

export type SeasonSummary = {
  seasonId: string;
  headline: string;
  championSeasonTeamId: string;
  regularSeasonWinnerSeasonTeamId: string;
  narrative: string[];
};

export type PostseasonResult = {
  seasonId: string;
  round: SeriesType;
  winnerSeasonTeamId: string;
  loserSeasonTeamId: string;
  summary: string;
};

export type ExplanationReason = {
  key: string;
  label: string;
  direction: ExplanationDirection;
  magnitude: number;
  sentence: string;
};

export type TeamStrengthSnapshot = {
  seasonTeamId: string;
  offenseRating: number;
  starterRating: number;
  bullpenRating: number;
  winPct: number;
  recent10WinRate: number;
  opponentAdjustedRecent10WinRate: number;
  homePct: number;
  awayPct: number;
  splitGap: number;
  seasonProgress: number;
  homeFieldAdjustment: number;
  recentFormAdjustment: number;
  confidenceScore: number;
  priorWeight: number;
  currentWeight: number;
  scheduleDifficulty: number;
  headToHeadLeverage: number;
  explanationReasons: ExplanationReason[];
};

export type GameProbabilitySnapshot = {
  gameId: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeLikelyStarterId: string | null;
  awayLikelyStarterId: string | null;
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
  expectedRunsHome: number;
  expectedRunsAway: number;
  starterAdjustmentApplied: boolean;
  explanationReasons: ExplanationReason[];
};

export type RankDistribution = {
  seasonTeamId: string;
  counts: number[];
  probabilities: number[];
};

export type BucketOdds = {
  seasonTeamId: string;
  first: number;
  second: number;
  third: number;
  fourth: number;
  fifth: number;
  missPostseason: number;
};

export type PostseasonOdds = {
  seasonTeamId: string;
  wildcard: number;
  semipo: number;
  po: number;
  ks: number;
  champion: number;
};

export type ExpectedRecord = {
  seasonTeamId: string;
  expectedWins: number;
  expectedLosses: number;
  expectedTies: number;
  averageRank: number;
};

export type TieAlert = {
  positions: number[];
  seasonTeamIds: string[];
  probability: number;
  note: string;
};

export type SimulationSnapshot = {
  seasonId: string;
  generatedAt: string;
  iterations: number;
  rankDistributions: RankDistribution[];
  bucketOdds: BucketOdds[];
  postseasonOdds: PostseasonOdds[];
  expectedRecords: ExpectedRecord[];
  tieAlerts: TieAlert[];
  gameProbabilities: GameProbabilitySnapshot[];
  teamStrengths: TeamStrengthSnapshot[];
};

export type ScenarioOverride = {
  overrideId: string;
  targetType: ScenarioTargetType;
  targetId: string;
  forcedOutcome: ScenarioForcedOutcome;
  note: string;
};

export type UserScenario = {
  scenarioId: string;
  seasonId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  overrides: ScenarioOverride[];
};

export type ManualAdjustmentPatch = {
  seasonTeamId: string;
  offenseDelta: number;
  starterDelta: number;
  bullpenDelta: number;
  confidenceDelta: number;
  note: string;
  updatedAt: string;
};

export type ManualAdjustmentBundle = {
  updatedAt: string;
  patches: ManualAdjustmentPatch[];
};

export type GameSchedulePatch = {
  gameId: string;
  status: GameStatus;
  scheduledAt: string;
  note: string | null;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: string;
};

export type SchedulePatchBundle = {
  updatedAt: string;
  patches: GameSchedulePatch[];
};

export type SeasonMetaPatch = {
  seasonId: string;
  label: string;
  status: SeasonStatus;
  phase: SeasonPhase;
  rulesetId: string;
  updatedAt: string;
};

export type SeasonMetaPatchBundle = {
  updatedAt: string;
  patches: SeasonMetaPatch[];
};

export type TeamBrandPatch = {
  brandId: string;
  displayNameKo: string;
  shortNameKo: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  wordmarkText: string;
  updatedAt: string;
};

export type TeamBrandPatchBundle = {
  updatedAt: string;
  patches: TeamBrandPatch[];
};

export type ImportCandidateRow = {
  source: string;
  gameId: string;
  scheduledAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  note: string;
  importedAt: string;
};

export type ImportCandidateBundle = {
  updatedAt: string;
  rows: ImportCandidateRow[];
};

export type AuditActorRole = "admin";
export type AuditAction =
  | "manualAdjustment.saved"
  | "schedulePatch.saved"
  | "seasonMetaPatch.saved"
  | "teamBrandPatch.saved"
  | "importPreview.applied"
  | "importCandidates.queued"
  | "importCandidates.dismissed"
  | "importCandidates.cleared"
  | "admin.login.succeeded"
  | "admin.login.failed"
  | "admin.logout";

export type AuditLogEntry = {
  auditLogId: string;
  occurredAt: string;
  actorUsername: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  targetType: "manualAdjustment" | "schedule" | "season" | "teamBrand" | "import" | "auth";
  targetId: string;
  summary: string;
  ipAddress: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type AuditLogBundle = {
  updatedAt: string;
  entries: AuditLogEntry[];
};

export type TeamDisplay = {
  seasonTeamId: string;
  brandId: string;
  franchiseId: string;
  teamSlug: string;
  displayNameKo: string;
  shortNameKo: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
};

export type StandingRow = TeamDisplay & {
  rank: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  gamesBack: number;
  recent10: string;
  streak: string;
  home: string;
  away: string;
  runsScored: number;
  runsAllowed: number;
  offensePlus: number;
  pitchingPlus: number;
  bucketOdds?: BucketOdds;
  postseasonOdds?: PostseasonOdds;
};

export type KboDataBundle = {
  franchises: Franchise[];
  teamBrands: TeamBrand[];
  venues: Venue[];
  seasons: Season[];
  rulesets: KboSeasonRuleset[];
  seasonTeams: SeasonTeam[];
  series: Series[];
  games: Game[];
  gameBoxScores: GameBoxScore[];
  players: Player[];
  rosterEvents: RosterEvent[];
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  playerSplitStats: PlayerSplitStat[];
  teamSeasonStats: TeamSeasonStat[];
  teamSplitStats: TeamSplitStat[];
  awards: Award[];
  seasonSummaries: SeasonSummary[];
  postseasonResults: PostseasonResult[];
};

export type SimulationInput = {
  season: Season;
  ruleset: KboSeasonRuleset;
  seasonTeams: SeasonTeam[];
  series: Series[];
  games: Game[];
  teamSeasonStats: TeamSeasonStat[];
  players: Player[];
  rosterEvents: RosterEvent[];
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  previousSeasonStats: TeamSeasonStat[];
  scenarioOverrides: ScenarioOverride[];
};
