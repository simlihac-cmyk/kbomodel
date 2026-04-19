import type { KboDataBundle, Player, PlayerSeasonStat } from "@/lib/domain/kbo/types";
import {
  normalizedPlayerSeasonStatsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedPlayerRegisterRow,
  type ParsedPlayerSearchRow,
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
  searchRows?: ParsedPlayerSearchRow[];
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

type OfficialPlayerSearchLookupRow = Pick<
  ParsedPlayerSearchRow,
  "pcode" | "teamName" | "playerName" | "position" | "backNumber" | "birthDate"
>;

const OFFICIAL_SEARCH_TEAM_NAME_MAP: Record<string, string> = {
  lg: "LG",
  ss: "SAMSUNG",
  kt: "KT",
  sk: "SSG",
  nc: "NC",
  ht: "KIA",
  hh: "HANWHA",
  ob: "DOOSAN",
  lt: "LOTTE",
  wo: "KIWOOM",
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

function resolveExistingPlayerByOfficialCode(bundle: KboDataBundle, pcode: string) {
  return bundle.players.find((player) => player.officialPlayerCode === pcode) ?? null;
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

export function buildOfficialPlayerSearchLookup(searchRows: ParsedPlayerSearchRow[]) {
  return new Map(
    searchRows.map((row) => [
      row.pcode,
      {
        ...row,
        teamName: OFFICIAL_SEARCH_TEAM_NAME_MAP[row.teamName.toLowerCase()] ?? row.teamName,
      },
    ] as const),
  );
}

function buildOfficialPlayerId(pcode: string) {
  return `player:official-kbo-en:${pcode}`;
}

function buildRegisterMatchedPlayerId(seasonId: string, seasonTeamId: string, playerNameKo: string, pcode: string) {
  return `player:${seasonId}:${seasonTeamId}:${slugifyFragment(playerNameKo)}:${pcode}`;
}

function pickCompatibleExistingPlayer(existing: Player | null, pcode: string) {
  if (!existing) {
    return null;
  }

  if (existing.officialPlayerCode && existing.officialPlayerCode !== pcode) {
    return null;
  }

  return existing;
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

function isLikelyRomanizedName(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return /^[A-Za-z0-9\s.'`-]+$/.test(value.trim());
}

function resolvePreferredKoreanName(
  existing: Player | null,
  matchedRegisterRow: ParsedPlayerRegisterRow | null,
  fallbackName: string,
) {
  const registerName = matchedRegisterRow?.playerName ?? null;
  if (registerName) {
    if (!existing?.nameKo) {
      return registerName;
    }
    if (existing.nameKo === existing.nameEn || existing.nameKo === fallbackName || isLikelyRomanizedName(existing.nameKo)) {
      return registerName;
    }
  }

  return existing?.nameKo ?? registerName ?? fallbackName;
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
  const preferredNameKo = resolvePreferredKoreanName(existing, matchedRegisterRow, payload.playerNameEn);
  const playerId =
    existing?.playerId ??
    (matchedRegisterRow
      ? buildRegisterMatchedPlayerId(seasonId, seasonTeamId, matchedRegisterRow.playerName, pcode)
      : buildOfficialPlayerId(pcode));
  return {
    playerId,
    slug: existing?.slug ?? slugifyFragment(preferredNameKo),
    nameKo: preferredNameKo,
    nameEn: payload.playerNameEn,
    officialPlayerCode: existing?.officialPlayerCode ?? pcode,
    birthDate: existing?.birthDate ?? payload.birthDate,
    batsThrows: existing?.batsThrows ?? null,
    heightWeight: existing?.heightWeight ?? null,
    careerHistory: existing?.careerHistory ?? null,
    draftInfo: existing?.draftInfo ?? null,
    joinInfo: existing?.joinInfo ?? null,
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
        : `${preferredNameKo}의 공식 선수 요약 페이지를 바탕으로 정리한 프로필입니다.`,
  };
}

export function resolveOfficialPlayerIdentity(args: {
  seasonId: string;
  sourceId: SourceId;
  payload: OfficialPlayerIdentityPayload;
  registerLookup: Map<string, ParsedPlayerRegisterRow>;
  searchLookup?: Map<string, OfficialPlayerSearchLookupRow>;
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
}) {
  const { seasonId, sourceId, payload, registerLookup, searchLookup, bundle, patches } = args;
  const searchBackedPayload = searchLookup?.get(payload.pcode);
  const candidatePayloads = [
    payload,
    ...(searchBackedPayload
      ? [
          {
            ...payload,
            teamName: searchBackedPayload.teamName,
            playerNameEn: searchBackedPayload.playerName,
            position: searchBackedPayload.position ?? payload.position,
            backNumber: searchBackedPayload.backNumber ?? payload.backNumber,
            birthDate: searchBackedPayload.birthDate ?? payload.birthDate,
          },
        ]
      : []),
  ];

  for (const candidate of candidatePayloads) {
    const seasonTeamId = resolveSeasonTeamId(candidate.teamName, sourceId, seasonId, bundle, patches);
    if (!seasonTeamId) {
      continue;
    }
    const seasonTeam = bundle.seasonTeams.find((item) => item.seasonTeamId === seasonTeamId);
    if (!seasonTeam) {
      continue;
    }

    const matchedRegisterRow = candidate.backNumber
      ? registerLookup.get(
          `${seasonTeamId}|${mapEnglishPositionToKorean(candidate.position) ?? candidate.position}|${candidate.backNumber}`,
        ) ?? null
      : null;
    const existing =
      resolveExistingPlayerByOfficialCode(bundle, candidate.pcode) ??
      pickCompatibleExistingPlayer(
        matchedRegisterRow
          ? resolveExistingPlayerByKoreanName(bundle, matchedRegisterRow.playerName, seasonTeam.franchiseId)
          : null,
        candidate.pcode,
      ) ??
      pickCompatibleExistingPlayer(
        resolveExistingPlayer(bundle, candidate.playerNameEn, seasonTeam.franchiseId),
        candidate.pcode,
      );
    const player = createPlayerRecord(
      candidate.pcode,
      seasonId,
      seasonTeamId,
      seasonTeam.franchiseId,
      candidate,
      matchedRegisterRow,
      existing,
    );

    return {
      seasonTeamId,
      player,
    };
  }

  return null;
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
    battingAverage: row.battingAverage,
    atBats: row.atBats,
    runs: row.runs,
    hits: row.hits,
    homeRuns: row.homeRuns,
    rbi: row.rbi,
    stolenBases: row.stolenBases,
    walks: row.walks,
    onBasePct: row.onBasePct,
    sluggingPct: row.sluggingPct,
    ops: row.ops,
    era: null,
    inningsPitched: null,
    strikeouts: row.strikeouts,
    saves: null,
    wins: null,
    losses: null,
    holds: null,
    whip: null,
    hitsAllowed: null,
    homeRunsAllowed: null,
    runsAllowed: null,
    earnedRuns: null,
    opponentAvg: null,
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
    battingAverage: null,
    atBats: null,
    runs: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    stolenBases: null,
    walks: row.walks,
    onBasePct: null,
    sluggingPct: null,
    ops: null,
    era: row.era,
    inningsPitched: row.inningsPitched,
    strikeouts: row.strikeouts,
    saves: row.saves,
    wins: row.wins,
    losses: row.losses,
    holds: row.holds,
    whip: row.whip,
    hitsAllowed: row.hitsAllowed,
    homeRunsAllowed: row.homeRunsAllowed,
    runsAllowed: row.runsAllowed,
    earnedRuns: row.earnedRuns,
    opponentAvg: row.opponentAvg,
    war: null,
  };
}

export function normalizePlayerSeasonStats({
  seasonId,
  sourceId,
  hitters,
  pitchers,
  registerRows,
  searchRows = [],
  bundle,
  patches,
  sourceRefs,
}: NormalizePlayerSeasonStatsArgs) {
  const players: Player[] = [];
  const stats: PlayerSeasonStat[] = [];
  const registerLookup = buildOfficialRegisterLookup(registerRows, seasonId, bundle, patches);
  const searchLookup = buildOfficialPlayerSearchLookup(searchRows);

  for (const row of hitters) {
    const identity = resolveOfficialPlayerIdentity({
      seasonId,
      sourceId,
      payload: row,
      registerLookup,
      searchLookup,
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
      searchLookup,
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
