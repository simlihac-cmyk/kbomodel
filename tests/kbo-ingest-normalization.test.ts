import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseOfficialEnDailySchedule } from "@/lib/data-sources/kbo/adapters/official-en/daily-schedule";
import { parseOfficialEnPlayerGameLogsHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-hitter";
import { parseOfficialEnPlayerGameLogsPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-game-logs-pitcher";
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
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { parseOfficialKoRules } from "@/lib/data-sources/kbo/adapters/official-ko/rules";
import { parseOfficialKoTeamHitter } from "@/lib/data-sources/kbo/adapters/official-ko/team-hitter";
import { parseOfficialKoTeamHistory } from "@/lib/data-sources/kbo/adapters/official-ko/team-history";
import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";
import { parseOfficialKoTrade } from "@/lib/data-sources/kbo/adapters/official-ko/trade";
import { applyManualPatchesToSeriesGames } from "@/lib/data-sources/kbo/merge/apply-manual-patches";
import { normalizeFranchiseHistory } from "@/lib/data-sources/kbo/normalize/franchise-history";
import { normalizePlayerDirectory } from "@/lib/data-sources/kbo/normalize/player-directory";
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

    expect(players.players.length).toBeGreaterThan(2);
    expect(players.players.some((player) => player.nameKo === "임찬규")).toBe(true);
    expect(players.players.find((player) => player.nameKo === "오지환")?.primaryPositions).toEqual(["IF"]);
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
    expect(normalized.stats.find((item) => item.statType === "hitter")?.ops).toBeCloseTo(1.171, 3);
    expect(normalized.stats.find((item) => item.statType === "pitcher")?.inningsPitched).toBeCloseTo(15, 4);
    expect(normalized.stats.find((item) => item.statType === "pitcher")?.playerId).toBe(
      "player:kbo-2026:kbo-2026:lg:임찬규",
    );
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
