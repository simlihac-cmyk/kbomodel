import type { Player } from "@/lib/domain/kbo/types";
import type { NormalizedPlayerSeasonStats, ParsedPlayerProfileRow } from "@/lib/data-sources/kbo/dataset-types";

const POSITION_MAP: Record<string, string[]> = {
  투수: ["P"],
  포수: ["C"],
  내야수: ["IF"],
  외야수: ["OF"],
};

function isGeneratedBio(bio: string) {
  return (
    bio.includes("fictional seed") ||
    bio.includes("공식 선수 요약 페이지를 바탕으로 정리한 프로필") ||
    bio.includes("기본 프로필은 KBO 공식 전체 등록 현황")
  );
}

function buildProfileBio(profile: ParsedPlayerProfileRow, playerName: string) {
  const sentences = [
    [profile.teamName, profile.positionLabel, playerName].filter(Boolean).join(" "),
    [profile.birthDate ? `${profile.birthDate}생` : null, profile.heightWeight, profile.batsThrows]
      .filter(Boolean)
      .join(", "),
    profile.career ? `${profile.career} 경력` : null,
    [profile.draftInfo ? `지명 ${profile.draftInfo}` : null, profile.joinInfo ? `입단 ${profile.joinInfo}` : null]
      .filter(Boolean)
      .join(", "),
  ].filter((value) => value && value.length > 0);

  return `${sentences.join(". ")}.`.trim();
}

type SeasonPlayerRecord = NormalizedPlayerSeasonStats["players"][number];

function normalizeSeasonPlayerRecord(player: Player): SeasonPlayerRecord {
  return {
    ...player,
    officialPlayerCode: player.officialPlayerCode ?? null,
    heightWeight: player.heightWeight ?? null,
    careerHistory: player.careerHistory ?? null,
    draftInfo: player.draftInfo ?? null,
    joinInfo: player.joinInfo ?? null,
  };
}

function enrichPlayerRecord(player: SeasonPlayerRecord, profile: ParsedPlayerProfileRow): SeasonPlayerRecord {
  const positionCodes = profile.positionLabel ? POSITION_MAP[profile.positionLabel] : null;
  const shouldReplacePositions =
    !player.primaryPositions.length || player.primaryPositions.every((position) => position === "UTIL");
  const nameKo = profile.playerName || player.nameKo;

  return {
    ...player,
    nameKo,
    officialPlayerCode: player.officialPlayerCode ?? null,
    birthDate: profile.birthDate ?? player.birthDate,
    batsThrows: profile.batsThrows ?? player.batsThrows,
    heightWeight: profile.heightWeight ?? player.heightWeight,
    careerHistory: profile.career ?? player.careerHistory,
    draftInfo: profile.draftInfo ?? player.draftInfo,
    joinInfo: profile.joinInfo ?? player.joinInfo,
    primaryPositions: shouldReplacePositions && positionCodes ? positionCodes : player.primaryPositions,
    bio: isGeneratedBio(player.bio) ? buildProfileBio(profile, nameKo) : player.bio,
  };
}

export function enrichPlayerSeasonStatsWithOfficialKoProfiles(
  dataset: NormalizedPlayerSeasonStats,
  profileRows: ParsedPlayerProfileRow[],
): NormalizedPlayerSeasonStats {
  if (profileRows.length === 0) {
    return dataset;
  }

  const profileByCode = new Map(profileRows.map((row) => [row.pcode, row] as const));

  return {
    ...dataset,
    players: dataset.players
      .map((player) => {
        const normalizedPlayer = normalizeSeasonPlayerRecord(player);
        if (!player.officialPlayerCode) {
          return normalizedPlayer;
        }
        const profile = profileByCode.get(player.officialPlayerCode);
        return profile ? enrichPlayerRecord(normalizedPlayer, profile) : normalizedPlayer;
      })
      .sort((left, right) => left.nameKo.localeCompare(right.nameKo, "ko")),
  };
}
