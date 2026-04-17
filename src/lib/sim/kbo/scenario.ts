import type {
  Game,
  ScenarioForcedOutcome,
  ScenarioOverride,
  Series,
  UserScenario,
} from "@/lib/domain/kbo/types";
import { userScenarioSchema } from "@/lib/domain/kbo/schemas";

export type ForcedGameOutcome = "homeWin" | "awayWin" | "tie" | null;

function encodeBase64Url(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64url");
  }

  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64url").toString("utf8");
  }

  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializeScenarioKey(overrides: ScenarioOverride[]): string {
  return JSON.stringify(
    [...overrides]
      .sort((left, right) => left.targetId.localeCompare(right.targetId))
      .map((override) => [override.targetType, override.targetId, override.forcedOutcome]),
  );
}

export function buildScenarioExport(overrides: ScenarioOverride[], seasonId: string): string {
  return JSON.stringify(
    {
      version: 1,
      seasonId,
      overrides,
    },
    null,
    2,
  );
}

export function buildScenarioExportPayload(scenario: UserScenario): string {
  return JSON.stringify(
    {
      version: 1,
      scenario,
    },
    null,
    2,
  );
}

export function buildScenarioShareToken(scenario: UserScenario): string {
  return encodeBase64Url(
    JSON.stringify({
      version: 1,
      scenario,
    }),
  );
}

export function parseScenarioImport(
  input: string,
  fallbackSeasonId: string,
): UserScenario {
  const raw = JSON.parse(input) as unknown;
  const normalized =
    typeof raw === "object" &&
    raw !== null &&
    "scenario" in raw
      ? (raw as { scenario: unknown }).scenario
      : raw;
  const scenario = userScenarioSchema.parse(normalized);

  return {
    ...scenario,
    seasonId: scenario.seasonId || fallbackSeasonId,
  };
}

export function parseScenarioShareToken(
  token: string,
  fallbackSeasonId: string,
): UserScenario {
  return parseScenarioImport(decodeBase64Url(token), fallbackSeasonId);
}

function resolveSeriesPattern(
  forcedOutcome: ScenarioForcedOutcome,
  remainingGameCount: number,
): ForcedGameOutcome[] {
  if (forcedOutcome === "homeSweep") {
    return Array.from({ length: remainingGameCount }, () => "homeWin");
  }

  if (forcedOutcome === "awaySweep") {
    return Array.from({ length: remainingGameCount }, () => "awayWin");
  }

  if (forcedOutcome === "homeSeriesWin") {
    return Array.from({ length: remainingGameCount }, (_, index) =>
      index < Math.ceil(remainingGameCount / 2) ? "homeWin" : "awayWin",
    );
  }

  if (forcedOutcome === "awaySeriesWin") {
    return Array.from({ length: remainingGameCount }, (_, index) =>
      index < Math.ceil(remainingGameCount / 2) ? "awayWin" : "homeWin",
    );
  }

  return Array.from({ length: remainingGameCount }, () => null);
}

export function resolveForcedOutcomeForGame(
  game: Game,
  allGames: Game[],
  seriesById: Record<string, Series>,
  overrides: ScenarioOverride[],
): ForcedGameOutcome {
  const direct = overrides.find(
    (override) => override.targetType === "game" && override.targetId === game.gameId,
  );
  if (direct) {
    if (direct.forcedOutcome === "homeWin" || direct.forcedOutcome === "awayWin" || direct.forcedOutcome === "tie") {
      return direct.forcedOutcome;
    }
    return null;
  }

  const seriesOverride = overrides.find(
    (override) => override.targetType === "series" && override.targetId === game.seriesId,
  );
  if (!seriesOverride || seriesOverride.forcedOutcome === "model") {
    return null;
  }

  const series = seriesById[game.seriesId];
  if (!series) {
    return null;
  }

  const remainingGames = allGames
    .filter((item) => item.seriesId === game.seriesId && item.status !== "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const index = remainingGames.findIndex((item) => item.gameId === game.gameId);
  if (index < 0) {
    return null;
  }

  const pattern = resolveSeriesPattern(seriesOverride.forcedOutcome, remainingGames.length);
  return pattern[index] ?? null;
}
