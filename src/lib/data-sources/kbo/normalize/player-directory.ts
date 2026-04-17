import type { KboDataBundle, Player } from "@/lib/domain/kbo/types";
import { normalizedPlayersSchema, type NormalizedSourceReference, type ParsedPlayerRegisterRow } from "@/lib/data-sources/kbo/dataset-types";
import type { ManualSourcePatchBundle, SourceId } from "@/lib/data-sources/kbo/dataset-types";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";
import { resolveSeasonTeamId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";

type NormalizePlayerDirectoryArgs = {
  seasonId: string;
  sourceId: SourceId;
  rows: ParsedPlayerRegisterRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

const PLAYER_POSITION_MAP: Record<string, string[]> = {
  투수: ["P"],
  포수: ["C"],
  내야수: ["IF"],
  외야수: ["OF"],
};

function isRosteredPlayer(row: ParsedPlayerRegisterRow) {
  return row.position !== null && row.position in PLAYER_POSITION_MAP;
}

function resolveExistingPlayer(bundle: KboDataBundle, playerName: string, franchiseId: string) {
  return (
    bundle.players.find(
      (player) =>
        player.nameKo.toLowerCase() === playerName.toLowerCase() &&
        player.franchiseIds.includes(franchiseId),
    ) ?? null
  );
}

function buildOfficialPlayerId(seasonId: string, seasonTeamId: string, playerName: string) {
  return `player:${seasonId}:${seasonTeamId}:${slugifyFragment(playerName)}`;
}

function createPlayerRecord(
  seasonId: string,
  seasonTeamId: string,
  franchiseId: string,
  row: ParsedPlayerRegisterRow,
  existing: Player | null,
): Player {
  const playerId = existing?.playerId ?? buildOfficialPlayerId(seasonId, seasonTeamId, row.playerName);
  return {
    playerId,
    slug: existing?.slug ?? slugifyFragment(row.playerName),
    nameKo: row.playerName,
    nameEn: existing?.nameEn ?? row.playerName,
    birthDate: existing?.birthDate ?? null,
    batsThrows: existing?.batsThrows ?? null,
    primaryPositions: existing?.primaryPositions?.length ? existing.primaryPositions : PLAYER_POSITION_MAP[row.position ?? ""] ?? ["UTIL"],
    debutYear: existing?.debutYear ?? Number.parseInt(seasonId.replace(/\D/g, "").slice(0, 4), 10),
    franchiseIds: Array.from(new Set([...(existing?.franchiseIds ?? []), franchiseId])),
    bio:
      existing?.bio && !existing.bio.includes("fictional seed")
        ? existing.bio
        : `${row.playerName}의 기본 프로필은 KBO 공식 전체 등록 현황을 바탕으로 구성했습니다.`,
  };
}

export function normalizePlayerDirectory({
  seasonId,
  sourceId,
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizePlayerDirectoryArgs) {
  const players = rows
    .filter(isRosteredPlayer)
    .map((row) => {
      const seasonTeamId = resolveSeasonTeamId(row.teamName, sourceId, seasonId, bundle, patches);
      if (!seasonTeamId) {
        return null;
      }
      const seasonTeam = bundle.seasonTeams.find((item) => item.seasonTeamId === seasonTeamId);
      if (!seasonTeam) {
        return null;
      }
      const existing = resolveExistingPlayer(bundle, row.playerName, seasonTeam.franchiseId);
      return createPlayerRecord(seasonId, seasonTeamId, seasonTeam.franchiseId, row, existing);
    })
    .filter((player): player is Player => player !== null);

  const dedupedPlayers = Array.from(
    new Map(players.map((player) => [player.playerId, player] as const)).values(),
  );

  return normalizedPlayersSchema.parse({
    generatedAt: new Date().toISOString(),
    seasonId,
    sources: [sourceRef],
    players: dedupedPlayers,
  });
}
