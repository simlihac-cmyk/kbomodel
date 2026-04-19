import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseOfficialEnDailySchedule } from "@/lib/data-sources/kbo/adapters/official-en/daily-schedule";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
import { parseOfficialEnPlayerSplitsMonthHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-splits-month-hitter";
import { parseOfficialEnPlayerSplitsMonthPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-splits-month-pitcher";
import { parseOfficialEnPlayerSituationsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-hitter";
import { parseOfficialEnPlayerSituationsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-pitcher";
import { parseOfficialEnPlayerSituationsCountHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-count-hitter";
import { parseOfficialEnPlayerSituationsCountPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-count-pitcher";
import { parseOfficialEnPlayerSituationsRunnerHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-runner-hitter";
import { parseOfficialEnPlayerSituationsRunnerPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-runner-pitcher";
import { parseOfficialEnPlayerSituationsOutHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-out-hitter";
import { parseOfficialEnPlayerSituationsOutPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-out-pitcher";
import { parseOfficialEnPlayerSituationsInningHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-inning-hitter";
import { parseOfficialEnPlayerSituationsInningPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-inning-pitcher";
import { parseOfficialEnPlayerSituationsBattingOrderHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-batting-order-hitter";
import { parseOfficialEnPlayerSituationsBattingOrderPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-situations-batting-order-pitcher";
import { parseOfficialEnPlayerSummaryHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-hitter";
import { parseOfficialEnPlayerSummaryPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-pitcher";
import { parseOfficialEnStandings } from "@/lib/data-sources/kbo/adapters/official-en/standings";
import { parseOfficialKoPlayerAwardsDefensePrize } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-defense-prize";
import { parseOfficialKoPlayerAwardsGoldenGlove } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-golden-glove";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { parseOfficialKoPlayerAwardsMvpRookie } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-mvp-rookie";
import { parseOfficialKoPlayerAwardsSeriesPrize } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-series-prize";
import { parseOfficialKoRules } from "@/lib/data-sources/kbo/adapters/official-ko/rules";
import { parseOfficialKoTeamHitter } from "@/lib/data-sources/kbo/adapters/official-ko/team-hitter";
import { parseOfficialKoTeamHistory } from "@/lib/data-sources/kbo/adapters/official-ko/team-history";
import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";
import { parseOfficialKoTrade } from "@/lib/data-sources/kbo/adapters/official-ko/trade";
import { applyManualPatchesToSeriesGames } from "@/lib/data-sources/kbo/merge/apply-manual-patches";
import { normalizeFranchiseHistory } from "@/lib/data-sources/kbo/normalize/franchise-history";
import { mergeNormalizedAwards, normalizeAwards } from "@/lib/data-sources/kbo/normalize/awards";
import { normalizePlayerDirectory } from "@/lib/data-sources/kbo/normalize/player-directory";
import { normalizePlayerCareerStats } from "@/lib/data-sources/kbo/normalize/player-career-stats";
import { normalizePlayerGameStats } from "@/lib/data-sources/kbo/normalize/player-game-stats";
import { normalizePlayerSplitStats } from "@/lib/data-sources/kbo/normalize/player-split-stats";
import { normalizePlayerSeasonStats } from "@/lib/data-sources/kbo/normalize/player-season-stats";
import { normalizeRosterEvents } from "@/lib/data-sources/kbo/normalize/roster-events";
import { normalizeRulesets } from "@/lib/data-sources/kbo/normalize/ruleset";
import { normalizeScheduleToSeriesGames } from "@/lib/data-sources/kbo/normalize/schedule-to-series-games";
import { buildSimulationSeedInputs } from "@/lib/data-sources/kbo/normalize/simulation-inputs";
import { normalizeStandings } from "@/lib/data-sources/kbo/normalize/standings";
import { normalizeTeamHitterStats, normalizeTeamPitcherStats } from "@/lib/data-sources/kbo/normalize/team-stats";
import { FileKboRepository } from "@/lib/repositories/kbo/file-adapter";
import { FileKboIngestPatchRepository } from "@/lib/repositories/kbo/patch-repository";

async function readFixture(relativePath: string) {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

const awardsHtmlFixture = `
  <table class="tData award" summary="MVP・신인상">
    <thead>
      <tr>
        <th>연도</th>
        <th>KBO MVP</th>
        <th>KBO 신인상</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2025</td>
        <td><span>폰세</span><span>한화</span><span>투수</span></td>
        <td><span>안현민</span><span>KT</span><span>외야수</span></td>
      </tr>
      <tr>
        <td>2024</td>
        <td><span>김도영</span><span>KIA</span><span>내야수</span></td>
        <td><span>김택연</span><span>두산</span><span>투수</span></td>
      </tr>
    </tbody>
  </table>
`;

const goldenGloveHtmlFixture = `
  <table class="tData award mini">
    <thead>
      <tr>
        <th>연도</th>
        <th>투수</th>
        <th>포수</th>
        <th>외야수</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2025</td>
        <td><span>폰세</span><span>한화</span></td>
        <td><span>양의지</span><span>두산</span></td>
        <td>
          <p><span>구자욱</span><span>삼성</span></p>
          <p><span>레이예스</span><span>롯데</span></p>
          <p><span>안현민</span><span>KT</span></p>
        </td>
      </tr>
    </tbody>
  </table>
`;

const defensePrizeHtmlFixture = `
  <table class="tData award mini">
    <thead>
      <tr>
        <th>연도</th>
        <th>투수</th>
        <th>유격수</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2023</td>
        <td><span>알칸타라</span><span>두산</span></td>
        <td>
          <p><span>박찬호</span><span>KIA</span></p>
          <p><span>오지환</span><span>LG</span></p>
        </td>
      </tr>
    </tbody>
  </table>
`;

const seriesPrizeHtmlFixture = `
  <table class="tData award">
    <thead>
      <tr>
        <th>연도</th>
        <th>KBO 올스타전 MVP</th>
        <th>KBO 한국시리즈 MVP</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2025</td>
        <td><span>박동원</span><span>LG</span><span>포수</span></td>
        <td><span>김현수</span><span>LG</span><span>외야수</span></td>
      </tr>
      <tr>
        <td>2021</td>
        <td><span>-</span><span>-</span><span>-</span></td>
        <td><span>박경수</span><span>KT</span><span>내야수</span></td>
      </tr>
    </tbody>
  </table>
`;

describe("KBO ingest normalization", () => {
  it("normalizes schedule rows into series-first series/games payload", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);
    const rows = parseOfficialEnDailySchedule(
      await readFixture("src/lib/data-sources/kbo/fixtures/official-en/daily-schedule.html"),
    );

    const normalized = normalizeScheduleToSeriesGames({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      rows,
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-en",
        datasetId: "schedule-calendar",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    expect(normalized.series).toHaveLength(45);
    expect(normalized.games).toHaveLength(130);
    expect(normalized.series[0]?.plannedLength).toBe(2);
    expect(normalized.games[0]?.homeSeasonTeamId).toBe("kbo-2026:lg");
  });

  it("normalizes standings and roster events into simulation seed inputs", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const standings = normalizeStandings({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      rows: parseOfficialEnStandings(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/standings.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-en",
        datasetId: "standings",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const seriesGames = normalizeScheduleToSeriesGames({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      rows: parseOfficialEnDailySchedule(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/daily-schedule.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-en",
        datasetId: "schedule-calendar",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const rosterEvents = normalizeRosterEvents({
      seasonId: season.seasonId,
      sourceId: "official-kbo-ko",
      rows: parseOfficialKoTrade(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/trade.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "roster-movement",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const simulationSeed = buildSimulationSeedInputs({
      standings,
      seriesGames,
      rosterEvents,
    });

    expect(standings.rows).toHaveLength(10);
    expect(rosterEvents.events[0]?.playerId).toBe("lg-h-1");
    expect(simulationSeed.remainingSchedule).toHaveLength(75);
    expect(simulationSeed.headToHeadRemainingGames["kbo-2026:doosan__kbo-2026:heroes"]).toBe(1);
  });

  it("normalizes franchise lineage and ruleset payloads", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, patches] = await Promise.all([
      repository.getBundle(),
      patchRepository.getManualSourcePatches(),
    ]);

    const lineage = normalizeFranchiseHistory({
      rows: parseOfficialKoTeamHistory(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-history.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "team-history",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const rulesets = normalizeRulesets({
      rows: parseOfficialKoRules(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/rules.html"),
      ),
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "rules",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    expect(lineage.franchises).toHaveLength(2);
    expect(lineage.teamBrands).toHaveLength(4);
    expect(rulesets.rulesets[0]?.regularSeasonGamesPerTeam).toBe(144);
    expect(rulesets.rulesets[0]?.postseasonFormat).toHaveLength(4);
  });

  it("normalizes official player directory rows into app player identities", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const players = normalizePlayerDirectory({
      seasonId: season.seasonId,
      sourceId: "official-kbo-ko",
      rows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-register-all",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    expect(players.players.length).toBeGreaterThanOrEqual(bundle.players.length);
    expect(players.players.some((player) => player.nameKo === "임찬규")).toBe(true);
    expect(players.players.find((player) => player.nameKo === "오지환")?.primaryPositions).toEqual(["IF"]);
  });

  it("normalizes official Korean MVP and rookie awards into bundle awards", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, patches] = await Promise.all([
      repository.getBundle(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizeAwards({
      rows: parseOfficialKoPlayerAwardsMvpRookie(awardsHtmlFixture),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-awards-mvp-rookie",
        snapshotKey: "2026-04-18",
        parserVersion: "test",
      },
    });

    expect(normalized.awards).toHaveLength(4);
    expect(
      normalized.awards.find((item) => item.label === "KBO 신인상" && item.seasonId === "kbo-2025")?.seasonTeamId,
    ).toBe("kbo-2025:kt");
    expect(
      normalized.awards.find((item) => item.label === "KBO MVP" && item.seasonId === "archive-2024")?.note,
    ).toBe("김도영 · KIA · 내야수");
  });

  it("merges official Korean award datasets into a single awards payload", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, patches] = await Promise.all([
      repository.getBundle(),
      patchRepository.getManualSourcePatches(),
    ]);

    const mvpRookie = normalizeAwards({
      rows: parseOfficialKoPlayerAwardsMvpRookie(awardsHtmlFixture),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-awards-mvp-rookie",
        snapshotKey: "2026-04-18",
        parserVersion: "test",
      },
    });
    const goldenGlove = normalizeAwards({
      rows: parseOfficialKoPlayerAwardsGoldenGlove(goldenGloveHtmlFixture),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-awards-golden-glove",
        snapshotKey: "2026-04-18",
        parserVersion: "test",
      },
    });
    const defensePrize = normalizeAwards({
      rows: parseOfficialKoPlayerAwardsDefensePrize(defensePrizeHtmlFixture),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-awards-defense-prize",
        snapshotKey: "2026-04-18",
        parserVersion: "test",
      },
    });
    const seriesPrize = normalizeAwards({
      rows: parseOfficialKoPlayerAwardsSeriesPrize(seriesPrizeHtmlFixture),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "player-awards-series-prize",
        snapshotKey: "2026-04-18",
        parserVersion: "test",
      },
    });

    const merged = [mvpRookie, goldenGlove, defensePrize, seriesPrize].reduce(
      (current, next) => mergeNormalizedAwards(current, next),
      null as ReturnType<typeof normalizeAwards> | null,
    );

    expect(merged?.sources).toHaveLength(4);
    expect(merged?.awards).toHaveLength(15);
    expect(merged?.awards.some((item) => item.label === "골든글러브 외야수" && item.note.includes("구자욱"))).toBe(true);
    expect(merged?.awards.some((item) => item.label === "KBO 수비상 유격수" && item.note.includes("오지환"))).toBe(true);
    expect(merged?.awards.some((item) => item.label === "KBO 한국시리즈 MVP" && item.note.includes("김현수"))).toBe(true);
  });

  it("applies manual game patches without mutating raw normalized payloads", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizeScheduleToSeriesGames({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      rows: parseOfficialEnDailySchedule(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/daily-schedule.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-en",
        datasetId: "schedule-calendar",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const patched = applyManualPatchesToSeriesGames(normalized, {
      ...patches,
      gamePatches: [
        {
          gameId: normalized.games[0]?.gameId,
          status: "postponed",
          note: "Manual reschedule check",
        },
      ],
    });

    expect(normalized.games[0]?.status).toBe("final");
    expect(patched.games[0]?.status).toBe("postponed");
    expect(patched.games[0]?.note).toBe("Manual reschedule check");
  });

  it("normalizes official team hitter and pitcher records into team metrics", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const teamHitters = normalizeTeamHitterStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-ko",
      rows: parseOfficialKoTeamHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-hitter.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "team-hitter",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    const teamPitchers = normalizeTeamPitcherStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-ko",
      rows: parseOfficialKoTeamPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-pitcher.html"),
      ),
      bundle,
      patches,
      sourceRef: {
        sourceId: "official-kbo-ko",
        datasetId: "team-pitcher",
        snapshotKey: "2026-04-15",
        parserVersion: "test",
      },
    });

    expect(teamHitters.rows).toHaveLength(10);
    expect(teamHitters.rows.find((row) => row.seasonTeamId === "kbo-2026:kt")?.offensePlus).toBeGreaterThan(100);
    expect(teamPitchers.rows).toHaveLength(10);
    expect(teamPitchers.rows.find((row) => row.seasonTeamId === "kbo-2026:lg")?.pitchingPlus).toBeGreaterThan(100);
    expect(teamPitchers.rows.find((row) => row.seasonTeamId === "kbo-2026:lg")?.bullpenEra).toBe(3.67);
  });

  it("normalizes official player summary pages into player season stats", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizePlayerSeasonStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: parseOfficialEnPlayerSummaryHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-hitter-53123.html"),
      ),
      pitchers: parseOfficialEnPlayerSummaryPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-pitcher-61101.html"),
      ),
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      bundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-hitter",
          snapshotKey: "2026-04-15-53123",
          parserVersion: "test",
        },
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-pitcher",
          snapshotKey: "2026-04-15-61101",
          parserVersion: "test",
        },
      ],
    });

    expect(normalized.players).toHaveLength(2);
    expect(normalized.stats).toHaveLength(2);
    expect(normalized.players.find((item) => item.nameKo === "임찬규")?.playerId).toBe(
      "player:kbo-2026:kbo-2026:lg:임찬규",
    );
    expect(normalized.players.find((item) => item.nameKo === "임찬규")?.officialPlayerCode).toBe("61101");
    const hitterStat = normalized.stats.find((item) => item.statType === "hitter");
    const pitcherStat = normalized.stats.find((item) => item.statType === "pitcher");

    expect(hitterStat?.battingAverage).toBeCloseTo(0.382, 3);
    expect(hitterStat?.rbi).toBe(11);
    expect(hitterStat?.onBasePct).toBeCloseTo(0.462, 3);
    expect(hitterStat?.ops).toBeCloseTo(1.171, 3);
    expect(pitcherStat?.inningsPitched).toBeCloseTo(15, 4);
    expect(pitcherStat?.whip).toBeCloseTo(2, 2);
    expect(pitcherStat?.hitsAllowed).toBe(25);
    expect(pitcherStat?.playerId).toBe(
      "player:kbo-2026:kbo-2026:lg:임찬규",
    );
  });

  it("prefers Korean register names when an official-code player still has a romanized placeholder", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);
    const rewrittenBundle = {
      ...bundle,
      players: bundle.players.map((player) =>
        player.officialPlayerCode === "61101"
          ? {
              ...player,
              playerId: "player:official-kbo-en:61101",
              slug: "im-chan-kyu",
              nameKo: "IM Chan Kyu",
              nameEn: "IM Chan Kyu",
            }
          : player,
      ),
    };

    const normalized = normalizePlayerSeasonStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: [],
      pitchers: parseOfficialEnPlayerSummaryPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-pitcher-61101.html"),
      ),
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      searchRows: parseOfficialEnPlayerSearch(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-search.html"),
      ),
      bundle: rewrittenBundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-pitcher",
          snapshotKey: "2026-04-15-61101",
          parserVersion: "test",
        },
      ],
    });

    expect(
      normalized.players.find((player) => player.officialPlayerCode === "61101"),
    ).toMatchObject({
      playerId: "player:official-kbo-en:61101",
      nameKo: "임찬규",
      nameEn: "IM Chan Kyu",
    });
  });

  it("normalizes official player career rows into player history stats", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizePlayerCareerStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: parseOfficialEnPlayerSummaryHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-hitter-53123.html"),
      ),
      pitchers: parseOfficialEnPlayerSummaryPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-pitcher-61101.html"),
      ),
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      bundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-hitter",
          snapshotKey: "2026-04-15-53123",
          parserVersion: "test",
        },
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-pitcher",
          snapshotKey: "2026-04-15-61101",
          parserVersion: "test",
        },
      ],
    });

    expect(normalized.rows.length).toBeGreaterThan(10);
    expect(
      normalized.rows.some(
        (item) =>
          item.playerId === "player:kbo-2026:kbo-2026:lg:오스틴" &&
          item.year === 2026 &&
          item.teamLabel === "LG" &&
          item.hits === 21,
      ),
    ).toBe(true);
    expect(
      normalized.rows.some(
        (item) =>
          item.playerId === "player:kbo-2026:kbo-2026:lg:임찬규" &&
          item.year === 2024 &&
          item.wins === 10,
      ),
    ).toBe(true);
  });

  it("falls back to player search metadata when official summary team names are unavailable", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);
    const [hitterRow] = parseOfficialEnPlayerSummaryHitter(
      await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-hitter-53123.html"),
    );

    const normalized = normalizePlayerSeasonStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: [
        {
          ...hitterRow!,
          teamName: "No Data Available",
        },
      ],
      pitchers: [],
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      searchRows: [
        {
          teamName: "lg",
          playerName: hitterRow!.playerNameEn,
          pcode: hitterRow!.pcode,
          playerUrl: "/Teams/PlayerInfoHitter/Summary.aspx?pcode=53123",
          position: hitterRow!.position,
          backNumber: hitterRow!.backNumber,
          birthDate: hitterRow!.birthDate,
          heightWeight: null,
          statType: "hitter",
        },
      ],
      bundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-summary-hitter",
          snapshotKey: "2026-04-15-53123",
          parserVersion: "test",
        },
      ],
    });

    expect(normalized.players).toHaveLength(1);
    expect(normalized.stats).toHaveLength(1);
    expect(normalized.players[0]?.nameKo).toBe("오스틴");
    expect(normalized.stats[0]?.seasonTeamId).toBe("kbo-2026:lg");
  });

  it("normalizes official player game logs into player game stat rows", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizePlayerGameStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: parseOfficialEnPlayerGameLogsHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-game-logs-hitter-53123.html"),
      ),
      pitchers: parseOfficialEnPlayerGameLogsPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-game-logs-pitcher-61101.html"),
      ),
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      bundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-game-logs-hitter",
          snapshotKey: "2026-04-15-53123",
          parserVersion: "test",
        },
        {
          sourceId: "official-kbo-en",
          datasetId: "player-game-logs-pitcher",
          snapshotKey: "2026-04-15-61101",
          parserVersion: "test",
        },
      ],
    });

    expect(normalized.rows.length).toBeGreaterThan(1);
    expect(normalized.rows.some((item) => item.playerId === "player:kbo-2026:kbo-2026:lg:임찬규")).toBe(true);
    expect(
      normalized.rows.some(
        (item) => item.statType === "hitter" && item.atBats === 4 && item.hits === 1 && item.walks === 1,
      ),
    ).toBe(true);
    expect(
      normalized.rows.some(
        (item) => item.statType === "hitter" && item.rbi === 0,
      ),
    ).toBe(true);
    expect(
      normalized.rows.some(
        (item) =>
          item.statType === "pitcher" &&
          item.inningsPitched === 5 &&
          item.earnedRuns === 3 &&
          item.strikeouts === 3 &&
          item.walks === 1,
      ),
    ).toBe(true);
    expect(normalized.rows.every((item) => item.gameId.length > 0)).toBe(true);
  });

  it("normalizes official player month splits into player split stat rows", async () => {
    const repository = new FileKboRepository();
    const patchRepository = new FileKboIngestPatchRepository();
    const [bundle, season, patches] = await Promise.all([
      repository.getBundle(),
      repository.getCurrentSeason(),
      patchRepository.getManualSourcePatches(),
    ]);

    const normalized = normalizePlayerSplitStats({
      seasonId: season.seasonId,
      sourceId: "official-kbo-en",
      hitters: parseOfficialEnPlayerSplitsMonthHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-splits-month-hitter-53123.html"),
      ),
      pitchers: parseOfficialEnPlayerSplitsMonthPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-splits-month-pitcher-61101.html"),
      ),
      hitterSituations: parseOfficialEnPlayerSituationsHitter(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-hitter-53123.html"),
      ).concat(
        parseOfficialEnPlayerSituationsCountHitter(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-count-hitter-53123.html"),
        ),
        parseOfficialEnPlayerSituationsRunnerHitter(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-runner-hitter-53123.html"),
        ),
        parseOfficialEnPlayerSituationsOutHitter(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-out-hitter-53123.html"),
        ),
        parseOfficialEnPlayerSituationsInningHitter(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-inning-hitter-53123.html"),
        ),
        parseOfficialEnPlayerSituationsBattingOrderHitter(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-batting-order-hitter-53123.html"),
        ),
      ),
      pitcherSituations: parseOfficialEnPlayerSituationsPitcher(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-pitcher-61101.html"),
      ).concat(
        parseOfficialEnPlayerSituationsCountPitcher(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-count-pitcher-61101.html"),
        ),
        parseOfficialEnPlayerSituationsRunnerPitcher(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-runner-pitcher-61101.html"),
        ),
        parseOfficialEnPlayerSituationsOutPitcher(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-out-pitcher-61101.html"),
        ),
        parseOfficialEnPlayerSituationsInningPitcher(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-inning-pitcher-61101.html"),
        ),
        parseOfficialEnPlayerSituationsBattingOrderPitcher(
          await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-batting-order-pitcher-61101.html"),
        ),
      ),
      registerRows: parseOfficialKoRegisterAll(
        await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html"),
      ),
      bundle,
      patches,
      sourceRefs: [
        {
          sourceId: "official-kbo-en",
          datasetId: "player-splits-month-hitter",
          snapshotKey: "2026-04-15-53123",
          parserVersion: "test",
        },
        {
          sourceId: "official-kbo-en",
          datasetId: "player-splits-month-pitcher",
          snapshotKey: "2026-04-15-61101",
          parserVersion: "test",
        },
      ],
    });

    expect(normalized.rows.length).toBeGreaterThanOrEqual(40);
    expect(normalized.rows.some((item) => item.playerId === "player:kbo-2026:kbo-2026:lg:오스틴")).toBe(true);
    expect(normalized.rows.some((item) => item.playerId === "player:kbo-2026:kbo-2026:lg:임찬규")).toBe(true);
    expect(normalized.rows.some((item) => item.splitType === "month")).toBe(true);
    expect(normalized.rows.some((item) => item.splitType === "situation")).toBe(true);
  });
});
