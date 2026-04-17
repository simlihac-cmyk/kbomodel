import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardStandingsBoard } from "@/components/dashboard/dashboard-standings-board";
import { TodayWinProbabilityBoard } from "@/components/dashboard/today-win-probability-board";
import { SharedScenarioSpotlight } from "@/components/scenario/shared-scenario-spotlight";
import { SectionCard } from "@/components/shared/section-card";
import { StandingsTable } from "@/components/standings/standings-table";
import type { Game, GameProbabilitySnapshot, StandingRow, TeamDisplay } from "@/lib/domain/kbo/types";

describe("UI smoke", () => {
  it("renders shared card and standings table", () => {
    const rows: StandingRow[] = [
      {
        seasonTeamId: "season:a",
        brandId: "a",
        franchiseId: "a",
        teamSlug: "a",
        displayNameKo: "A",
        shortNameKo: "A",
        shortCode: "AAA",
        primaryColor: "#111827",
        secondaryColor: "#ffffff",
        rank: 1,
        games: 10,
        wins: 7,
        losses: 3,
        ties: 0,
        pct: 0.7,
        gamesBack: 0,
        recent10: "7-3",
        streak: "승2",
        home: "4-1",
        away: "3-2",
        runsScored: 45,
        runsAllowed: 33,
        offensePlus: 106,
        pitchingPlus: 103,
        bucketOdds: {
          seasonTeamId: "season:a",
          first: 0.42,
          second: 0.22,
          third: 0.14,
          fourth: 0.08,
          fifth: 0.05,
          missPostseason: 0.09,
        },
        postseasonOdds: {
          seasonTeamId: "season:a",
          wildcard: 0.09,
          semipo: 0.19,
          po: 0.24,
          ks: 0.31,
          champion: 0.18,
        },
      },
    ];

    render(
      <SectionCard title="테스트 카드">
        <StandingsTable year={2026} rows={rows} />
      </SectionCard>,
    );

    expect(screen.getByText("테스트 카드")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("42.0%")).toBeInTheDocument();
  });

  it("renders dashboard win probability cards and standings board", () => {
    const rows: StandingRow[] = [
      {
        seasonTeamId: "season:lg",
        brandId: "lg",
        franchiseId: "lg",
        teamSlug: "lg-twins",
        displayNameKo: "LG 트윈스",
        shortNameKo: "LG",
        shortCode: "LG",
        primaryColor: "#9d174d",
        secondaryColor: "#ffffff",
        rank: 1,
        games: 18,
        wins: 12,
        losses: 6,
        ties: 0,
        pct: 0.667,
        gamesBack: 0,
        recent10: "7-3",
        streak: "승2",
        home: "6-2",
        away: "6-4",
        runsScored: 81,
        runsAllowed: 62,
        offensePlus: 108,
        pitchingPlus: 104,
        bucketOdds: {
          seasonTeamId: "season:lg",
          first: 0.42,
          second: 0.23,
          third: 0.14,
          fourth: 0.08,
          fifth: 0.05,
          missPostseason: 0.08,
        },
        postseasonOdds: {
          seasonTeamId: "season:lg",
          wildcard: 0.09,
          semipo: 0.19,
          po: 0.24,
          ks: 0.31,
          champion: 0.18,
        },
      },
    ];

    const displayById: Record<string, TeamDisplay> = {
      "season:lg": {
        seasonTeamId: "season:lg",
        brandId: "lg",
        franchiseId: "lg",
        teamSlug: "lg-twins",
        displayNameKo: "LG 트윈스",
        shortNameKo: "LG",
        shortCode: "LG",
        primaryColor: "#9d174d",
        secondaryColor: "#ffffff",
      },
      "season:ssg": {
        seasonTeamId: "season:ssg",
        brandId: "ssg",
        franchiseId: "ssg",
        teamSlug: "ssg-landers",
        displayNameKo: "SSG 랜더스",
        shortNameKo: "SSG",
        shortCode: "SSG",
        primaryColor: "#b91c1c",
        secondaryColor: "#ffffff",
      },
    };

    const games: Game[] = [
      {
        gameId: "game:1",
        seasonId: "kbo-2026",
        seriesId: "series:1",
        homeSeasonTeamId: "season:lg",
        awaySeasonTeamId: "season:ssg",
        scheduledAt: "2026-04-17T09:30:00.000Z",
        status: "scheduled",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore: null,
        awayScore: null,
        innings: null,
        isTie: false,
        note: null,
        attendance: null,
        externalLinks: [],
      },
    ];

    const probabilitiesById: Record<string, GameProbabilitySnapshot> = {
      "game:1": {
        gameId: "game:1",
        homeSeasonTeamId: "season:lg",
        awaySeasonTeamId: "season:ssg",
        homeLikelyStarterId: null,
        awayLikelyStarterId: null,
        homeWinProb: 0.56,
        awayWinProb: 0.39,
        tieProb: 0.05,
        pickFavoriteSide: "home",
        pickConfidenceScore: 0.66,
        pickConfidenceLevel: "pick",
        expectedRunsHome: 5.1,
        expectedRunsAway: 4.3,
        starterAdjustmentApplied: false,
        explanationReasons: [],
      },
    };

    render(
      <div>
        <TodayWinProbabilityBoard games={games} probabilitiesById={probabilitiesById} displayById={displayById} />
        <DashboardStandingsBoard year={2026} rows={rows} />
      </div>,
    );

    expect(screen.getAllByText("LG 트윈스").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SSG 랜더스").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("LG 픽")).toBeInTheDocument();
    expect(screen.getByText("5강권")).toBeInTheDocument();
  });

  it("renders archive standings without team links when requested", () => {
    const rows: StandingRow[] = [
      {
        seasonTeamId: "season:kia",
        brandId: "kia",
        franchiseId: "kia",
        teamSlug: "kia",
        displayNameKo: "KIA 타이거즈",
        shortNameKo: "KIA",
        shortCode: "KIA",
        primaryColor: "#ea0029",
        secondaryColor: "#111111",
        rank: 1,
        games: 144,
        wins: 87,
        losses: 56,
        ties: 1,
        pct: 0.608,
        gamesBack: 0,
        recent10: "-",
        streak: "-",
        home: "-",
        away: "-",
        runsScored: 0,
        runsAllowed: 0,
        offensePlus: 100,
        pitchingPlus: 100,
      },
    ];

    render(<StandingsTable year={2017} rows={rows} linkTeams={false} />);

    expect(screen.getAllByText("KIA").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "KIA" })).not.toBeInTheDocument();
  });

  it("renders shared scenario spotlight", () => {
    render(
      <SharedScenarioSpotlight
        scenarioName="LG 5강 시나리오"
        teamLabel="LG"
        targetLabel="5강 진출"
        currentProbabilityLabel="64.2%"
        currentProbabilityTone="positive"
        baselineDeltaLabel="+8.1%p"
        baselineDeltaTone="positive"
        expectedOutlookLabel="평균 3.1위 · 78-64-2"
        leverageLabel="두산 @ LG · +12.4%p"
        modeLabel="빠른 모드"
        raceFilterLabel={null}
        overrideCount={4}
        shareLinkState="idle"
        onCopyShareLink={() => {}}
      />,
    );

    expect(screen.getByText("LG 5강 진출 공유 뷰")).toBeInTheDocument();
    expect(screen.getAllByText("LG 5강 시나리오")).toHaveLength(2);
    expect(screen.getByText("결과 카드 보기")).toBeInTheDocument();
    expect(screen.getByText("64.2%")).toBeInTheDocument();
  });
});
