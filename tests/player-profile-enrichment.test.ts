import { describe, expect, it } from "vitest";

import type { NormalizedPlayerSeasonStats, ParsedPlayerProfileRow } from "@/lib/data-sources/kbo/dataset-types";
import { enrichPlayerSeasonStatsWithOfficialKoProfiles } from "@/lib/data-sources/kbo/normalize/player-profiles";

describe("player profile enrichment", () => {
  it("overlays official Korean profile fields onto season players", () => {
    const dataset: NormalizedPlayerSeasonStats = {
      generatedAt: "2026-04-18T00:00:00.000Z",
      seasonId: "kbo-2026",
      sources: [],
      players: [
        {
          playerId: "player:official-kbo-en:62404",
          slug: "koo-ja-wook",
          nameKo: "KOO Ja Wook",
          nameEn: "KOO Ja Wook",
          officialPlayerCode: "62404",
          birthDate: null,
          batsThrows: null,
          heightWeight: null,
          careerHistory: null,
          draftInfo: null,
          joinInfo: null,
          primaryPositions: ["UTIL"],
          debutYear: 2012,
          franchiseIds: ["franchise:samsung"],
          bio: "KOO Ja Wook의 공식 선수 요약 페이지를 바탕으로 정리한 프로필입니다.",
        },
      ],
      stats: [],
    };

    const profileRows: ParsedPlayerProfileRow[] = [
      {
        pcode: "62404",
        statType: "hitter",
        teamName: "삼성 라이온즈",
        playerName: "구자욱",
        backNumber: "5",
        birthDate: "1993-02-12",
        positionLabel: "외야수",
        batsThrows: "우투좌타",
        heightWeight: "189cm/75kg",
        career: "본리초-경복중-대구고-삼성-상무",
        draftInfo: "12 삼성 2라운드 12순위",
        joinInfo: "12삼성",
      },
    ];

    const enriched = enrichPlayerSeasonStatsWithOfficialKoProfiles(dataset, profileRows);

    expect(enriched.players[0]).toMatchObject({
      nameKo: "구자욱",
      birthDate: "1993-02-12",
      batsThrows: "우투좌타",
      heightWeight: "189cm/75kg",
      careerHistory: "본리초-경복중-대구고-삼성-상무",
      draftInfo: "12 삼성 2라운드 12순위",
      joinInfo: "12삼성",
      primaryPositions: ["OF"],
    });
    expect(enriched.players[0]?.bio).toContain("삼성 라이온즈 외야수 구자욱");
    expect(enriched.players[0]?.bio).toContain("1993-02-12생");
    expect(enriched.players[0]?.bio).toContain("지명 12 삼성 2라운드 12순위");
  });
});
