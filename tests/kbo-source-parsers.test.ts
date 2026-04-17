import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseOfficialEnBattingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/batting-top5";
import { parseOfficialEnDailySchedule } from "@/lib/data-sources/kbo/adapters/official-en/daily-schedule";
import { parseOfficialEnPlayerSearch } from "@/lib/data-sources/kbo/adapters/official-en/player-search";
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
import { parseOfficialEnPitchingTop5 } from "@/lib/data-sources/kbo/adapters/official-en/pitching-top5";
import { parseOfficialEnPlayerSummaryHitter } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-hitter";
import { parseOfficialEnPlayerSummaryPitcher } from "@/lib/data-sources/kbo/adapters/official-en/player-summary-pitcher";
import { parseOfficialEnScoreboard } from "@/lib/data-sources/kbo/adapters/official-en/scoreboard";
import { parseOfficialEnStandings } from "@/lib/data-sources/kbo/adapters/official-en/standings";
import { parseOfficialKoHistoricalTeamRecord } from "@/lib/data-sources/kbo/adapters/official-ko/historical-team-record";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { parseOfficialKoTeamHitter } from "@/lib/data-sources/kbo/adapters/official-ko/team-hitter";
import { parseOfficialKoTeamHistory } from "@/lib/data-sources/kbo/adapters/official-ko/team-history";
import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";
import { parseOfficialKoTrade } from "@/lib/data-sources/kbo/adapters/official-ko/trade";

async function readFixture(relativePath: string) {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("KBO source parsers", () => {
  it("parses the official English daily schedule fixture", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/daily-schedule.html");
    const rows = parseOfficialEnDailySchedule(html);

    expect(rows).toHaveLength(130);
    expect(rows[0]?.homeTeamName).toBe("LG");
    expect(rows[0]?.awayTeamName).toBe("KIA");
    expect(rows[0]?.status).toBe("final");
    expect(rows.at(-1)?.status).toBe("scheduled");
  });

  it("parses the official English scoreboard fixture for scheduled games", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/scoreboard.html");
    const rows = parseOfficialEnScoreboard(html);

    expect(rows).toHaveLength(5);
    expect(rows[0]?.status).toBe("scheduled");
    expect(rows[0]?.venueName).toBe("JAMSIL");
    expect(rows[0]?.lineScore).toHaveLength(0);
  });

  it("parses the official English standings fixture", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/standings.html");
    const rows = parseOfficialEnStandings(html);

    expect(rows).toHaveLength(10);
    expect(rows[0]?.teamName).toBe("LG");
    expect(rows[0]?.wins).toBe(10);
    expect(rows[9]?.teamName).toBe("KIWOOM");
  });

  it("parses the official English scoreboard fixture for final games", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/scoreboard-final-2026-04-01.html");
    const rows = parseOfficialEnScoreboard(html);

    expect(rows).toHaveLength(5);
    expect(rows[0]?.status).toBe("final");
    expect(rows[0]?.lineScore).toHaveLength(9);
    expect(rows[0]?.winningPitcherName).toBe("KIM Jin Sung");
  });

  it("parses official English batting top5 cards", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/batting-top5.html");
    const rows = parseOfficialEnBattingTop5(html);

    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]).toMatchObject({
      statType: "hitter",
      categoryLabel: "TOP 5 AVERAGE",
      pcode: "67893",
      playerNameEn: "PARK Seong Han",
      teamName: "SSG",
    });
  });

  it("parses official English pitching top5 cards", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/pitching-top5.html");
    const rows = parseOfficialEnPitchingTop5(html);

    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]).toMatchObject({
      statType: "pitcher",
      categoryLabel: "TOP 5 ERA",
      pcode: "56036",
      playerNameEn: "BOUSHLEY Caleb",
      teamName: "KT",
    });
  });

  it("parses official English hitter summary pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-hitter-53123.html");
    const rows = parseOfficialEnPlayerSummaryHitter(html);

    expect(rows[0]).toMatchObject({
      pcode: "53123",
      teamName: "LG",
      playerNameEn: "DEAN Austin",
      games: 14,
      hits: 21,
      homeRuns: 5,
    });
    expect(rows[0]?.ops).toBeCloseTo(1.171, 3);
  });

  it("parses official English player search rows", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-search.html");
    const rows = parseOfficialEnPlayerSearch(html);

    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]).toMatchObject({
      teamName: "lg",
      playerName: "BAE Jae June",
      pcode: "63145",
      position: "Pitcher",
      statType: "pitcher",
    });
  });

  it("parses official English pitcher summary pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-summary-pitcher-51111.html");
    const rows = parseOfficialEnPlayerSummaryPitcher(html);

    expect(rows[0]).toMatchObject({
      pcode: "51111",
      teamName: "LG",
      playerNameEn: "SONG Seung Ki",
      games: 3,
      wins: 1,
      strikeouts: 13,
    });
    expect(rows[0]?.inningsPitched).toBeCloseTo(15 + 1 / 3, 4);
  });

  it("parses official English hitter game logs pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-game-logs-hitter-53123.html");
    const rows = parseOfficialEnPlayerGameLogsHitter(html);

    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      teamName: "LG",
      playerNameEn: "DEAN Austin",
      opponentTeamName: "KT",
      atBats: 5,
      hits: 3,
    });
  });

  it("parses official English pitcher game logs pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-game-logs-pitcher-61101.html");
    const rows = parseOfficialEnPlayerGameLogsPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      teamName: "LG",
      playerNameEn: "IM Chan Kyu",
      opponentTeamName: "KT",
      plateAppearances: 21,
      inningsPitched: 5,
    });
  });

  it("parses official English hitter month split pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-splits-month-hitter-53123.html");
    const rows = parseOfficialEnPlayerSplitsMonthHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      teamName: "LG",
      playerNameEn: "DEAN Austin",
      monthKey: "MAR",
      games: 3,
      hits: 6,
    });
  });

  it("parses official English pitcher month split pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-splits-month-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSplitsMonthPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      teamName: "LG",
      playerNameEn: "IM Chan Kyu",
      monthKey: "MAR",
      games: 1,
      inningsPitched: 5,
    });
  });

  it("parses official English hitter situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      teamName: "LG",
      playerNameEn: "DEAN Austin",
      situationKey: "vs LEFTY",
      hits: 3,
    });
  });

  it("parses official English pitcher situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      teamName: "LG",
      playerNameEn: "IM Chan Kyu",
      situationKey: "vs LEFTY",
      hitsAllowed: 11,
    });
  });

  it("parses official English hitter count situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-count-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsCountHitter(html);

    expect(rows.length).toBeGreaterThan(5);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      situationKey: "0-0",
      hits: 3,
    });
  });

  it("parses official English pitcher count situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-count-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsCountPitcher(html);

    expect(rows.length).toBeGreaterThan(5);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      situationKey: "0-0",
      hitsAllowed: 4,
    });
  });

  it("parses official English hitter runner situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-runner-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsRunnerHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      situationKey: "BASES EMPTY",
      hits: 13,
    });
  });

  it("parses official English pitcher runner situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-runner-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsRunnerPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      situationKey: "BASES EMPTY",
      hitsAllowed: 10,
    });
  });

  it("parses official English hitter out situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-out-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsOutHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      situationKey: "NO OUT",
    });
  });

  it("parses official English pitcher out situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-out-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsOutPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      situationKey: "NO OUT",
    });
  });

  it("parses official English hitter inning situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-inning-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsInningHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({
      pcode: "53123",
      situationKey: "1st INNING",
    });
  });

  it("parses official English pitcher inning situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-inning-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsInningPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatchObject({
      pcode: "61101",
      situationKey: "1st INNING",
    });
  });

  it("parses official English hitter batting-order situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-batting-order-hitter-53123.html");
    const rows = parseOfficialEnPlayerSituationsBattingOrderHitter(html);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((row) => row.situationKey === "BATTING #1-3")).toBe(true);
  });

  it("parses official English pitcher batting-order situation pages", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-en/player-situations-batting-order-pitcher-61101.html");
    const rows = parseOfficialEnPlayerSituationsBattingOrderPitcher(html);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((row) => row.situationKey === "BATTING #1")).toBe(true);
  });

  it("parses Korean roster movement rows into typed transaction events", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/trade.html");
    const rows = parseOfficialKoTrade(html);

    expect(rows).toHaveLength(3);
    expect(rows[0]?.eventType).toBe("activated");
    expect(rows[1]?.eventType).toBe("injured");
    expect(rows[2]?.eventType).toBe("transferred");
  });

  it("parses Korean register-all tables into roster directory rows", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/register-all.html");
    const rows = parseOfficialKoRegisterAll(html);
    const firstPitcher = rows.find((row) => row.position === "투수");
    const imChanGyu = rows.find((row) => row.playerName === "임찬규");

    expect(rows.length).toBeGreaterThan(4);
    expect(rows[0]?.teamName).toBe("LG");
    expect(firstPitcher?.position).toBe("투수");
    expect(imChanGyu?.position).toBe("투수");
  });

  it("parses Korean franchise history with nested brand history", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-history.html");
    const rows = parseOfficialKoTeamHistory(html);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.franchiseId).toBe("heroes");
    expect(rows[0]?.brands).toHaveLength(2);
    expect(rows[1]?.brands[0]?.displayNameKo).toBe("SK 와이번스");
  });

  it("parses Korean historical team record tables", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/historical-team-record-live.html");
    const rows = parseOfficialKoHistoricalTeamRecord(html);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      year: 2024,
      teamName: "KIA 타이거즈",
      rank: 1,
      wins: 87,
      losses: 55,
      ties: 2,
    });
  });

  it("parses Korean team hitter records", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-hitter.html");
    const rows = parseOfficialKoTeamHitter(html);

    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({
      rank: 1,
      teamName: "KT",
      avg: 0.287,
      runs: 93,
    });
  });

  it("parses Korean team pitcher records", async () => {
    const html = await readFixture("src/lib/data-sources/kbo/fixtures/official-ko/team-pitcher.html");
    const rows = parseOfficialKoTeamPitcher(html);

    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({
      rank: 1,
      teamName: "LG",
      era: 3.67,
      wins: 10,
    });
    expect(rows[3]?.inningsPitched).toBeCloseTo(122 + 1 / 3, 4);
  });
});
