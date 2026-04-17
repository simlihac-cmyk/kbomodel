import type { KboDataBundle, Player, PlayerSeasonStat } from "@/lib/domain/kbo/types";
import {
  normalizedPlayerSeasonStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedPlayerRegisterRow,
  type ParsedPlayerSummaryHitterRow,
  type ParsedPlayerSummaryPitcherRow,
  type SourceId,
} from "@/lib/data-sources/kbo/dataset-types";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizePlayerSeasonStatsArgs = {
  seasonId: string;
  sourceId: SourceId;
  hitters: ParsedPlayerSummaryHitterRow[];
  pitchers: ParsedPlayerSummaryPitcherRow[];
  registerRows: ParsedPlayerRegisterRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRefs: NormalizedSourceReference[];
};

const POSITION_MAP: Record<string, string[]> = {
  pitcher: ["P"],
  catcher: ["C"],
  infielder: ["IF"],
  outfielder: ["OF"],
};

export type OfficialPlayerIdentityPayload = {
  pcode: string;
  teamName: string;
  playerNameEn: string;
  position: string;
  backNumber: string | null;
  birthDate: string | null;
  debutYear: number;
};

function resolveExistingPlayer(bundle: KboDataBundle, playerNameEn: string, franchiseId: string) {
  const normalizedName = playerNameEn.toLowerCase();
  return (
    bundle.players.find(
      (player) =>
        player.franchiseIds.includes(franchiseId) &&
        (player.nameEn.toLowerCase() === normalizedName || player.nameKo.toLowerCase() === normalizedName),
    ) ?? null
  );
}

function resolveExistingPlayerByKoreanName(bundle: KboDataBundle, playerNameKo: string, franchiseId: string) {
  const normalizedName = playerNameKo.toLowerCase();
  return (
    bundle.players.find(
      (player) =>
        player.franchiseIds.includes(franchiseId) && player.nameKo.toLowerCase() === normalizedName,
    ) ?? null
  );
}

export function buildOfficialRegisterLookup(
  registerRows: ParsedPlayerRegisterRow[],
  seasonId: string,
  bundle: KboDataBundle,
  patches: ManualSourcePatchBundle,
) {
  const registerLookup = new Map<string, ParsedPlayerRegisterRow>();

  for (const row of registerRows) {
    if (!row.backNumber || !row.position) {
      continue;
    }
    const seasonTeamId = resolveSeasonTeamId(row.teamName, "official-kbo-ko", seasonId, bundle, patches);
    if (!seasonTeamId) {
      continue;
    }
    registerLookup.set(`${seasonTeamId}|${row.position}|${row.backNumber}`, row);
  }

  return registerLookup;
}

function buildOfficialPlayerId(pcode: string) {
  return `player:official-kbo-en:${pcode}`;
}

function buildRegisterMatchedPlayerId(seasonId: string, seasonTeamId: string, playerNameKo: string) {
  return `player:${seasonId}:${seasonTeamId}:${slugifyFragment(playerNameKo)}`;
}

function mapPosition(position: string) {
  const normalized = position.trim().toLowerCase();
  return POSITION_MAP[normalized] ?? ["UTIL"];
}

function mapEnglishPositionToKorean(position: string) {
  const normalized = position.trim().toLowerCase();
  if (normalized === "pitcher") {
    return "투수";
  }
  if (normalized === "catcher") {
    return "포수";
  }
  if (normalized === "infielder") {
    return "내야수";
  }
  if (normalized === "outfielder") {
    return "외야수";
  }
  return null;
}

function createPlayerRecord(
  pcode: string,
  seasonId: string,
  seasonTeamId: string,
  franchiseId: string,
  payload: {
    playerNameEn: string;
    backNumber: string | null;
    birthDate: string | null;
    position: string;
    debutYear: number;
  },
  matchedRegisterRow: ParsedPlayerRegisterRow | null,
  existing: Player | null,
): Player {
  const playerId =
    existing?.playerId ??
    (matchedRegisterRow
      ? buildRegisterMatchedPlayerId(seasonId, seasonTeamId, matchedRegisterRow.playerName)
      : buildOfficialPlayerId(pcode));
  return {
    playerId,
    slug: existing?.slug ?? slugifyFragment(matchedRegisterRow?.playerName ?? payload.playerNameEn),
    nameKo: existing?.nameKo ?? matchedRegisterRow?.playerName ?? payload.playerNameEn,
    nameEn: payload.playerNameEn,
    birthDate: existing?.birthDate ?? payload.birthDate,
    batsThrows: existing?.batsThrows ?? null,
    primaryPositions: existing?.primaryPositions?.length ? existing.primaryPositions : mapPosition(payload.position),
    debutYear:
      existing?.debutYear ??
      (payload.debutYear > 0
        ? payload.debutYear
        : Number.parseInt(seasonId.replace(/\D/g, "").slice(0, 4), 10)),
    franchiseIds: Array.from(new Set([...(existing?.franchiseIds ?? []), franchiseId])),
    bio:
      existing?.bio && !existing.bio.includes("fictional seed")
        ? existing.bio
        : `${matchedRegisterRow?.playerName ?? payload.playerNameEn}의 공식 선수 요약 페이지를 바탕으로 정리한 프로필입니다.`,
  };
}

export function resolveOfficialPlayerIdentity(args: {
  seasonId: string;
  sourceId: SourceId;
  payload: OfficialPlayerIdentityPayload;
  registerLookup: Map<string, ParsedPlayerRegisterRow>;
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
}) {
  const { seasonId, sourceId, payload, registerLookup, bundle, patches } = args;
  const seasonTeamId = resolveSeasonTeamId(payload.teamName, sourceId, seasonId, bundle, patches);
  if (!seasonTeamId) {
    return null;
  }
  const seasonTeam = bundle.seasonTeams.find((item) => item.seasonTeamId === seasonTeamId);
  if (!seasonTeam) {
    return null;
  }

  const matchedRegisterRow = payload.backNumber
    ? registerLookup.get(
        `${seasonTeamId}|${mapEnglishPositionToKorean(payload.position) ?? payload.position}|${payload.backNumber}`,
      ) ?? null
    : null;
  const existing =
    (matchedRegisterRow
      ? resolveExistingPlayerByKoreanName(bundle, matchedRegisterRow.playerName, seasonTeam.franchiseId)
      : null) ??
    resolveExistingPlayer(bundle, payload.playerNameEn, seasonTeam.franchiseId);
  const player = createPlayerRecord(
    payload.pcode,
    seasonId,
    seasonTeamId,
    seasonTeam.franchiseId,
    payload,
    matchedRegisterRow,
    existing,
  );

  return {
    seasonTeamId,
    player,
  };
}

function createHitterStat(seasonId: string, seasonTeamId: string, playerId: string, row: ParsedPlayerSummaryHitterRow): PlayerSeasonStat {
  return {
    statId: `stat:${seasonId}:${playerId}:hitter`,
    seasonId,
    playerId,
    seasonTeamId,
    statType: "hitter",
    games: row.games,
    plateAppearances: row.plateAppearances,
    atBats: row.atBats,
    hits: row.hits,
    homeRuns: row.homeRuns,
    ops: row.ops,
    era: null,
    inningsPitched: null,
    strikeouts: null,
    saves: null,
    wins: null,
    losses: null,
    war: null,
  };
}

function createPitcherStat(seasonId: string, seasonTeamId: string, playerId: string, row: ParsedPlayerSummaryPitcherRow): PlayerSeasonStat {
  return {
    statId: `stat:${seasonId}:${playerId}:pitcher`,
    seasonId,
    playerId,
    seasonTeamId,
    statType: "pitcher",
    games: row.games,
    plateAppearances: null,
    atBats: null,
    hits: null,
    homeRuns: null,
    ops: null,
    era: row.era,
    inningsPitched: row.inningsPitched,
    strikeouts: row.strikeouts,
    saves: row.saves,
    wins: row.wins,
    losses: row.losses,
    war: null,
  };
}

export function normalizePlayerSeasonStats({
  seasonId,
  sourceId,
  hitters,
  pitchers,
  registerRows,
  bundle,
  patches,
  sourceRefs,
}: NormalizePlayerSeasonStatsArgs) {
  const players: Player[] = [];
  const stats: PlayerSeasonStat[] = [];
  const registerLookup = buildOfficialRegisterLookup(registerRows, seasonId, bundle, patches);

  for (const row of hitters) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }
    const { seasonTeamId, player } = identity;
    players.push(player);
    stats.push(createHitterStat(seasonId, seasonTeamId, player.playerId, row));
  }

  for (const row of pitchers) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      bundle,
      patches,
    });
    if (!identity) {
      continue;
    }
    const { seasonTeamId, player } = identity;
    players.push(player);
    stats.push(createPitcherStat(seasonId, seasonTeamId, player.playerId, row));
  }

  const dedupedPlayers = Array.from(new Map(players.map((player) => [player.playerId, player] as const)).values());
  const dedupedStats = Array.from(new Map(stats.map((stat) => [stat.statId, stat] as const)).values());

  return normalizedPlayerSeasonStatsSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: sourceRefs,
    players: dedupedPlayers,
    stats: dedupedStats,
  });
}
