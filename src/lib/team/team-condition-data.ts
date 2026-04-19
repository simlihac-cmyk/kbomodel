import type {
  Game,
  GameProbabilitySnapshot,
  Player,
  PlayerGameStat,
  PlayerSeasonStat,
  PlayerSplitStat,
  RosterEvent,
  TeamDisplay,
  TeamSeasonStat,
  Venue,
} from "@/lib/domain/kbo/types";
import { type ParsedWeatherRow } from "@/lib/data-sources/kbo/dataset-types";
import type {
  ParsedPlayerGameLogPitcherRow,
  ParsedPlayerSummaryPitcherRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { parseOfficialKoWeather } from "@/lib/data-sources/kbo/adapters/official-ko/weather";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialEnPlayerSummaryPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-pitcher";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import { findSeasonTeamBySlug, getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";
import { getKboDateKey } from "@/lib/scheduler/kbo/windows";
import { buildPlayerImpactContext } from "@/lib/sim/kbo/player-impact";

type DashboardData = NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;

type TeamStub = {
  seasonTeamId: string;
  teamSlug: string;
  displayNameKo: string;
  shortNameKo: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
};

type WeatherSummary = {
  summary: string;
  tempLabel: string;
  precipitationProbability: number | null;
  cancellationRiskLabel: string;
  cancellationRiskTone: "positive" | "neutral" | "negative";
  cancellationRiskDetail: string;
};

type LiveStarterSummary = Pick<
  ParsedPlayerSummaryPitcherRow,
  "games" | "era" | "inningsPitched" | "wins" | "losses"
>;

type LiveStarterGameLog = Pick<
  ParsedPlayerGameLogPitcherRow,
  "date" | "opponentTeamName" | "result" | "inningsPitched" | "earnedRuns"
>;

type StarterPreview = {
  playerId: string | null;
  playerName: string;
  announced: boolean;
  liveSummary: LiveStarterSummary | null;
  liveLogs: LiveStarterGameLog[] | null;
  handLabel: string;
  profileLabel: string;
  seasonRecordLabel: string;
  eraLabel: string;
  inningsLabel: string;
  versusOpponentLabel: string;
  recentFormLabel: string;
  note: string;
  team: TeamStub;
};

type BullpenAnchor = {
  playerId: string;
  playerName: string;
  roleLabel: string;
  eraLabel: string;
  leverageLabel: string;
  recentAppearanceLabel: string;
  availabilityLabel: string;
  availabilityTone: "positive" | "neutral" | "negative";
};

type AvailabilityItem = {
  playerId: string;
  playerName: string;
  positionLabel: string;
  note: string;
};

type BullpenPanel = {
  team: TeamStub;
  bullpenEraLabel: string;
  bullpenRatingLabel: string;
  anchorAvailabilityLabel: string;
  recentLoadLabel: string;
  recentLoadNote: string;
  anchors: BullpenAnchor[];
  unavailablePlayers: AvailabilityItem[];
  returningPlayers: AvailabilityItem[];
  summaryNote: string | null;
};

type KeyPlayer = {
  playerId: string;
  playerName: string;
  positionLabel: string;
  reason: string;
};

type ExpectedLineupItem = {
  slot: number;
  playerId: string | null;
  playerName: string;
  positionLabel: string;
  battingAverageLabel: string;
  opsLabel: string;
  homeRunsLabel: string;
  rbiLabel: string;
  note: string;
};

type TeamConditionLineupStatus = {
  isConfirmed: boolean;
  chipLabel: string;
  badgeLabel: string;
  detail: string;
};

type TeamConditionMetricKey =
  | "offense"
  | "starter"
  | "bullpen"
  | "lineup"
  | "health";

type TeamConditionMetric = {
  key: TeamConditionMetricKey;
  label: string;
  score: number;
  why: string;
  percentile: number;
  statusLabel: string;
  tone: "positive" | "neutral" | "negative";
  isProvisional?: boolean;
  distributionNote?: string | null;
};

type TeamConditionStrengthSnapshot = {
  team: TeamStub;
  overallScore: number;
  statusLabel: string;
  statusTone: "positive" | "neutral" | "negative";
  percentile: number;
  summary: string;
  metrics: TeamConditionMetric[];
  distributionNote?: string | null;
};

type TeamConditionLeaguePriors = {
  lineupOpsScore: number;
  recentRunsScore: number;
  starterEraScore: number;
  starterLengthScore: number;
  recentStarterEraScore: number;
  recentStarterLengthScore: number;
  bullpenEraScore: number;
};

function getRawWeatherRepository() {
  return new FileRawSourceRepository();
}

const GAME_CENTER_GAME_LIST_URL = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList";
const GAME_CENTER_LINEUP_URL = "https://www.koreabaseball.com/ws/Schedule.asmx/GetLineUpAnalysis";
const OFFICIAL_EN_PITCHER_SUMMARY_URL = "https://eng.koreabaseball.com/Teams/PlayerInfoPitcher/Summary.aspx";
const OFFICIAL_EN_PITCHER_GAME_LOGS_URL = "https://eng.koreabaseball.com/Teams/PlayerInfoPitcher/GameLogs.aspx";
const TEAM_CONDITION_USER_AGENT = "kbo-race-lab/0.1 (+team-condition)";

const OFFICIAL_EN_TEAM_LOG_ALIASES: Record<string, string[]> = {
  "doosan-bears": ["DOOSAN", "DOO"],
  "lg-twins": ["LG"],
  "kia-tigers": ["KIA"],
  "samsung-lions": ["SAMSUNG", "SAM"],
  "lotte-giants": ["LOTTE", "LOT"],
  "hanwha-eagles": ["HANWHA", "HAN"],
  "kt-wiz": ["KT"],
  "nc-dinos": ["NC"],
  "ssg-landers": ["SSG", "SK"],
  "kiwoom-heroes": ["KIWOOM", "KIW", "NEXEN", "NEX"],
};

type GameCenterGameListEntry = {
  LE_ID?: number | string | null;
  SR_ID?: number | string | null;
  SEASON_ID?: number | string | null;
  G_ID?: string | null;
  LINEUP_CK?: number | string | boolean | null;
  START_PIT_CK?: number | string | boolean | null;
  AWAY_ID?: string | null;
  HOME_ID?: string | null;
  T_PIT_P_ID?: number | string | null;
  T_PIT_P_NM?: string | null;
  B_PIT_P_ID?: number | string | null;
  B_PIT_P_NM?: string | null;
};

type GameCenterLineupRow = {
  slot: number;
  positionLabel: string;
  playerName: string;
  warLabel: string | null;
};

type OfficialGameCenterLineupSource =
  | {
      state: "confirmed";
      homeRows: GameCenterLineupRow[];
      awayRows: GameCenterLineupRow[];
    }
  | {
      state: "pending" | "unavailable";
      homeRows: [];
      awayRows: [];
    };

type OfficialGameCenterStarterRef = {
  officialPlayerCode: string | null;
  playerName: string | null;
};

type OfficialGameCenterStarterSource =
  | {
      state: "confirmed";
      homeStarter: OfficialGameCenterStarterRef | null;
      awayStarter: OfficialGameCenterStarterRef | null;
    }
  | {
      state: "pending" | "unavailable";
      homeStarter: null;
      awayStarter: null;
    };

const getLatestWeatherRows = async (): Promise<ParsedWeatherRow[]> => {
  const snapshot = await getRawWeatherRepository().getLatestSnapshot("official-kbo-ko", "weather");
  if (!snapshot) {
    return [];
  }

  return parseOfficialKoWeather(snapshot.html);
};

function normalizeNameKey(value: string) {
  return value.replace(/[\s._·・-]+/g, "").toUpperCase();
}

function extractOfficialGameCenterIdentity(game: Game) {
  const gameCenterLink = game.externalLinks.find((link) =>
    link.url.includes("/Schedule/GameCenter/Main.aspx"),
  );

  if (gameCenterLink) {
    try {
      const url = new URL(gameCenterLink.url);
      const gameDate = url.searchParams.get("gameDate");
      const gameId = url.searchParams.get("gameId");
      if (gameDate && gameId) {
        return {
          gameDate,
          officialGameId: gameId,
        };
      }
    } catch {
      // Fall through to the normalized game id path below.
    }
  }

  const rawGameId = game.gameId.split(":").pop() ?? "";
  const match = rawGameId.match(/^(\d{8}).+/);
  if (!match) {
    return null;
  }

  return {
    gameDate: match[1],
    officialGameId: rawGameId,
  };
}

function normalizeOfficialPlayerCode(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOfficialPlayerName(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const getOfficialGameCenterGamesForDate = async (gameDate: string): Promise<GameCenterGameListEntry[]> => {
  try {
    const params = new URLSearchParams({
      leId: "1",
      srId: "0,1,3,4,5,6,7,8,9",
      date: gameDate,
    });
    const response = await fetch(GAME_CENTER_GAME_LIST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": TEAM_CONDITION_USER_AGENT,
      },
      body: params.toString(),
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { game?: GameCenterGameListEntry[] };
    return Array.isArray(payload.game) ? payload.game : [];
  } catch {
    return [];
  }
};

function parseGameCenterLineupRows(payload: unknown): GameCenterLineupRow[] {
  try {
    const grid = typeof payload === "string" ? JSON.parse(payload) : payload;
    const rows = Array.isArray((grid as { rows?: unknown[] } | null)?.rows)
      ? (grid as { rows: Array<{ row?: Array<{ Text?: string | null }> }> }).rows
      : [];

    return rows
      .map((item) => {
        const cells = Array.isArray(item.row) ? item.row : [];
        const slot = Number.parseInt(String(cells[0]?.Text ?? "").trim(), 10);
        const positionLabel = String(cells[1]?.Text ?? "").trim();
        const playerName = String(cells[2]?.Text ?? "").trim();
        const warLabel = String(cells[3]?.Text ?? "").trim() || null;
        if (!Number.isFinite(slot) || !playerName) {
          return null;
        }
        return {
          slot,
          positionLabel: positionLabel || "포지션 미표기",
          playerName,
          warLabel,
        };
      })
      .filter((item): item is GameCenterLineupRow => item !== null)
      .sort((left, right) => left.slot - right.slot)
      .slice(0, 9);
  } catch {
    return [];
  }
}

const getOfficialGameCenterLineupSource =
  async (gameDate: string, officialGameId: string): Promise<OfficialGameCenterLineupSource> => {
    const gameEntries = await getOfficialGameCenterGamesForDate(gameDate);
    const entry =
      gameEntries.find((item) => String(item.G_ID ?? "") === officialGameId) ?? null;
    if (!entry) {
      return {
        state: "unavailable",
        homeRows: [],
        awayRows: [],
      };
    }

    try {
      const params = new URLSearchParams({
        leId: String(entry.LE_ID ?? 1),
        srId: String(entry.SR_ID ?? 0),
        seasonId: String(entry.SEASON_ID ?? gameDate.slice(0, 4)),
        gameId: officialGameId,
      });
      const response = await fetch(GAME_CENTER_LINEUP_URL, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
          "user-agent": TEAM_CONDITION_USER_AGENT,
        },
        body: params.toString(),
        cache: "no-store",
      });
      if (!response.ok) {
        return {
          state: "unavailable",
          homeRows: [],
          awayRows: [],
        };
      }

      const payload = (await response.json()) as unknown[];
      const confirmed = Boolean(
        Array.isArray(payload?.[0]) &&
          typeof payload?.[0]?.[0] === "object" &&
          payload?.[0]?.[0] !== null &&
          "LINEUP_CK" in (payload[0][0] as Record<string, unknown>) &&
          (payload[0][0] as Record<string, unknown>).LINEUP_CK === true,
      );
      if (!confirmed) {
        return {
          state: "pending",
          homeRows: [],
          awayRows: [],
        };
      }

      const homeRows = parseGameCenterLineupRows(Array.isArray(payload[3]) ? payload[3][0] : null);
      const awayRows = parseGameCenterLineupRows(Array.isArray(payload[4]) ? payload[4][0] : null);
      if (homeRows.length === 0 && awayRows.length === 0) {
        return {
          state: "unavailable",
          homeRows: [],
          awayRows: [],
        };
      }

      return {
        state: "confirmed",
        homeRows,
        awayRows,
      };
    } catch {
      return {
        state: "unavailable",
        homeRows: [],
        awayRows: [],
      };
    }
  };

async function getOfficialLineupSourceForGame(game: Game) {
  const identity = extractOfficialGameCenterIdentity(game);
  if (!identity) {
    return {
      state: "unavailable",
      homeRows: [],
      awayRows: [],
    } satisfies OfficialGameCenterLineupSource;
  }

  return getOfficialGameCenterLineupSource(identity.gameDate, identity.officialGameId);
}

const getOfficialGameCenterStarterSource =
  async (gameDate: string, officialGameId: string): Promise<OfficialGameCenterStarterSource> => {
    const gameEntries = await getOfficialGameCenterGamesForDate(gameDate);
    const entry =
      gameEntries.find((item) => String(item.G_ID ?? "") === officialGameId) ?? null;
    if (!entry) {
      return {
        state: "unavailable",
        homeStarter: null,
        awayStarter: null,
      };
    }

    const awayStarter = {
      officialPlayerCode: normalizeOfficialPlayerCode(entry.T_PIT_P_ID),
      playerName: normalizeOfficialPlayerName(entry.T_PIT_P_NM),
    };
    const homeStarter = {
      officialPlayerCode: normalizeOfficialPlayerCode(entry.B_PIT_P_ID),
      playerName: normalizeOfficialPlayerName(entry.B_PIT_P_NM),
    };
    const hasStarter =
      Boolean(awayStarter.officialPlayerCode || awayStarter.playerName) &&
      Boolean(homeStarter.officialPlayerCode || homeStarter.playerName);

    if (!hasStarter || Number(entry.START_PIT_CK ?? 0) !== 1) {
      return {
        state: "pending",
        homeStarter: null,
        awayStarter: null,
      };
    }

    return {
      state: "confirmed",
      homeStarter,
      awayStarter,
    };
  };

async function getOfficialStarterSourceForGame(game: Game) {
  const identity = extractOfficialGameCenterIdentity(game);
  if (!identity) {
    return {
      state: "unavailable",
      homeStarter: null,
      awayStarter: null,
    } satisfies OfficialGameCenterStarterSource;
  }

  return getOfficialGameCenterStarterSource(identity.gameDate, identity.officialGameId);
}

async function getOfficialPitcherSummaryByCode(
  officialPlayerCode: string | null | undefined,
): Promise<LiveStarterSummary | null> {
  if (!officialPlayerCode) {
    return null;
  }

  try {
    const url = new URL(OFFICIAL_EN_PITCHER_SUMMARY_URL);
    url.searchParams.set("pcode", officialPlayerCode);
    const response = await fetchHtml(url.toString(), {
      headers: {
        "user-agent": TEAM_CONDITION_USER_AGENT,
      },
    });
    const row = parseOfficialEnPlayerSummaryPitcher(response.html)[0] ?? null;
    if (!row) {
      return null;
    }
    return {
      games: row.games,
      era: row.era,
      inningsPitched: row.inningsPitched,
      wins: row.wins,
      losses: row.losses,
    };
  } catch {
    return null;
  }
}

async function getOfficialPitcherGameLogsByCode(
  officialPlayerCode: string | null | undefined,
): Promise<LiveStarterGameLog[] | null> {
  if (!officialPlayerCode) {
    return null;
  }

  try {
    const url = new URL(OFFICIAL_EN_PITCHER_GAME_LOGS_URL);
    url.searchParams.set("pcode", officialPlayerCode);
    const response = await fetchHtml(url.toString(), {
      headers: {
        "user-agent": TEAM_CONDITION_USER_AGENT,
      },
    });
    return parseOfficialEnPlayerGameLogsPitcher(response.html).map((row) => ({
      date: row.date,
      opponentTeamName: row.opponentTeamName,
      result: row.result,
      inningsPitched: row.inningsPitched,
      earnedRuns: row.earnedRuns,
    }));
  } catch {
    return null;
  }
}

function buildTeamConditionLineupStatus(
  source: OfficialGameCenterLineupSource,
): TeamConditionLineupStatus {
  if (source.state === "confirmed") {
    return {
      isConfirmed: true,
      chipLabel: "공식 확정 라인업 반영",
      badgeLabel: "공식 발표 완료",
      detail: "KBO 공식 확정 라인업이 발표돼 타선과 키플레이어를 바로 갱신합니다.",
    };
  }

  if (source.state === "pending") {
    return {
      isConfirmed: false,
      chipLabel: "예상 라인업 반영",
      badgeLabel: "공식 발표 전",
      detail: "공식 라인업 발표 전이라 최근 타순 패턴을 기준으로 예상 타선을 구성했습니다. 발표되면 자동으로 바뀝니다.",
    };
  }

  return {
    isConfirmed: false,
    chipLabel: "예상 라인업 반영",
    badgeLabel: "공식 데이터 대기",
    detail: "공식 라인업 데이터를 아직 불러오지 못해 최근 타순 패턴을 기준으로 예상 타선을 구성했습니다.",
  };
}

function toTeamStub(display: TeamDisplay): TeamStub {
  return {
    seasonTeamId: display.seasonTeamId,
    teamSlug: display.teamSlug,
    displayNameKo: display.displayNameKo,
    shortNameKo: display.shortNameKo,
    shortCode: display.shortCode,
    primaryColor: display.primaryColor,
    secondaryColor: display.secondaryColor,
  };
}

function normalizeInningsValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  const whole = Math.trunc(value);
  const fraction = Math.round((value - whole) * 10);
  if (fraction === 1) {
    return whole + 1 / 3;
  }
  if (fraction === 2) {
    return whole + 2 / 3;
  }
  return value;
}

function formatRate(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

function formatRateLabel(value: number | null | undefined, digits: number) {
  const formatted = formatRate(value, digits);
  return formatted.startsWith("0.") ? formatted.replace(/^0(?=\.)/, "") : formatted;
}

function formatInnings(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  const normalized = normalizeInningsValue(value);
  const whole = Math.trunc(normalized);
  const thirds = Math.round((normalized - whole) * 3);
  if (thirds <= 0) {
    return `${whole}`;
  }
  if (thirds === 1) {
    return `${whole}\u2153`;
  }
  if (thirds === 2) {
    return `${whole}\u2154`;
  }
  return `${whole + 1}`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function upScore(value: number | null | undefined, low: number, high: number) {
  if (value === null || value === undefined || Number.isNaN(value) || high <= low) {
    return 50;
  }
  return clampScore(((value - low) / (high - low)) * 100);
}

function downScore(value: number | null | undefined, low: number, high: number) {
  return 100 - upScore(value, low, high);
}

function shrinkScore(score: number, sample: number, k: number, priorScore: number) {
  const safeSample = Math.max(0, sample);
  const safeK = Math.max(0, k);
  if (safeSample + safeK === 0) {
    return clampScore(priorScore);
  }
  return clampScore((safeSample / (safeSample + safeK)) * score + (safeK / (safeSample + safeK)) * priorScore);
}

function average(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  if (numbers.length === 0) {
    return null;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function roundScore(value: number) {
  return Math.round(clampScore(value));
}

function parsePitchingHand(batsThrows: string | null | undefined) {
  if (!batsThrows) {
    return "투구 유형 미확인";
  }
  if (batsThrows.includes("언")) {
    return "언더핸드";
  }
  if (batsThrows.includes("좌투")) {
    return "좌완";
  }
  if (batsThrows.includes("우투")) {
    return "우완";
  }
  return batsThrows;
}

function positionLabel(player: Player | undefined) {
  const position = player?.primaryPositions[0] ?? "UTIL";
  if (position === "SP") return "선발";
  if (position === "P") return "투수";
  if (position === "C") return "포수";
  if (position === "IF") return "내야수";
  if (position === "OF") return "외야수";
  return "야수";
}

function isActiveScheduledGame(game: Game) {
  return game.status !== "final" && game.status !== "postponed";
}

function buildGamesById(games: Game[]) {
  return Object.fromEntries(games.map((game) => [game.gameId, game] as const));
}

function buildLatestEventByPlayer(teamEvents: RosterEvent[]) {
  return Object.fromEntries(
    [...teamEvents]
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => [event.playerId, event] as const),
  ) as Record<string, RosterEvent>;
}

function sameTeamGame(game: Game, seasonTeamId: string) {
  return game.homeSeasonTeamId === seasonTeamId || game.awaySeasonTeamId === seasonTeamId;
}

function opponentTeamId(game: Game, seasonTeamId: string) {
  return game.homeSeasonTeamId === seasonTeamId ? game.awaySeasonTeamId : game.homeSeasonTeamId;
}

function resultForTeam(game: Game, seasonTeamId: string) {
  if (game.homeScore === null || game.awayScore === null || game.isTie || game.homeScore === game.awayScore) {
    return "T";
  }
  const won =
    game.homeSeasonTeamId === seasonTeamId
      ? game.homeScore > game.awayScore
      : game.awayScore > game.homeScore;
  return won ? "W" : "L";
}

type PitcherAppearanceLike = {
  result?: string | null;
  inningsPitched?: number | null;
  earnedRuns?: number | null;
};

function calcEraFromLogs(logs: PitcherAppearanceLike[]) {
  const earnedRuns = logs.reduce((sum, log) => sum + (log.earnedRuns ?? 0), 0);
  const innings = logs.reduce((sum, log) => sum + normalizeInningsValue(log.inningsPitched), 0);
  if (innings <= 0) {
    return null;
  }
  return (earnedRuns * 9) / innings;
}

function sortLivePitcherGameLogs(logs: LiveStarterGameLog[]) {
  return [...logs].sort((left, right) => right.date.localeCompare(left.date));
}

function normalizeOfficialTeamLogToken(value: string | null | undefined) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function matchesOfficialOpponent(opponentTeam: TeamDisplay, candidate: string | null | undefined) {
  const candidateToken = normalizeOfficialTeamLogToken(candidate);
  if (!candidateToken) {
    return false;
  }
  const aliases = OFFICIAL_EN_TEAM_LOG_ALIASES[opponentTeam.teamSlug] ?? [opponentTeam.shortCode];
  return aliases.some((alias) => {
    const aliasToken = normalizeOfficialTeamLogToken(alias);
    return aliasToken === candidateToken || aliasToken.includes(candidateToken) || candidateToken.includes(aliasToken);
  });
}

function formatRecentPitcherForm(logs: PitcherAppearanceLike[]) {
  if (logs.length === 0) {
    return "최근 등판 기록 없음";
  }
  const wins = logs.filter((log) => log.result === "W").length;
  const losses = logs.filter((log) => log.result === "L").length;
  const era = calcEraFromLogs(logs);
  return `최근 ${logs.length}경기 ${wins}승 ${losses}패 ERA ${formatRate(era, 2)}`;
}

function formatPitcherVsOpponent(logs: PitcherAppearanceLike[]) {
  if (logs.length === 0) {
    return "상대 전적 없음";
  }
  const era = calcEraFromLogs(logs);
  return `${logs.length}경기 ERA ${formatRate(era, 2)}`;
}

function bullpenAvailabilityStatus(score: number) {
  if (score >= 80) {
    return {
      label: "오늘 투입 가능",
      tone: "positive" as const,
    };
  }
  if (score >= 55) {
    return {
      label: "연투 주의",
      tone: "neutral" as const,
    };
  }
  return {
    label: "과부하 주의",
    tone: "negative" as const,
  };
}

function inferPitcherRole(stat: PlayerSeasonStat) {
  if ((stat.saves ?? 0) > 0 && (stat.saves ?? 0) >= (stat.holds ?? 0)) {
    return "마무리";
  }
  if ((stat.holds ?? 0) > 0) {
    return "셋업";
  }
  const inningsPerGame =
    stat.games > 0 && stat.inningsPitched !== null && stat.inningsPitched !== undefined
      ? normalizeInningsValue(stat.inningsPitched) / stat.games
      : 0;
  if (inningsPerGame <= 2.2) {
    return "불펜";
  }
  return "선발";
}

function buildPitcherRecentAppearanceLabel(
  stat: PlayerSeasonStat,
  gameLogs: PlayerGameStat[],
) {
  const latest = gameLogs[0];
  if (!latest) {
    return "최근 등판 없음";
  }
  return `${latest.summaryLine}`;
}

function rankRelievers(
  teamId: string,
  playerSeasonStats: PlayerSeasonStat[],
) {
  return playerSeasonStats
    .filter((stat) => stat.seasonTeamId === teamId && stat.statType === "pitcher")
    .filter((stat) => inferPitcherRole(stat) !== "선발")
    .sort((left, right) => {
      const leftScore =
        (left.saves ?? 0) * 4 +
        (left.holds ?? 0) * 3 +
        (left.strikeouts ?? 0) * 0.12 -
        (left.era ?? 6);
      const rightScore =
        (right.saves ?? 0) * 4 +
        (right.holds ?? 0) * 3 +
        (right.strikeouts ?? 0) * 0.12 -
        (right.era ?? 6);
      return rightScore - leftScore;
    });
}

function buildRecentBullpenLoadLabel(
  teamId: string,
  relieverIds: Set<string>,
  playerGameStats: PlayerGameStat[],
  games: Game[],
) {
  const recentGameIds = games
    .filter((game) => game.status === "final" && sameTeamGame(game, teamId))
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5)
    .map((game) => game.gameId);
  const bullpenLogs = playerGameStats.filter(
    (log) =>
      log.statType === "pitcher" &&
      log.seasonTeamId === teamId &&
      relieverIds.has(log.playerId) &&
      recentGameIds.includes(log.gameId),
  );
  const totalInnings = bullpenLogs.reduce(
    (sum, log) => sum + normalizeInningsValue(log.inningsPitched),
    0,
  );
  const uniquePitchers = new Set(bullpenLogs.map((log) => log.playerId)).size;
  return {
    label: `최근 5경기 ${bullpenLogs.length}회 등판 · ${formatInnings(totalInnings)}이닝`,
    note:
      uniquePitchers > 0
        ? `최근 5경기 동안 불펜 ${uniquePitchers}명이 투입됐습니다.`
        : "최근 5경기 불펜 사용량 데이터가 아직 없습니다.",
  };
}

function buildAvailabilityLists(
  teamId: string,
  rosterEvents: RosterEvent[],
  playersById: Record<string, Player>,
) {
  const teamEvents = rosterEvents.filter((event) => event.seasonTeamId === teamId);
  const latestEventByPlayer = buildLatestEventByPlayer(teamEvents);
  const unavailablePlayers = Object.values(latestEventByPlayer)
    .filter((event) => ["injured", "transferred", "released"].includes(event.type))
    .map((event) => ({
      playerId: event.playerId,
      playerName: playersById[event.playerId]?.nameKo ?? event.playerId,
      positionLabel: positionLabel(playersById[event.playerId]),
      note: event.note,
    }))
    .sort((left, right) => left.playerName.localeCompare(right.playerName, "ko"));
  const returningPlayers = Object.values(latestEventByPlayer)
    .filter((event) => ["activated", "joined"].includes(event.type))
    .slice(0, 5)
    .map((event) => ({
      playerId: event.playerId,
      playerName: playersById[event.playerId]?.nameKo ?? event.playerId,
      positionLabel: positionLabel(playersById[event.playerId]),
      note: event.note,
    }))
    .sort((left, right) => right.note.localeCompare(left.note, "ko"));

  return {
    unavailablePlayers,
    returningPlayers,
  };
}

function headToHeadSummary(teamId: string, opponentId: string, games: Game[]) {
  const matchedGames = games
    .filter((game) => game.status === "final")
    .filter(
      (game) =>
        (game.homeSeasonTeamId === teamId && game.awaySeasonTeamId === opponentId) ||
        (game.homeSeasonTeamId === opponentId && game.awaySeasonTeamId === teamId),
    );
  const record = matchedGames
    .reduce(
      (accumulator, game) => {
        const result = resultForTeam(game, teamId);
        if (result === "W") accumulator.wins += 1;
        else if (result === "L") accumulator.losses += 1;
        else accumulator.ties += 1;
        return accumulator;
      },
      { wins: 0, losses: 0, ties: 0 },
    );
  const totalGames = matchedGames.length;
  return `${record.wins}승 ${record.losses}패${record.ties > 0 ? ` ${record.ties}무` : ""} · ${totalGames}경기`;
}

function matchesWeatherDate(rowDate: string, scheduledAt: string) {
  const dateKey = getKboDateKey(new Date(scheduledAt));
  if (rowDate.includes(dateKey)) {
    return true;
  }

  const [, month, day] = dateKey.split("-");
  return rowDate.includes(`${month}.${day}`) || rowDate.includes(`${Number(month)}.${Number(day)}`);
}

function normalizeLookupText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function matchWeatherRow(
  weatherRows: ParsedWeatherRow[],
  venue: Venue | null,
  scheduledAt: string,
) {
  if (!venue) {
    return null;
  }

  const normalizedVenue = normalizeLookupText(venue.nameKo);
  return (
    weatherRows.find(
      (row) =>
        matchesWeatherDate(row.date, scheduledAt) &&
        (normalizeLookupText(row.venueName).includes(normalizedVenue) ||
          normalizedVenue.includes(normalizeLookupText(row.venueName))),
    ) ??
    weatherRows.find(
      (row) =>
        normalizeLookupText(row.venueName).includes(normalizedVenue) ||
        normalizedVenue.includes(normalizeLookupText(row.venueName)),
    ) ??
    null
  );
}

function weatherSummary(row: ParsedWeatherRow | null): WeatherSummary | null {
  if (!row) {
    return null;
  }

  const precip = row.precipitationProbability;
  const tempLabel = row.tempC !== null ? `${row.tempC.toFixed(1)}°C` : "기온 정보 없음";
  const cancellationRiskLabel =
    precip === null
      ? "계산 대기"
      : precip >= 70
        ? "높음"
        : precip >= 40
          ? "주의"
          : "낮음";
  const cancellationRiskTone =
    precip === null ? "neutral" : precip >= 70 ? "negative" : precip >= 40 ? "neutral" : "positive";
  const cancellationRiskDetail =
    precip === null ? "날씨 데이터 수신 후 취소 리스크를 자동 계산합니다." : `강수확률 ${precip}% 기준 추정`;

  return {
    summary: row.summary,
    tempLabel,
    precipitationProbability: precip,
    cancellationRiskLabel,
    cancellationRiskTone,
    cancellationRiskDetail,
  };
}

function sortPlayerGameLogs(logs: PlayerGameStat[], gamesById: Record<string, Game>) {
  return [...logs].sort(
    (left, right) =>
      (gamesById[right.gameId]?.scheduledAt ?? "").localeCompare(gamesById[left.gameId]?.scheduledAt ?? ""),
  );
}

function teamRunsScored(game: Game, seasonTeamId: string) {
  if (game.homeScore === null || game.awayScore === null) {
    return null;
  }
  return game.homeSeasonTeamId === seasonTeamId ? game.homeScore : game.awayScore;
}

function daysBetween(earlier: string, later: string) {
  const diffMs = new Date(later).getTime() - new Date(earlier).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const BATTING_ORDER_WEIGHTS: Record<number, number> = {
  1: 1.08,
  2: 1.05,
  3: 1.03,
  4: 1.01,
  5: 0.99,
  6: 0.97,
  7: 0.95,
  8: 0.93,
  9: 0.91,
};

function weightedAverageBy<T>(
  items: T[],
  valueSelector: (item: T) => number | null | undefined,
  weightSelector: (item: T) => number | null | undefined,
) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    const value = valueSelector(item);
    const weight = weightSelector(item);
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value) ||
      weight === null ||
      weight === undefined ||
      Number.isNaN(weight) ||
      weight <= 0
    ) {
      continue;
    }
    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return null;
  }

  return weightedSum / totalWeight;
}

function buildStarterPreview(args: {
  starterPlayerId: string | null;
  starterNameOverride?: string | null;
  announced?: boolean;
  liveSummary?: LiveStarterSummary | null;
  liveLogs?: LiveStarterGameLog[] | null;
  team: TeamDisplay;
  opponentTeam: TeamDisplay;
  playersById: Record<string, Player>;
  teamPitcherStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  gamesById: Record<string, Game>;
  note: string;
}): StarterPreview {
  const {
    starterPlayerId,
    starterNameOverride,
    announced = false,
    liveSummary = null,
    liveLogs = null,
    team,
    opponentTeam,
    playersById,
    teamPitcherStats,
    playerGameStats,
    gamesById,
    note,
  } = args;
  const stat = starterPlayerId
    ? teamPitcherStats.find((item) => item.playerId === starterPlayerId) ?? null
    : null;
  const player = starterPlayerId ? playersById[starterPlayerId] : null;
  const logs = starterPlayerId
    ? sortPlayerGameLogs(
        playerGameStats.filter((item) => item.playerId === starterPlayerId && item.statType === "pitcher"),
        gamesById,
      )
    : [];
  const fallbackLogs = sortLivePitcherGameLogs(liveLogs ?? []);
  const versusOpponentLogs = (logs.length > 0
    ? logs.filter((log) => {
        const game = gamesById[log.gameId];
        if (!game) {
          return false;
        }
        return opponentTeam.seasonTeamId === (game.homeSeasonTeamId === team.seasonTeamId ? game.awaySeasonTeamId : game.homeSeasonTeamId);
      })
    : fallbackLogs.filter((log) => matchesOfficialOpponent(opponentTeam, log.opponentTeamName)));
  const recentLogs = (logs.length > 0 ? logs : fallbackLogs).slice(0, 3);

  return {
    playerId: starterPlayerId,
    playerName: player?.nameKo ?? starterNameOverride ?? "예상 선발 미확정",
    announced,
    liveSummary,
    liveLogs,
    handLabel: player ? parsePitchingHand(player?.batsThrows) : "발표 대기",
    profileLabel:
      player?.heightWeight ?? player?.batsThrows ?? (starterNameOverride ? "공식 발표 기준" : "선발 발표 후 프로필이 연결됩니다."),
    seasonRecordLabel: stat
      ? `${stat.wins ?? 0}승 ${stat.losses ?? 0}패`
      : liveSummary
        ? `${liveSummary.wins}승 ${liveSummary.losses}패`
        : "-",
    eraLabel: stat ? formatRate(stat.era, 2) : liveSummary ? formatRate(liveSummary.era, 2) : "-",
    inningsLabel: stat ? formatInnings(stat.inningsPitched) : liveSummary ? formatInnings(liveSummary.inningsPitched) : "-",
    versusOpponentLabel: formatPitcherVsOpponent(versusOpponentLogs),
    recentFormLabel: formatRecentPitcherForm(recentLogs),
    note: player || starterNameOverride ? note : "선발 발표 후 컨디션과 총점이 자동으로 갱신됩니다.",
    team: toTeamStub(team),
  };
}

function lineupCandidateScore(stat: PlayerSeasonStat) {
  return (stat.ops ?? 0) * 100 + (stat.homeRuns ?? 0) * 3 + (stat.rbi ?? 0) * 0.9 + (stat.hits ?? 0) * 0.12;
}

function parseBattingOrderKey(splitKey: string) {
  const match = splitKey.match(/^BATTING\s+#(\d+)/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function buildExpectedLineup(args: {
  teamId: string;
  playersById: Record<string, Player>;
  playerSeasonStats: PlayerSeasonStat[];
  playerSplitStats: PlayerSplitStat[];
}): ExpectedLineupItem[] {
  const hitters = args.playerSeasonStats
    .filter((stat) => stat.seasonTeamId === args.teamId && stat.statType === "hitter")
    .map((stat) => {
      const player = args.playersById[stat.playerId];
      const battingOrderSplits = args.playerSplitStats
        .filter((split) => split.playerId === stat.playerId && split.statType === "hitter")
        .filter((split) => split.splitType === "situation" && split.splitKey.startsWith("BATTING #"));
      const preferredOrder = battingOrderSplits
        .map((split) => ({
          order: parseBattingOrderKey(split.splitKey),
          weight: split.plateAppearances ?? split.atBats ?? 0,
        }))
        .filter((item): item is { order: number; weight: number } => item.order !== null)
        .sort((left, right) => right.weight - left.weight || left.order - right.order)[0];

      return {
        stat,
        player,
        preferredOrder: preferredOrder?.order ?? null,
        orderWeight: preferredOrder?.weight ?? 0,
        score: lineupCandidateScore(stat),
      };
    })
    .sort((left, right) => {
      if (left.preferredOrder !== null && right.preferredOrder !== null && left.preferredOrder !== right.preferredOrder) {
        return left.preferredOrder - right.preferredOrder;
      }
      if (left.preferredOrder !== null && right.preferredOrder === null) {
        return -1;
      }
      if (left.preferredOrder === null && right.preferredOrder !== null) {
        return 1;
      }
      return right.orderWeight - left.orderWeight || right.score - left.score;
    });

  const used = new Set<string>();
  const lineup: ExpectedLineupItem[] = [];

  for (let slot = 1; slot <= 9; slot += 1) {
    const exact = hitters.find((candidate) => candidate.preferredOrder === slot && !used.has(candidate.stat.playerId));
    const fallback = hitters.find((candidate) => !used.has(candidate.stat.playerId));
    const picked = exact ?? fallback;
    if (!picked) {
      continue;
    }
    used.add(picked.stat.playerId);
    lineup.push({
      slot,
      playerId: picked.stat.playerId,
      playerName: picked.player?.nameKo ?? picked.stat.playerId,
      positionLabel: positionLabel(picked.player),
      battingAverageLabel: formatRateLabel(picked.stat.battingAverage, 3),
      opsLabel: formatRate(picked.stat.ops, 3),
      homeRunsLabel: `${picked.stat.homeRuns ?? 0}`,
      rbiLabel: `${picked.stat.rbi ?? 0}`,
      note:
        picked.preferredOrder !== null
          ? `최근 타순 패턴상 ${picked.preferredOrder}번 출전 비중이 높습니다.`
          : "최근 타순 패턴이 부족해 시즌 중심 타선 기준으로 채웠습니다.",
    });
  }

  return lineup;
}

function buildConfirmedLineup(args: {
  teamId: string;
  rows: GameCenterLineupRow[];
  playersById: Record<string, Player>;
  playerSeasonStats: PlayerSeasonStat[];
}): ExpectedLineupItem[] {
  const hitters = args.playerSeasonStats
    .filter((stat) => stat.seasonTeamId === args.teamId && stat.statType === "hitter")
    .map((stat) => ({
      stat,
      player: args.playersById[stat.playerId],
      nameKey: normalizeNameKey(args.playersById[stat.playerId]?.nameKo ?? ""),
    }))
    .sort((left, right) => (right.stat.plateAppearances ?? 0) - (left.stat.plateAppearances ?? 0));

  return args.rows.map((row) => {
    const matched = hitters.find((candidate) => candidate.nameKey === normalizeNameKey(row.playerName)) ?? null;
    const stat = matched?.stat ?? null;
    const player = matched?.player;
    const baseNote = row.warLabel ? `공식 확정 라인업 · WAR ${row.warLabel}` : "공식 확정 라인업";

    return {
      slot: row.slot,
      playerId: stat?.playerId ?? null,
      playerName: row.playerName,
      positionLabel: row.positionLabel || positionLabel(player),
      battingAverageLabel: stat ? formatRateLabel(stat.battingAverage, 3) : "-",
      opsLabel: stat ? formatRate(stat.ops, 3) : "-",
      homeRunsLabel: stat ? `${stat.homeRuns ?? 0}` : "-",
      rbiLabel: stat ? `${stat.rbi ?? 0}` : "-",
      note: stat ? baseNote : `${baseNote} · 선수 기록 연결 대기`,
    };
  });
}

function buildKeyPlayers(
  teamId: string,
  playerSeasonStats: PlayerSeasonStat[],
  playersById: Record<string, Player>,
  expectedLineup: ExpectedLineupItem[],
  lineupConfirmed: boolean,
): KeyPlayer[] {
  const slotByPlayerId = Object.fromEntries(
    expectedLineup
      .filter((item): item is ExpectedLineupItem & { playerId: string } => Boolean(item.playerId))
      .map((item) => [item.playerId, item.slot] as const),
  ) as Record<string, number | undefined>;
  const lineupIds = new Set(
    expectedLineup.flatMap((item) => (item.playerId ? [item.playerId] : [])),
  );
  const candidateStats = playerSeasonStats
    .filter((stat) => stat.seasonTeamId === teamId && stat.statType === "hitter")
    .filter((stat) => (lineupIds.size >= 5 ? lineupIds.has(stat.playerId) : true));
  const lineupPrefix = lineupConfirmed ? "확정" : "예상";

  return candidateStats
    .sort((left, right) => lineupCandidateScore(right) - lineupCandidateScore(left))
    .slice(0, 3)
    .map((stat) => {
      const slot = slotByPlayerId[stat.playerId];
      const roleLabel =
        slot === undefined
          ? "핵심 타선 카드"
          : slot <= 2
            ? `${lineupPrefix} ${slot}번 출루 기대`
            : slot <= 5
              ? `${lineupPrefix} ${slot}번 중심 타선`
              : `${lineupPrefix} ${slot}번 연결 역할`;
      return {
        playerId: stat.playerId,
        playerName: playersById[stat.playerId]?.nameKo ?? stat.playerId,
        positionLabel: positionLabel(playersById[stat.playerId]),
        reason: `${roleLabel} · 시즌 OPS ${formatRate(stat.ops, 3)} · HR ${stat.homeRuns ?? 0}`,
      };
    });
}

function buildBullpenPanel(args: {
  team: TeamDisplay;
  teamSeasonStat: TeamSeasonStat | null;
  teamPitcherStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  games: Game[];
  gamesById: Record<string, Game>;
  playersById: Record<string, Player>;
  rosterEvents: RosterEvent[];
  bullpenRating: number | null;
  summaryNote: string | null;
  scheduledAt: string;
}): BullpenPanel {
  const relievers = rankRelievers(args.team.seasonTeamId, args.teamPitcherStats);
  const relieverIds = new Set(relievers.map((stat) => stat.playerId));
  const recentLoad = buildRecentBullpenLoadLabel(
    args.team.seasonTeamId,
    relieverIds,
    args.playerGameStats,
    args.games,
  );
  const anchors = relievers.slice(0, 3).map((stat) => {
    const restScore = relieverRestScore({
      playerId: stat.playerId,
      playerGameStats: args.playerGameStats,
      gamesById: args.gamesById,
      scheduledAt: args.scheduledAt,
    });
    const availability = bullpenAvailabilityStatus(restScore);
    const recentLogs = sortPlayerGameLogs(
      args.playerGameStats.filter((item) => item.playerId === stat.playerId),
      args.gamesById,
    );
    return {
      playerId: stat.playerId,
      playerName: args.playersById[stat.playerId]?.nameKo ?? stat.playerId,
      roleLabel: inferPitcherRole(stat),
      eraLabel: `ERA ${formatRate(stat.era, 2)}`,
      leverageLabel: `SV ${stat.saves ?? 0} · HLD ${stat.holds ?? 0}`,
      recentAppearanceLabel: buildPitcherRecentAppearanceLabel(stat, recentLogs),
      availabilityLabel: availability.label,
      availabilityTone: availability.tone,
    };
  });
  const availability = buildAvailabilityLists(
    args.team.seasonTeamId,
    args.rosterEvents,
    args.playersById,
  );

  const availableAnchors = anchors.filter((anchor) => anchor.availabilityTone === "positive").length;

  return {
    team: toTeamStub(args.team),
    bullpenEraLabel: args.teamSeasonStat ? formatRate(args.teamSeasonStat.bullpenEra, 2) : "-",
    bullpenRatingLabel: args.bullpenRating !== null ? args.bullpenRating.toFixed(1) : "-",
    anchorAvailabilityLabel:
      anchors.length > 0 ? `${availableAnchors}/${anchors.length}명 즉시 투입 가능` : "핵심 계투 데이터 대기",
    recentLoadLabel: recentLoad.label,
    recentLoadNote: recentLoad.note,
    anchors,
    unavailablePlayers: availability.unavailablePlayers.slice(0, 5),
    returningPlayers: availability.returningPlayers.slice(0, 5),
    summaryNote: args.summaryNote,
  };
}

function buildPreferredOrderMap(
  teamId: string,
  playerSplitStats: PlayerSplitStat[],
) {
  return Object.fromEntries(
    playerSplitStats
      .filter((split) => split.seasonTeamId === teamId && split.statType === "hitter")
      .filter((split) => split.splitType === "situation" && split.splitKey.startsWith("BATTING #"))
      .map((split) => ({
        playerId: split.playerId,
        order: parseBattingOrderKey(split.splitKey),
        weight: split.plateAppearances ?? split.atBats ?? 0,
      }))
      .filter((item): item is { playerId: string; order: number; weight: number } => item.order !== null)
      .sort((left, right) => left.playerId.localeCompare(right.playerId) || right.weight - left.weight)
      .reduce<Array<{ playerId: string; order: number; weight: number }>>((accumulator, item) => {
        if (accumulator.some((existing) => existing.playerId === item.playerId)) {
          return accumulator;
        }
        accumulator.push(item);
        return accumulator;
      }, [])
      .map((item) => [item.playerId, item] as const),
  ) as Record<string, { order: number; weight: number }>;
}

function buildLeagueConditionPriors(args: {
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  teamSeasonStats: TeamSeasonStat[];
  games: Game[];
  gamesById: Record<string, Game>;
}) {
  const hitterStats = args.playerSeasonStats.filter((stat) => stat.statType === "hitter");
  const starterStats = args.playerSeasonStats.filter(
    (stat) => stat.statType === "pitcher" && inferPitcherRole(stat) === "선발",
  );
  const leagueWeightedOps = weightedAverageBy(
    hitterStats,
    (stat) => stat.ops,
    (stat) => stat.plateAppearances ?? 0,
  );
  const teamIds = [...new Set(args.games.flatMap((game) => [game.homeSeasonTeamId, game.awaySeasonTeamId]))];
  const recentRunsByTeam = teamIds
    .map((teamId) =>
      average(
        args.games
          .filter((game) => game.status === "final" && sameTeamGame(game, teamId))
          .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
          .slice(0, 5)
          .map((game) => teamRunsScored(game, teamId)),
      ),
    )
    .filter((value): value is number => value !== null);
  const starterRecentLogs = starterStats.map((stat) =>
    sortPlayerGameLogs(
      args.playerGameStats.filter(
        (item) => item.playerId === stat.playerId && item.statType === "pitcher",
      ),
      args.gamesById,
    ).slice(0, 3),
  );
  const starterRecentEras = starterRecentLogs
    .map((logs) => calcEraFromLogs(logs))
    .filter((value): value is number => value !== null);
  const starterRecentLengths = starterRecentLogs
    .map((logs) => average(logs.map((log) => normalizeInningsValue(log.inningsPitched))))
    .filter((value): value is number => value !== null);

  return {
    lineupOpsScore: upScore(leagueWeightedOps, 0.63, 0.86),
    recentRunsScore: upScore(average(recentRunsByTeam), 2.5, 7.0),
    starterEraScore: downScore(
      weightedAverageBy(
        starterStats,
        (stat) => stat.era,
        (stat) => normalizeInningsValue(stat.inningsPitched),
      ),
      2.5,
      6.2,
    ),
    starterLengthScore: upScore(
      weightedAverageBy(
        starterStats,
        (stat) =>
          stat.games > 0 ? normalizeInningsValue(stat.inningsPitched) / stat.games : null,
        (stat) => normalizeInningsValue(stat.inningsPitched),
      ),
      4,
      7,
    ),
    recentStarterEraScore: downScore(average(starterRecentEras), 1.8, 6.8),
    recentStarterLengthScore: upScore(average(starterRecentLengths), 4, 7),
    bullpenEraScore: downScore(
      average(args.teamSeasonStats.map((stat) => stat.bullpenEra)),
      3.2,
      6.2,
    ),
  } satisfies TeamConditionLeaguePriors;
}

function buildPercentileResolver(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return (score: number) => {
    if (sorted.length <= 1) {
      return 50;
    }
    const lessCount = sorted.filter((value) => value < score).length;
    const equalCount = sorted.filter((value) => value === score).length;
    const position = lessCount + Math.max(0, equalCount - 1) / 2;
    return Math.round((position / (sorted.length - 1)) * 100);
  };
}

function buildDistributionNote(values: number[]) {
  if (values.length <= 1) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 0.0001) {
    return "현재 10팀이 거의 같은 점수대입니다.";
  }
  return null;
}

function describeConditionStatus(percentile: number) {
  if (percentile >= 80) {
    return { label: "상위권", tone: "positive" as const };
  }
  if (percentile >= 60) {
    return { label: "우세", tone: "positive" as const };
  }
  if (percentile >= 40) {
    return { label: "중위권", tone: "neutral" as const };
  }
  if (percentile >= 20) {
    return { label: "주의", tone: "negative" as const };
  }
  return { label: "하위권", tone: "negative" as const };
}

function describeMetricState(metric: TeamConditionMetric) {
  if (metric.percentile >= 80) {
    return "리그 상위권입니다";
  }
  if (metric.percentile >= 60) {
    return "좋은 편입니다";
  }
  if (metric.percentile >= 40) {
    return "중간권입니다";
  }
  if (metric.percentile >= 20) {
    return "조정이 필요합니다";
  }
  return "하위권입니다";
}

function buildStrengthSummary(metrics: TeamConditionMetric[]) {
  const sorted = [...metrics].sort((left, right) => right.score - left.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  if (!strongest || !weakest) {
    return "오늘 전력치를 계산할 수 있는 데이터가 부족합니다.";
  }
  const provisionalMetric = metrics.find((metric) => metric.isProvisional);
  if (provisionalMetric?.key === "starter") {
    return `${strongest.label}은 좋은 편이지만, 선발 미확정이라 총점 신뢰도는 중간입니다.`;
  }
  if (strongest.key === weakest.key) {
    return `${strongest.label}은 ${describeMetricState(strongest)}.`;
  }
  return `${strongest.label}은 ${describeMetricState(strongest)}. ${weakest.label}은 오늘 변수로 남아 있습니다.`;
}

function applyPercentileLabels(
  snapshots: TeamConditionStrengthSnapshot[],
) {
  const overallPercentileOf = buildPercentileResolver(
    snapshots.map((snapshot) => snapshot.overallScore),
  );
  const overallDistributionNote = buildDistributionNote(
    snapshots.map((snapshot) => snapshot.overallScore),
  );
  const offenseValues = snapshots.map(
    (snapshot) => snapshot.metrics.find((metric) => metric.key === "offense")?.score ?? 50,
  );
  const starterValues = snapshots.map(
    (snapshot) => snapshot.metrics.find((metric) => metric.key === "starter")?.score ?? 50,
  );
  const bullpenValues = snapshots.map(
    (snapshot) => snapshot.metrics.find((metric) => metric.key === "bullpen")?.score ?? 50,
  );
  const lineupValues = snapshots.map(
    (snapshot) => snapshot.metrics.find((metric) => metric.key === "lineup")?.score ?? 50,
  );
  const healthValues = snapshots.map(
    (snapshot) => snapshot.metrics.find((metric) => metric.key === "health")?.score ?? 50,
  );
  const metricPercentileResolvers = {
    offense: buildPercentileResolver(offenseValues),
    starter: buildPercentileResolver(starterValues),
    bullpen: buildPercentileResolver(bullpenValues),
    lineup: buildPercentileResolver(lineupValues),
    health: buildPercentileResolver(healthValues),
  } satisfies Record<TeamConditionMetricKey, (score: number) => number>;
  const metricDistributionNotes = {
    offense: buildDistributionNote(offenseValues),
    starter: buildDistributionNote(starterValues),
    bullpen: buildDistributionNote(bullpenValues),
    lineup: buildDistributionNote(lineupValues),
    health: buildDistributionNote(healthValues),
  } satisfies Record<TeamConditionMetricKey, string | null>;

  return snapshots.map((snapshot) => {
    const percentile = overallPercentileOf(snapshot.overallScore);
    const overallTier = describeConditionStatus(percentile);
    const metrics: TeamConditionMetric[] = snapshot.metrics.map((metric) => {
      const metricPercentile = metricPercentileResolvers[metric.key](metric.score);
      const metricTier = describeConditionStatus(metricPercentile);
      return {
        ...metric,
        percentile: metricPercentile,
        statusLabel: metricTier.label,
        tone: metricTier.tone,
        distributionNote: metricDistributionNotes[metric.key],
      } satisfies TeamConditionMetric;
    });

    return {
      ...snapshot,
      percentile,
      statusLabel: overallTier.label,
      statusTone: overallTier.tone,
      metrics,
      summary: buildStrengthSummary(metrics),
      distributionNote: overallDistributionNote,
    };
  });
}

function buildOffenseMetric(args: {
  team: TeamDisplay;
  expectedLineup: ExpectedLineupItem[];
  hitterStats: PlayerSeasonStat[];
  games: Game[];
  leaguePriors: TeamConditionLeaguePriors;
  lineupConfirmed: boolean;
}) {
  const lineupStats = args.expectedLineup
    .map((item) => ({
      slot: item.slot,
      stat: args.hitterStats.find((stat) => stat.playerId === item.playerId) ?? null,
    }))
    .filter((item): item is { slot: number; stat: PlayerSeasonStat } => item.stat !== null);
  const fallbackLineupStats =
    lineupStats.length > 0
      ? lineupStats
      : [...args.hitterStats]
          .sort((left, right) => lineupCandidateScore(right) - lineupCandidateScore(left))
          .slice(0, 9)
          .map((stat, index) => ({ slot: index + 1, stat }));
  const weightedOps = weightedAverageBy(
    fallbackLineupStats,
    (item) => item.stat.ops,
    (item) => BATTING_ORDER_WEIGHTS[item.slot] ?? 1,
  );
  const recentGames = args.games
    .filter((game) => game.status === "final" && sameTeamGame(game, args.team.seasonTeamId))
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5);
  const recentRuns = average(
    recentGames.map((game) => teamRunsScored(game, args.team.seasonTeamId)),
  );
  const lineupSeasonProduction = upScore(weightedOps, 0.63, 0.86);
  const recentOffense = shrinkScore(
    upScore(recentRuns, 2.5, 7),
    recentGames.length,
    3,
    args.leaguePriors.recentRunsScore,
  );
  const score = roundScore(lineupSeasonProduction * 0.7 + recentOffense * 0.3);

  return {
    key: "offense" as const,
    label: "공격력",
    score,
    why: `${args.lineupConfirmed ? "확정" : "예상"} 타선 가중 OPS ${formatRate(weightedOps, 3)} · 최근 5경기 평균 ${recentRuns?.toFixed(1) ?? "-"}득점`,
    percentile: 50,
    statusLabel: "중위권",
    tone: "neutral" as const,
  };
}

function buildStarterMetric(args: {
  starter: StarterPreview;
  pitcherStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  gamesById: Record<string, Game>;
  leaguePriors: TeamConditionLeaguePriors;
}) {
  if (!args.starter.playerId && !args.starter.liveSummary) {
    return {
      key: "starter" as const,
      label: "선발 컨디션",
      score: 50,
      why: args.starter.announced
        ? `${args.starter.playerName}이 KBO 공식 선발로 발표됐지만 상세 기록 연결을 기다리고 있어 임시 50점으로 반영했습니다.`
        : "예상 선발이 아직 미확정이라 선발 컨디션은 임시 50점으로 반영했습니다.",
      percentile: 50,
      statusLabel: "중위권",
      tone: "neutral" as const,
      isProvisional: true,
    };
  }

  const stat = args.pitcherStats.find((item) => item.playerId === args.starter.playerId) ?? null;
  const localLogs = sortPlayerGameLogs(
    args.playerGameStats.filter(
      (item) => item.playerId === args.starter.playerId && item.statType === "pitcher",
    ),
    args.gamesById,
  );
  const logs = (localLogs.length > 0 ? localLogs : sortLivePitcherGameLogs(args.starter.liveLogs ?? [])).slice(0, 3);
  const seasonInnings = normalizeInningsValue(stat?.inningsPitched ?? args.starter.liveSummary?.inningsPitched);
  const seasonEraScore = shrinkScore(
    downScore(stat?.era ?? args.starter.liveSummary?.era, 2.5, 6.2),
    seasonInnings,
    40,
    args.leaguePriors.starterEraScore,
  );
  const seasonLengthScore = shrinkScore(
    (stat?.games ?? args.starter.liveSummary?.games ?? 0) > 0
      ? upScore(seasonInnings / (stat?.games ?? args.starter.liveSummary?.games ?? 1), 4, 7)
      : args.leaguePriors.starterLengthScore,
    stat?.games ?? args.starter.liveSummary?.games ?? 0,
    5,
    args.leaguePriors.starterLengthScore,
  );
  const recentEra = calcEraFromLogs(logs);
  const recentAverageInnings = average(logs.map((log) => normalizeInningsValue(log.inningsPitched)));
  const recentEraScore = shrinkScore(
    downScore(recentEra, 1.8, 6.8),
    logs.length,
    3,
    args.leaguePriors.recentStarterEraScore,
  );
  const recentLengthScore = shrinkScore(
    upScore(recentAverageInnings, 4, 7),
    logs.length,
    3,
    args.leaguePriors.recentStarterLengthScore,
  );
  const score = roundScore(
    seasonEraScore * 0.3 +
      seasonLengthScore * 0.2 +
      recentEraScore * 0.25 +
      recentLengthScore * 0.25,
  );

  return {
    key: "starter" as const,
    label: "선발 컨디션",
    score,
    why:
      logs.length > 0
        ? `${args.starter.playerName} 시즌 ERA ${args.starter.eraLabel} · 최근 3경기 평균 ${recentAverageInnings?.toFixed(1) ?? "-"}이닝`
        : `${args.starter.playerName} 시즌 ERA ${args.starter.eraLabel} · 시즌 ${args.starter.inningsLabel}이닝`,
    percentile: 50,
    statusLabel: "중위권",
    tone: "neutral" as const,
  };
}

function relieverRestScore(args: {
  playerId: string;
  playerGameStats: PlayerGameStat[];
  gamesById: Record<string, Game>;
  scheduledAt: string;
}) {
  const logs = sortPlayerGameLogs(
    args.playerGameStats.filter(
      (item) =>
        item.playerId === args.playerId &&
        item.statType === "pitcher" &&
        (args.gamesById[item.gameId]?.scheduledAt ?? "") < args.scheduledAt,
    ),
    args.gamesById,
  );
  const appearancesLast3Days = logs.filter((log) => {
    const game = args.gamesById[log.gameId];
    return game ? daysBetween(game.scheduledAt, args.scheduledAt) <= 3 : false;
  }).length;

  if (appearancesLast3Days >= 3) {
    return 20;
  }
  if (appearancesLast3Days >= 2) {
    return 45;
  }
  if (appearancesLast3Days === 1) {
    return 75;
  }
  return 100;
}

function resolveOfficialStarterPlayer(
  starterRef: OfficialGameCenterStarterRef | null,
  teamPitcherStats: PlayerSeasonStat[],
  playersById: Record<string, Player>,
  playersByOfficialCode: Record<string, Player>,
) {
  if (!starterRef) {
    return null;
  }

  if (starterRef.officialPlayerCode) {
    const byCode = playersByOfficialCode[starterRef.officialPlayerCode] ?? null;
    if (byCode) {
      return byCode;
    }
  }

  const starterNameKey = normalizeNameKey(starterRef.playerName ?? "");
  if (!starterNameKey) {
    return null;
  }

  const byName = teamPitcherStats.find((stat) => {
    const player = playersById[stat.playerId];
    return player ? normalizeNameKey(player.nameKo) === starterNameKey : false;
  });

  return byName ? playersById[byName.playerId] ?? null : null;
}

function buildBullpenMetric(args: {
  team: TeamDisplay;
  bullpenPanel: BullpenPanel;
  teamSeasonStat: TeamSeasonStat | null;
  pitcherStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  games: Game[];
  gamesById: Record<string, Game>;
  playersById: Record<string, Player>;
  scheduledAt: string;
  leaguePriors: TeamConditionLeaguePriors;
}) {
  const relievers = rankRelievers(args.team.seasonTeamId, args.pitcherStats);
  const relieverIds = new Set(relievers.map((stat) => stat.playerId));
  const recentGameIds = args.games
    .filter((game) => game.status === "final" && sameTeamGame(game, args.team.seasonTeamId))
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
    .slice(0, 5)
    .map((game) => game.gameId);
  const bullpenLogs = args.playerGameStats.filter(
    (log) =>
      log.statType === "pitcher" &&
      log.seasonTeamId === args.team.seasonTeamId &&
      relieverIds.has(log.playerId) &&
      recentGameIds.includes(log.gameId),
  );
  const totalBullpenInnings = bullpenLogs.reduce(
    (sum, log) => sum + normalizeInningsValue(log.inningsPitched),
    0,
  );
  const recentThreeDayAppearances = bullpenLogs.filter((log) => {
    const game = args.gamesById[log.gameId];
    return game ? daysBetween(game.scheduledAt, args.scheduledAt) <= 3 : false;
  }).length;
  const anchorIds = args.bullpenPanel.anchors.map((anchor) => anchor.playerId);
  const anchorRestScores = anchorIds.map((playerId) =>
    relieverRestScore({
      playerId,
      playerGameStats: args.playerGameStats,
      gamesById: args.gamesById,
      scheduledAt: args.scheduledAt,
    }),
  );
  const heavyUseAnchors = anchorRestScores.filter((score) => score <= 45).length;
  const bullpenInningsScore = downScore(totalBullpenInnings, 5, 18);
  const recentAppearanceScore = downScore(recentThreeDayAppearances, 2, 14);
  const anchorChainScore = downScore(heavyUseAnchors, 0, 3);
  const bullpenQuality = shrinkScore(
    downScore(args.teamSeasonStat?.bullpenEra, 3.2, 6.2),
    (args.teamSeasonStat?.wins ?? 0) + (args.teamSeasonStat?.losses ?? 0) + (args.teamSeasonStat?.ties ?? 0),
    12,
    args.leaguePriors.bullpenEraScore,
  );
  const fatigueScore =
    bullpenInningsScore * 0.45 +
    recentAppearanceScore * 0.35 +
    anchorChainScore * 0.2;
  const leverageAvailability = average(anchorRestScores) ?? 50;
  const unavailablePitchers = args.bullpenPanel.unavailablePlayers.filter((item) =>
    args.playersById[item.playerId]?.primaryPositions.some((position) => position === "P" || position === "SP"),
  );
  const returningPitchers = args.bullpenPanel.returningPlayers.filter((item) =>
    args.playersById[item.playerId]?.primaryPositions.some((position) => position === "P" || position === "SP"),
  );
  const anchorUnavailableCount = unavailablePitchers.filter((item) => anchorIds.includes(item.playerId)).length;
  const bullpenHealth = clampScore(
    100 - anchorUnavailableCount * 22 - Math.max(0, unavailablePitchers.length - anchorUnavailableCount) * 8 + returningPitchers.length * 7,
  );
  const score = roundScore(
    bullpenQuality * 0.25 +
      fatigueScore * 0.35 +
      leverageAvailability * 0.25 +
      bullpenHealth * 0.15,
  );

  return {
    key: "bullpen" as const,
    label: "불펜 여력",
    score,
    why: `최근 5경기 ${formatInnings(totalBullpenInnings)}이닝 소모 · 필승조 평균 가용성 ${Math.round(leverageAvailability)}점`,
    percentile: 50,
    statusLabel: "중위권",
    tone: "neutral" as const,
  };
}

function buildLineupMetric(args: {
  team: TeamDisplay;
  expectedLineup: ExpectedLineupItem[];
  hitterStats: PlayerSeasonStat[];
  playerSplitStats: PlayerSplitStat[];
  playersById: Record<string, Player>;
  lineupConfirmed: boolean;
}) {
  const lineupIds = new Set(args.expectedLineup.flatMap((item) => (item.playerId ? [item.playerId] : [])));
  const hitters = [...args.hitterStats].sort(
    (left, right) => lineupCandidateScore(right) - lineupCandidateScore(left),
  );
  const coreHitters = hitters.slice(0, 6);
  const topOrderHitters = hitters.slice(0, 3);
  const preferredOrderByPlayerId = buildPreferredOrderMap(
    args.team.seasonTeamId,
    args.playerSplitStats,
  );
  const coreScoreTotal = coreHitters.reduce((sum, stat) => sum + lineupCandidateScore(stat), 0);
  const coreScoreInLineup = coreHitters
    .filter((stat) => lineupIds.has(stat.playerId))
    .reduce((sum, stat) => sum + lineupCandidateScore(stat), 0);
  const coreCoverage =
    coreScoreTotal > 0 ? clampScore((coreScoreInLineup / coreScoreTotal) * 100) : 50;
  const orderMatches = args.expectedLineup
    .filter((item) => item.slot <= 5)
    .filter((item) => (item.playerId ? preferredOrderByPlayerId[item.playerId]?.order === item.slot : false)).length;
  const orderStability = clampScore((orderMatches / 5) * 100);
  const topOrderPresence = clampScore(
    (topOrderHitters.filter((stat) => lineupIds.has(stat.playerId)).length / Math.max(1, topOrderHitters.length)) *
      100,
  );
  const lineupPlayers = args.expectedLineup
    .flatMap((item) => (item.playerId ? [args.playersById[item.playerId]] : []))
    .filter((player): player is Player => Boolean(player));
  const catcherPresence = lineupPlayers.some((player) => player.primaryPositions.includes("C")) ? 100 : 55;
  const infielderPresence = upScore(
    lineupPlayers.filter((player) => player.primaryPositions.includes("IF")).length,
    2,
    4,
  );
  const outfielderPresence = upScore(
    lineupPlayers.filter((player) => player.primaryPositions.includes("OF")).length,
    2,
    3,
  );
  const positionCoverage = average([catcherPresence, infielderPresence, outfielderPresence]) ?? 50;
  const score = roundScore(
    coreCoverage * 0.55 +
      orderStability * 0.15 +
      topOrderPresence * 0.2 +
      positionCoverage * 0.1,
  );

  return {
    key: "lineup" as const,
    label: "라인업 완성도",
    score,
    why: `${args.lineupConfirmed ? "확정" : "예상"} 타선 핵심 6명 중 ${coreHitters.filter((stat) => lineupIds.has(stat.playerId)).length}명 포함 · 상위 5타순 중 ${orderMatches}명은 평소 자리 유지`,
    percentile: 50,
    statusLabel: "중위권",
    tone: "neutral" as const,
  };
}

function buildPlayerImpactScore(args: {
  stat: PlayerSeasonStat | null;
  hitterPlateAppearancesTotal: number;
  pitcherInningsTotal: number;
}) {
  if (!args.stat) {
    return 8;
  }
  if (args.stat.statType === "hitter") {
    const paShare =
      args.hitterPlateAppearancesTotal > 0
        ? (args.stat.plateAppearances ?? 0) / args.hitterPlateAppearancesTotal
        : 0;
    const productionScore = upScore(args.stat.ops, 0.62, 0.95) / 100;
    const powerScore = upScore(args.stat.homeRuns, 0, 10) / 100;
    return 100 * (paShare * 0.55 + productionScore * 0.3 + powerScore * 0.15);
  }

  const inningsShare =
    args.pitcherInningsTotal > 0
      ? normalizeInningsValue(args.stat.inningsPitched) / args.pitcherInningsTotal
      : 0;
  const qualityScore = downScore(args.stat.era, 2.2, 6.5) / 100;
  const leverageScore = upScore((args.stat.saves ?? 0) + (args.stat.holds ?? 0), 0, 20) / 100;
  return 100 * (inningsShare * 0.5 + qualityScore * 0.25 + leverageScore * 0.25);
}

function buildHealthMetric(args: {
  team: TeamDisplay;
  hitterStats: PlayerSeasonStat[];
  pitcherStats: PlayerSeasonStat[];
  rosterEvents: RosterEvent[];
  playersById: Record<string, Player>;
}) {
  const teamEvents = args.rosterEvents.filter((event) => event.seasonTeamId === args.team.seasonTeamId);
  const latestEventByPlayer = buildLatestEventByPlayer(teamEvents);
  const hitterPlateAppearancesTotal = args.hitterStats.reduce(
    (sum, stat) => sum + (stat.plateAppearances ?? 0),
    0,
  );
  const pitcherInningsTotal = args.pitcherStats.reduce(
    (sum, stat) => sum + normalizeInningsValue(stat.inningsPitched),
    0,
  );
  const statsByPlayerId = Object.fromEntries(
    [...args.hitterStats, ...args.pitcherStats].map((stat) => [stat.playerId, stat] as const),
  ) as Record<string, PlayerSeasonStat | undefined>;

  const unavailable = Object.values(latestEventByPlayer)
    .filter((event) => ["injured", "transferred", "released"].includes(event.type))
    .map((event) => ({
      event,
      impact: buildPlayerImpactScore({
        stat: statsByPlayerId[event.playerId] ?? null,
        hitterPlateAppearancesTotal,
        pitcherInningsTotal,
      }),
    }))
    .sort((left, right) => right.impact - left.impact);
  const returning = Object.values(latestEventByPlayer)
    .filter((event) => ["activated", "joined"].includes(event.type))
    .map((event) => ({
      event,
      impact: buildPlayerImpactScore({
        stat: statsByPlayerId[event.playerId] ?? null,
        hitterPlateAppearancesTotal,
        pitcherInningsTotal,
      }),
    }))
    .sort((left, right) => right.impact - left.impact);

  const unavailablePenalty = Math.min(
    60,
    unavailable.reduce((sum, item) => sum + item.impact, 0) * 0.55,
  );
  const returnBonus = Math.min(
    14,
    returning.reduce((sum, item) => sum + item.impact, 0) * 0.2,
  );
  const score = roundScore(100 - unavailablePenalty + returnBonus);
  const topUnavailable = unavailable[0];

  return {
    key: "health" as const,
    label: "엔트리 건강도",
    score,
    why:
      topUnavailable
        ? `이탈 ${args.playersById[topUnavailable.event.playerId]?.nameKo ?? topUnavailable.event.playerId} 외 ${Math.max(0, unavailable.length - 1)}명 · 최근 복귀 ${returning.length}명`
        : `주요 이탈자 없음 · 최근 복귀 ${returning.length}명`,
    percentile: 50,
    statusLabel: "중위권",
    tone: "neutral" as const,
  };
}

function buildStrengthSnapshot(args: {
  team: TeamDisplay;
  expectedLineup: ExpectedLineupItem[];
  lineupConfirmed: boolean;
  starter: StarterPreview;
  bullpenPanel: BullpenPanel;
  teamSeasonStat: TeamSeasonStat | null;
  playerSeasonStats: PlayerSeasonStat[];
  playerGameStats: PlayerGameStat[];
  playerSplitStats: PlayerSplitStat[];
  playersById: Record<string, Player>;
  rosterEvents: RosterEvent[];
  games: Game[];
  gamesById: Record<string, Game>;
  scheduledAt: string;
  leaguePriors: TeamConditionLeaguePriors;
}) {
  const hitterStats = args.playerSeasonStats.filter(
    (stat) => stat.seasonTeamId === args.team.seasonTeamId && stat.statType === "hitter",
  );
  const pitcherStats = args.playerSeasonStats.filter(
    (stat) => stat.seasonTeamId === args.team.seasonTeamId && stat.statType === "pitcher",
  );
  const metrics: TeamConditionMetric[] = [
    buildOffenseMetric({
      team: args.team,
      expectedLineup: args.expectedLineup,
      hitterStats,
      games: args.games,
      leaguePriors: args.leaguePriors,
      lineupConfirmed: args.lineupConfirmed,
    }),
    buildStarterMetric({
      starter: args.starter,
      pitcherStats,
      playerGameStats: args.playerGameStats,
      gamesById: args.gamesById,
      leaguePriors: args.leaguePriors,
    }),
    buildBullpenMetric({
      team: args.team,
      bullpenPanel: args.bullpenPanel,
      teamSeasonStat: args.teamSeasonStat,
      pitcherStats,
      playerGameStats: args.playerGameStats,
      games: args.games,
      gamesById: args.gamesById,
      playersById: args.playersById,
      scheduledAt: args.scheduledAt,
      leaguePriors: args.leaguePriors,
    }),
    buildLineupMetric({
      team: args.team,
      expectedLineup: args.expectedLineup,
      hitterStats,
      playerSplitStats: args.playerSplitStats,
      playersById: args.playersById,
      lineupConfirmed: args.lineupConfirmed,
    }),
    buildHealthMetric({
      team: args.team,
      hitterStats,
      pitcherStats,
      rosterEvents: args.rosterEvents,
      playersById: args.playersById,
    }),
  ];
  const metricByKey = Object.fromEntries(metrics.map((metric) => [metric.key, metric] as const)) as Record<
    TeamConditionMetricKey,
    TeamConditionMetric
  >;
  const overallScore = roundScore(
    metricByKey.offense.score * 0.26 +
      metricByKey.starter.score * 0.22 +
      metricByKey.bullpen.score * 0.24 +
      metricByKey.lineup.score * 0.18 +
      metricByKey.health.score * 0.1,
  );

  return {
    team: toTeamStub(args.team),
    overallScore,
    statusLabel: "중위권",
    statusTone: "neutral",
    percentile: 50,
    summary: buildStrengthSummary(metrics),
    metrics,
  };
}

export const getTeamConditionPageData = async (year: number, teamSlug: string) => {
  const [dashboardData, weatherRows] = await Promise.all([
    getSeasonDashboardData(year),
    getLatestWeatherRows(),
  ]);
  if (!dashboardData) {
    return null;
  }

  const found = findSeasonTeamBySlug(teamSlug, dashboardData.seasonTeams, dashboardData.teamDisplays);
  if (!found) {
    return null;
  }

  const todayDateKey = getKboDateKey();
  const teamGames = dashboardData.games.filter((game) => sameTeamGame(game, found.seasonTeam.seasonTeamId));
  const upcomingGames = teamGames
    .filter(isActiveScheduledGame)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const todayGame =
    upcomingGames.find((game) => getKboDateKey(new Date(game.scheduledAt)) === todayDateKey) ?? null;
  const focusGame = todayGame ?? upcomingGames[0] ?? null;
  if (!focusGame) {
    return null;
  }

  const focusIsToday = getKboDateKey(new Date(focusGame.scheduledAt)) === todayDateKey;
  const displayById = dashboardData.displayById;
  const playersById = Object.fromEntries(
    dashboardData.players.map((player) => [player.playerId, player] as const),
  );
  const playersByOfficialCode = Object.fromEntries(
    dashboardData.players
      .filter((player) => player.officialPlayerCode)
      .map((player) => [String(player.officialPlayerCode), player] as const),
  ) as Record<string, Player>;
  const officialLineupSource = await getOfficialLineupSourceForGame(focusGame);
  const officialStarterSource = await getOfficialStarterSourceForGame(focusGame);
  const lineupStatus = buildTeamConditionLineupStatus(officialLineupSource);
  const gamesById = buildGamesById(dashboardData.games);
  const seriesById = Object.fromEntries(
    dashboardData.series.map((series) => [series.seriesId, series] as const),
  );
  const venueById = Object.fromEntries(
    dashboardData.venues.map((venue) => [venue.venueId, venue] as const),
  );
  const probabilityByGameId = Object.fromEntries(
    dashboardData.simulation.gameProbabilities.map((probability) => [probability.gameId, probability] as const),
  ) as Record<string, GameProbabilitySnapshot | undefined>;
  const playerImpactContext = buildPlayerImpactContext({
    seasonTeams: dashboardData.seasonTeams,
    games: dashboardData.games,
    teamSeasonStats: dashboardData.teamSeasonStats,
    players: dashboardData.players,
    rosterEvents: dashboardData.rosterEvents,
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
  });
  const leaguePriors = buildLeagueConditionPriors({
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
    teamSeasonStats: dashboardData.teamSeasonStats,
    games: dashboardData.games,
    gamesById,
  });

  const opponentId = opponentTeamId(focusGame, found.seasonTeam.seasonTeamId);
  const opponentDisplay = displayById[opponentId];
  if (!opponentDisplay) {
    return null;
  }

  const probability = probabilityByGameId[focusGame.gameId];
  const series = seriesById[focusGame.seriesId] ?? null;
  const venue = series ? venueById[series.venueId] ?? null : null;
  const weather = weatherSummary(matchWeatherRow(weatherRows, venue, focusGame.scheduledAt));
  const starterProjection = playerImpactContext.starterByGameId[focusGame.gameId] ?? {
    home: null,
    away: null,
  };
  const teamPitcherStats = dashboardData.playerSeasonStats.filter(
    (stat) => stat.seasonTeamId === found.seasonTeam.seasonTeamId && stat.statType === "pitcher",
  );
  const opponentPitcherStats = dashboardData.playerSeasonStats.filter(
    (stat) => stat.seasonTeamId === opponentId && stat.statType === "pitcher",
  );
  const officialHomeStarter =
    officialStarterSource.state === "confirmed" ? officialStarterSource.homeStarter : null;
  const officialAwayStarter =
    officialStarterSource.state === "confirmed" ? officialStarterSource.awayStarter : null;
  const officialHomeStarterPlayer = resolveOfficialStarterPlayer(
    officialHomeStarter,
    opponentId === focusGame.homeSeasonTeamId ? opponentPitcherStats : teamPitcherStats,
    playersById,
    playersByOfficialCode,
  );
  const officialAwayStarterPlayer = resolveOfficialStarterPlayer(
    officialAwayStarter,
    opponentId === focusGame.awaySeasonTeamId ? opponentPitcherStats : teamPitcherStats,
    playersById,
    playersByOfficialCode,
  );
  const teamStarterId =
    focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialHomeStarterPlayer?.playerId ??
        starterProjection.home?.playerId ??
        probability?.homeLikelyStarterId ??
        null
      : officialAwayStarterPlayer?.playerId ??
        starterProjection.away?.playerId ??
        probability?.awayLikelyStarterId ??
        null;
  const opponentStarterId =
    focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialAwayStarterPlayer?.playerId ??
        starterProjection.away?.playerId ??
        probability?.awayLikelyStarterId ??
        null
      : officialHomeStarterPlayer?.playerId ??
        starterProjection.home?.playerId ??
        probability?.homeLikelyStarterId ??
        null;
  const teamStarterNameOverride =
    focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialHomeStarter?.playerName ?? null
      : officialAwayStarter?.playerName ?? null;
  const opponentStarterNameOverride =
    focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialAwayStarter?.playerName ?? null
      : officialHomeStarter?.playerName ?? null;
  const teamStarterAnnounced = Boolean(teamStarterNameOverride || teamStarterId);
  const opponentStarterAnnounced = Boolean(opponentStarterNameOverride || opponentStarterId);
  const teamStarterOfficialCode =
    (focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialHomeStarter?.officialPlayerCode
      : officialAwayStarter?.officialPlayerCode) ??
    (teamStarterId ? playersById[teamStarterId]?.officialPlayerCode ?? null : null);
  const opponentStarterOfficialCode =
    (focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
      ? officialAwayStarter?.officialPlayerCode
      : officialHomeStarter?.officialPlayerCode) ??
    (opponentStarterId ? playersById[opponentStarterId]?.officialPlayerCode ?? null : null);
  const teamStarterHasLocalLogs =
    Boolean(teamStarterId) &&
    dashboardData.playerGameStats.some(
      (item) => item.playerId === teamStarterId && item.statType === "pitcher",
    );
  const opponentStarterHasLocalLogs =
    Boolean(opponentStarterId) &&
    dashboardData.playerGameStats.some(
      (item) => item.playerId === opponentStarterId && item.statType === "pitcher",
    );
  const [teamStarterLiveSummary, opponentStarterLiveSummary, teamStarterLiveLogs, opponentStarterLiveLogs] = await Promise.all([
    !teamStarterId && teamStarterAnnounced
      ? getOfficialPitcherSummaryByCode(
          teamStarterOfficialCode,
        )
      : Promise.resolve(null),
    !opponentStarterId && opponentStarterAnnounced
      ? getOfficialPitcherSummaryByCode(
          opponentStarterOfficialCode,
        )
      : Promise.resolve(null),
    teamStarterAnnounced && !teamStarterHasLocalLogs
      ? getOfficialPitcherGameLogsByCode(teamStarterOfficialCode)
      : Promise.resolve(null),
    opponentStarterAnnounced && !opponentStarterHasLocalLogs
      ? getOfficialPitcherGameLogsByCode(opponentStarterOfficialCode)
      : Promise.resolve(null),
  ]);
  const teamStarterNote =
    officialStarterSource.state === "confirmed"
      ? "KBO 공식 선발 반영"
      : focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
        ? starterProjection.home?.note ?? "최근 등판 기록 기준 예상"
        : starterProjection.away?.note ?? "최근 등판 기록 기준 예상";
  const opponentStarterNote =
    officialStarterSource.state === "confirmed"
      ? "KBO 공식 선발 반영"
      : focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
        ? starterProjection.away?.note ?? "최근 등판 기록 기준 예상"
        : starterProjection.home?.note ?? "최근 등판 기록 기준 예상";

  const teamStarter = buildStarterPreview({
    starterPlayerId: teamStarterId,
    starterNameOverride: teamStarterNameOverride,
    announced: teamStarterAnnounced,
    liveSummary: teamStarterLiveSummary,
    liveLogs: teamStarterLiveLogs,
    team: found.display,
    opponentTeam: opponentDisplay,
    playersById,
    teamPitcherStats,
    playerGameStats: dashboardData.playerGameStats,
    gamesById,
    note: teamStarterNote,
  });
  const opponentStarter = buildStarterPreview({
    starterPlayerId: opponentStarterId,
    starterNameOverride: opponentStarterNameOverride,
    announced: opponentStarterAnnounced,
    liveSummary: opponentStarterLiveSummary,
    liveLogs: opponentStarterLiveLogs,
    team: opponentDisplay,
    opponentTeam: found.display,
    playersById,
    teamPitcherStats: opponentPitcherStats,
    playerGameStats: dashboardData.playerGameStats,
    gamesById,
    note: opponentStarterNote,
  });

  const teamStrength = dashboardData.teamStrengthById[found.seasonTeam.seasonTeamId];
  const opponentStrength = dashboardData.teamStrengthById[opponentId];
  const teamSeasonStat =
    dashboardData.teamSeasonStats.find((stat) => stat.seasonTeamId === found.seasonTeam.seasonTeamId) ?? null;
  const opponentSeasonStat =
    dashboardData.teamSeasonStats.find((stat) => stat.seasonTeamId === opponentId) ?? null;
  const teamBullpen = buildBullpenPanel({
    team: found.display,
    teamSeasonStat,
    teamPitcherStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
    games: dashboardData.games,
    gamesById,
    playersById,
    rosterEvents: dashboardData.rosterEvents,
    bullpenRating: teamStrength?.bullpenRating ?? null,
    summaryNote:
      playerImpactContext.byTeamId[found.seasonTeam.seasonTeamId]?.explanationReasons.find((item) =>
        item.key.startsWith("bullpen"),
      )?.sentence ?? null,
    scheduledAt: focusGame.scheduledAt,
  });
  const opponentBullpen = buildBullpenPanel({
    team: opponentDisplay,
    teamSeasonStat: opponentSeasonStat,
    teamPitcherStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
    games: dashboardData.games,
    gamesById,
    playersById,
    rosterEvents: dashboardData.rosterEvents,
    bullpenRating: opponentStrength?.bullpenRating ?? null,
    summaryNote:
      playerImpactContext.byTeamId[opponentId]?.explanationReasons.find((item) =>
        item.key.startsWith("bullpen"),
      )?.sentence ?? null,
    scheduledAt: focusGame.scheduledAt,
  });
  const projectedTeamExpectedLineup = buildExpectedLineup({
    teamId: found.seasonTeam.seasonTeamId,
    playersById,
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerSplitStats: dashboardData.playerSplitStats,
  });
  const projectedOpponentExpectedLineup = buildExpectedLineup({
    teamId: opponentId,
    playersById,
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerSplitStats: dashboardData.playerSplitStats,
  });
  const teamConfirmedLineupRows =
    officialLineupSource.state === "confirmed"
      ? focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId
        ? officialLineupSource.homeRows
        : officialLineupSource.awayRows
      : [];
  const opponentConfirmedLineupRows =
    officialLineupSource.state === "confirmed"
      ? focusGame.homeSeasonTeamId === opponentId
        ? officialLineupSource.homeRows
        : officialLineupSource.awayRows
      : [];
  const teamExpectedLineup =
    officialLineupSource.state === "confirmed"
      ? buildConfirmedLineup({
          teamId: found.seasonTeam.seasonTeamId,
          rows: teamConfirmedLineupRows,
          playersById,
          playerSeasonStats: dashboardData.playerSeasonStats,
        })
      : projectedTeamExpectedLineup;
  const opponentExpectedLineup =
    officialLineupSource.state === "confirmed"
      ? buildConfirmedLineup({
          teamId: opponentId,
          rows: opponentConfirmedLineupRows,
          playersById,
          playerSeasonStats: dashboardData.playerSeasonStats,
        })
      : projectedOpponentExpectedLineup;
  const lineupConfirmed = lineupStatus.isConfirmed;
  const teamStrengthSnapshot = buildStrengthSnapshot({
    team: found.display,
    expectedLineup: teamExpectedLineup,
    lineupConfirmed,
    starter: teamStarter,
    bullpenPanel: teamBullpen,
    teamSeasonStat,
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
    playerSplitStats: dashboardData.playerSplitStats,
    playersById,
    rosterEvents: dashboardData.rosterEvents,
    games: dashboardData.games,
    gamesById,
    scheduledAt: focusGame.scheduledAt,
    leaguePriors,
  });
  const opponentStrengthSnapshot = buildStrengthSnapshot({
    team: opponentDisplay,
    expectedLineup: opponentExpectedLineup,
    lineupConfirmed,
    starter: opponentStarter,
    bullpenPanel: opponentBullpen,
    teamSeasonStat: opponentSeasonStat,
    playerSeasonStats: dashboardData.playerSeasonStats,
    playerGameStats: dashboardData.playerGameStats,
    playerSplitStats: dashboardData.playerSplitStats,
    playersById,
    rosterEvents: dashboardData.rosterEvents,
    games: dashboardData.games,
    gamesById,
    scheduledAt: focusGame.scheduledAt,
    leaguePriors,
  });
  const buildComparableStrengthSnapshot = (seasonTeamId: string) => {
    if (seasonTeamId === found.seasonTeam.seasonTeamId) {
      return teamStrengthSnapshot;
    }
    if (seasonTeamId === opponentId) {
      return opponentStrengthSnapshot;
    }

    const display = displayById[seasonTeamId];
    if (!display) {
      return null;
    }

    const comparableTeamGames = dashboardData.games.filter((game) => sameTeamGame(game, seasonTeamId));
    const comparableUpcomingGames = comparableTeamGames
      .filter(isActiveScheduledGame)
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
    const comparableTodayGame =
      comparableUpcomingGames.find((game) => getKboDateKey(new Date(game.scheduledAt)) === todayDateKey) ?? null;
    const comparableFocusGame = comparableTodayGame ?? comparableUpcomingGames[0] ?? null;
    if (!comparableFocusGame) {
      return null;
    }

    const comparableOpponentId = opponentTeamId(comparableFocusGame, seasonTeamId);
    const comparableStarterProjection = playerImpactContext.starterByGameId[comparableFocusGame.gameId] ?? {
      home: null,
      away: null,
    };
    const comparableProbability = probabilityByGameId[comparableFocusGame.gameId];
    const comparablePitcherStats = dashboardData.playerSeasonStats.filter(
      (stat) => stat.seasonTeamId === seasonTeamId && stat.statType === "pitcher",
    );
    const comparableStarterId =
      comparableFocusGame.homeSeasonTeamId === seasonTeamId
        ? comparableStarterProjection.home?.playerId ?? comparableProbability?.homeLikelyStarterId ?? null
        : comparableStarterProjection.away?.playerId ?? comparableProbability?.awayLikelyStarterId ?? null;
    const comparableStarterNote =
      comparableFocusGame.homeSeasonTeamId === seasonTeamId
        ? comparableStarterProjection.home?.note ?? "최근 등판 기록 기준 예상"
        : comparableStarterProjection.away?.note ?? "최근 등판 기록 기준 예상";
    const comparableStarter = buildStarterPreview({
      starterPlayerId: comparableStarterId,
      team: display,
      opponentTeam: displayById[comparableOpponentId] ?? display,
      playersById,
      teamPitcherStats: comparablePitcherStats,
      playerGameStats: dashboardData.playerGameStats,
      gamesById,
      note: comparableStarterNote,
    });
    const comparableTeamSeasonStat =
      dashboardData.teamSeasonStats.find((stat) => stat.seasonTeamId === seasonTeamId) ?? null;
    const comparableBullpen = buildBullpenPanel({
      team: display,
      teamSeasonStat: comparableTeamSeasonStat,
      teamPitcherStats: dashboardData.playerSeasonStats,
      playerGameStats: dashboardData.playerGameStats,
      games: dashboardData.games,
      gamesById,
      playersById,
      rosterEvents: dashboardData.rosterEvents,
      bullpenRating: dashboardData.teamStrengthById[seasonTeamId]?.bullpenRating ?? null,
      summaryNote:
        playerImpactContext.byTeamId[seasonTeamId]?.explanationReasons.find((item) =>
          item.key.startsWith("bullpen"),
        )?.sentence ?? null,
      scheduledAt: comparableFocusGame.scheduledAt,
    });
    const comparableExpectedLineup = buildExpectedLineup({
      teamId: seasonTeamId,
      playersById,
      playerSeasonStats: dashboardData.playerSeasonStats,
      playerSplitStats: dashboardData.playerSplitStats,
    });

    return buildStrengthSnapshot({
      team: display,
      expectedLineup: comparableExpectedLineup,
      lineupConfirmed: false,
      starter: comparableStarter,
      bullpenPanel: comparableBullpen,
      teamSeasonStat: comparableTeamSeasonStat,
      playerSeasonStats: dashboardData.playerSeasonStats,
      playerGameStats: dashboardData.playerGameStats,
      playerSplitStats: dashboardData.playerSplitStats,
      playersById,
      rosterEvents: dashboardData.rosterEvents,
      games: dashboardData.games,
      gamesById,
      scheduledAt: comparableFocusGame.scheduledAt,
      leaguePriors,
    });
  };
  const labeledStrengthByTeamId = Object.fromEntries(
    applyPercentileLabels(
      dashboardData.seasonTeams
        .map((seasonTeam) => buildComparableStrengthSnapshot(seasonTeam.seasonTeamId))
        .filter((snapshot): snapshot is TeamConditionStrengthSnapshot => snapshot !== null),
    ).map((snapshot) => [snapshot.team.seasonTeamId, snapshot] as const),
  ) as Record<string, TeamConditionStrengthSnapshot>;
  const labeledTeamStrengthSnapshot =
    labeledStrengthByTeamId[found.seasonTeam.seasonTeamId] ?? teamStrengthSnapshot;
  const labeledOpponentStrengthSnapshot =
    labeledStrengthByTeamId[opponentId] ?? opponentStrengthSnapshot;

  return {
    year,
    team: toTeamStub(found.display),
    opponent: toTeamStub(opponentDisplay),
    focusGame: {
      gameId: focusGame.gameId,
      label: focusIsToday ? "오늘 경기" : "다음 경기",
      isToday: focusIsToday,
      scheduledAt: focusGame.scheduledAt,
      homeAwayLabel: focusGame.homeSeasonTeamId === found.seasonTeam.seasonTeamId ? "홈" : "원정",
      venueName: venue?.nameKo ?? "경기장 정보 없음",
      weather,
      headToHeadLabel: headToHeadSummary(found.seasonTeam.seasonTeamId, opponentId, dashboardData.games),
      probability,
    },
    starterMatchup: {
      teamStarter,
      opponentStarter,
    },
    bullpenComparison: {
      team: teamBullpen,
      opponent: opponentBullpen,
    },
    strengthOverview: {
      team: labeledTeamStrengthSnapshot,
      opponent: labeledOpponentStrengthSnapshot,
    },
    lineupStatus,
    expectedLineup: teamExpectedLineup,
    keyPlayers: buildKeyPlayers(
      found.seasonTeam.seasonTeamId,
      dashboardData.playerSeasonStats,
      playersById,
      teamExpectedLineup,
      lineupConfirmed,
    ),
    updatedAt: new Date().toISOString(),
  };
};
