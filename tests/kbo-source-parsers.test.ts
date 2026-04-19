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
import { parseOfficialKoPlayerAwardsDefensePrize } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-defense-prize";
import { parseOfficialKoPlayerAwardsGoldenGlove } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-golden-glove";
import { parseOfficialKoPlayerAwardsMvpRookie } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-mvp-rookie";
import { parseOfficialKoPlayerAwardsSeriesPrize } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-series-prize";
import { parseOfficialKoPlayerProfile } from "@/lib/data-sources/kbo/adapters/official-ko/player-profile";
import { parseOfficialKoRegisterAll } from "@/lib/data-sources/kbo/adapters/official-ko/register-all";
import { parseOfficialKoTeamHitter } from "@/lib/data-sources/kbo/adapters/official-ko/team-hitter";
import { parseOfficialKoTeamHistory } from "@/lib/data-sources/kbo/adapters/official-ko/team-history";
import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";
import { parseOfficialKoTrade } from "@/lib/data-sources/kbo/adapters/official-ko/trade";

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

const playerProfileHtmlFixture = `
  <div id="contents">
    <h4 class="player-team"><span class="emb"><img src="/emblem_SS.png" /></span>삼성 라이온즈</h4>
    <div class="player_basic">
      <div class="photo"><img src="/62404.jpg" alt="구자욱" /></div>
      <ul>
        <li class="odd"><strong>선수명: </strong><span>구자욱</span></li>
        <li><strong>등번호: </strong>No.<span>5</span></li>
        <li class="odd"><strong>생년월일: </strong><span>1993년 02월 12일</span></li>
        <li><strong>포지션: </strong><span>외야수(우투좌타)</span></li>
        <li class="odd"><strong>신장/체중: </strong><span>189cm/75kg</span></li>
        <li><strong>경력: </strong><span>본리초-경복중-대구고-삼성-상무</span></li>
        <li class="odd"><strong>지명순위: </strong><span>12 삼성 2라운드 12순위</span></li>
        <li><strong>입단년도: </strong><span>12삼성</span></li>
      </ul>
    </div>
  </div>
`;

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
      battingAverage: 0.382,
      hits: 21,
      homeRuns: 5,
      rbi: 11,
      onBasePct: 0.462,
    });
    expect(rows[0]?.ops).toBeCloseTo(1.171, 3);
    expect(rows[0]?.careerStats.length).toBeGreaterThan(1);
    expect(
      rows[0]?.careerStats.some(
        (item) => item.year === 2026 && item.teamName === "LG" && item.hits === 21 && item.homeRuns === 5,
      ),
    ).toBe(true);
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
      hitsAllowed: 11,
      walks: 4,
      whip: 0.98,
      opponentAvg: 0.196,
    });
    expect(rows[0]?.inningsPitched).toBeCloseTo(15 + 1 / 3, 4);
    expect(rows[0]?.careerStats.length).toBeGreaterThan(1);
    expect(
      rows[0]?.careerStats.some(
        (item) => item.year === 2025 && item.teamName === "LG" && item.wins === 11 && item.strikeouts === 125,
      ),
    ).toBe(true);
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

  it("parses official Korean MVP and rookie award pages", () => {
    const rows = parseOfficialKoPlayerAwardsMvpRookie(awardsHtmlFixture);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      year: 2025,
      awardLabel: "KBO MVP",
      playerName: "폰세",
      teamName: "한화",
      position: "투수",
    });
    expect(rows[1]).toMatchObject({
      year: 2025,
      awardLabel: "KBO 신인상",
      playerName: "안현민",
      teamName: "KT",
      position: "외야수",
    });
  });

  it("parses official Korean golden glove award pages", () => {
    const rows = parseOfficialKoPlayerAwardsGoldenGlove(goldenGloveHtmlFixture);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      year: 2025,
      awardLabel: "골든글러브 투수",
      playerName: "폰세",
      teamName: "한화",
      position: "투수",
    });
    expect(rows.filter((row) => row.awardLabel === "골든글러브 외야수")).toHaveLength(3);
  });

  it("parses official Korean defense prize award pages", () => {
    const rows = parseOfficialKoPlayerAwardsDefensePrize(defensePrizeHtmlFixture);

    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.awardLabel === "KBO 수비상 유격수")).toHaveLength(2);
    expect(rows.some((row) => row.playerName === "오지환" && row.teamName === "LG")).toBe(true);
  });

  it("parses official Korean series prize award pages", () => {
    const rows = parseOfficialKoPlayerAwardsSeriesPrize(seriesPrizeHtmlFixture);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      year: 2025,
      awardLabel: "KBO 올스타전 MVP",
      playerName: "박동원",
      teamName: "LG",
      position: "포수",
    });
    expect(rows.some((row) => row.awardLabel === "KBO 한국시리즈 MVP" && row.playerName === "박경수")).toBe(true);
    expect(rows.some((row) => row.playerName === "-")).toBe(false);
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

  it("parses Korean player basic profile blocks", () => {
    const row = parseOfficialKoPlayerProfile(playerProfileHtmlFixture, {
      pcode: "62404",
      statType: "hitter",
    });

    expect(row).toMatchObject({
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
    });
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
