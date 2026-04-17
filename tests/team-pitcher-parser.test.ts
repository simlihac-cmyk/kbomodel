import { describe, expect, it } from "vitest";

import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";

describe("parseOfficialKoTeamPitcher", () => {
  it("parses the newer 18-column team pitcher table layout", () => {
    const html = `
      <div class="record_result">
        <table class="tData">
          <tbody>
            <tr>
              <td>1</td>
              <td>한화</td>
              <td>3.55</td>
              <td>144</td>
              <td>83</td>
              <td>57</td>
              <td>41</td>
              <td>57</td>
              <td>0.593</td>
              <td>1290 1/3</td>
              <td>1185</td>
              <td>102</td>
              <td>450</td>
              <td>93</td>
              <td>1339</td>
              <td>554</td>
              <td>509</td>
              <td>1.27</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    expect(parseOfficialKoTeamPitcher(html)).toEqual([
      {
        rank: 1,
        teamName: "한화",
        era: 3.55,
        games: 144,
        completeGames: 0,
        shutouts: 0,
        wins: 83,
        losses: 57,
        saves: 41,
        holds: 57,
        winPct: 0.593,
        battersFaced: 0,
        inningsPitched: 1290 + 1 / 3,
        hitsAllowed: 1185,
        homeRunsAllowed: 102,
        walks: 450,
        hitByPitch: 93,
        strikeouts: 1339,
        runsAllowed: 554,
        earnedRuns: 509,
      },
    ]);
  });
});
