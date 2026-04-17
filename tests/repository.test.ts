import { describe, expect, it } from "vitest";

import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { MemoryKboRepository } from "@/lib/repositories/kbo/memory-adapter";

describe("FileKboRepository", () => {
  it("parses the seed bundle and returns season context", async () => {
    const repository = new FileKboRepository();
    const bundle = await repository.getBundle();
    const seasonContext = await repository.getSeasonContext(2026);

    expect(bundle.seasons.length).toBeGreaterThanOrEqual(3);
    expect(bundle.franchises.length).toBe(10);
    expect(seasonContext?.season.year).toBe(2026);
    expect(seasonContext?.seasonTeams.length).toBe(10);
    expect(seasonContext?.games.length).toBeGreaterThan(0);
  });

  it("overlays normalized ingest outputs onto the current season bundle", async () => {
    const repository = new FileKboRepository();
    const seasonContext = await repository.getSeasonContext(2026);

    expect(seasonContext?.games).toHaveLength(672);
    expect(seasonContext?.series).toHaveLength(224);
    expect(seasonContext?.games[0]?.gameId).toBe("game:official-kbo-ko:20260328KTLG0");
    expect(seasonContext?.teamSeasonStats.find((item) => item.seasonTeamId === "kbo-2026:lg")?.wins).toBe(10);
    expect(seasonContext?.players.some((item) => item.nameKo === "임찬규")).toBe(true);
  });

  it("applies in-memory game schedule patches on top of the bundle", async () => {
    const repository = new FileKboRepository();
    const [bundle, adjustments, schedulePatches, seasonMetaPatches, teamBrandPatches] = await Promise.all([
      repository.getBundle(),
      repository.getManualAdjustments(),
      repository.getSchedulePatches(),
      repository.getSeasonMetaPatches(),
      repository.getTeamBrandPatches(),
    ]);
    const targetGame = bundle.games.find((game) => game.seasonId === "kbo-2026")!;
    const memoryRepository = new MemoryKboRepository(
      bundle,
      adjustments,
      schedulePatches,
      seasonMetaPatches,
      teamBrandPatches,
    );

    await memoryRepository.saveGameSchedulePatch({
      gameId: targetGame.gameId,
      status: "postponed",
      scheduledAt: targetGame.scheduledAt,
      note: "테스트용 우천 취소",
      homeScore: null,
      awayScore: null,
      updatedAt: "2026-04-15T12:00:00+09:00",
    });

    const nextBundle = await memoryRepository.getBundle();
    const patchedGame = nextBundle.games.find((game) => game.gameId === targetGame.gameId);
    expect(patchedGame?.status).toBe("postponed");
    expect(patchedGame?.note).toBe("테스트용 우천 취소");
  });

  it("applies season and team brand patches on top of the bundle", async () => {
    const repository = new FileKboRepository();
    const [bundle, adjustments, schedulePatches, seasonMetaPatches, teamBrandPatches] = await Promise.all([
      repository.getBundle(),
      repository.getManualAdjustments(),
      repository.getSchedulePatches(),
      repository.getSeasonMetaPatches(),
      repository.getTeamBrandPatches(),
    ]);
    const memoryRepository = new MemoryKboRepository(
      bundle,
      adjustments,
      schedulePatches,
      seasonMetaPatches,
      teamBrandPatches,
    );

    await memoryRepository.saveSeasonMetaPatch({
      seasonId: "kbo-2026",
      label: "2026 KBO 테스트 라벨",
      status: "ongoing",
      phase: "regular",
      rulesetId: "kbo-rules-2026",
      updatedAt: "2026-04-15T12:00:00+09:00",
    });
    await memoryRepository.saveTeamBrandPatch({
      brandId: "lg-twins",
      displayNameKo: "LG 트윈스 테스트",
      shortNameKo: "LGT",
      shortCode: "LGT",
      primaryColor: "#101010",
      secondaryColor: "#f0f0f0",
      wordmarkText: "TWINS TEST",
      updatedAt: "2026-04-15T12:00:00+09:00",
    });

    const nextBundle = await memoryRepository.getBundle();
    expect(nextBundle.seasons.find((season) => season.seasonId === "kbo-2026")?.label).toBe(
      "2026 KBO 테스트 라벨",
    );
    expect(nextBundle.teamBrands.find((brand) => brand.brandId === "lg-twins")?.displayNameKo).toBe(
      "LG 트윈스 테스트",
    );
  });
});
