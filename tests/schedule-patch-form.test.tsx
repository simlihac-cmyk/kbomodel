import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SchedulePatchForm } from "@/components/admin/schedule-patch-form";
import type { Game, TeamDisplay } from "@/lib/domain/kbo/types";

const teamDisplays: TeamDisplay[] = [
  {
    seasonTeamId: "season:doo",
    franchiseId: "franchise:doo",
    brandId: "brand:doo",
    teamSlug: "doosan-bears",
    displayNameKo: "두산 베어스",
    shortNameKo: "두산",
    shortCode: "DOO",
    primaryColor: "#131230",
    secondaryColor: "#ffffff",
  },
  {
    seasonTeamId: "season:ssg",
    franchiseId: "franchise:ssg",
    brandId: "brand:ssg",
    teamSlug: "ssg-landers",
    displayNameKo: "SSG 랜더스",
    shortNameKo: "SSG",
    shortCode: "SSG",
    primaryColor: "#ce0e2d",
    secondaryColor: "#ffffff",
  },
];

const games: Game[] = [
  {
    gameId: "game:earlier",
    seasonId: "season:2026",
    seriesId: "series:earlier",
    scheduledAt: "2026-09-05T08:00:00.000Z",
    originalScheduledAt: "2026-09-05T08:00:00.000Z",
    rescheduledFromGameId: null,
    homeSeasonTeamId: "season:ssg",
    awaySeasonTeamId: "season:doo",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    innings: null,
    isTie: false,
    note: null,
    attendance: null,
    externalLinks: [],
  },
  {
    gameId: "game:patched",
    seasonId: "season:2026",
    seriesId: "series:patched",
    scheduledAt: "2026-09-06T08:00:00.000Z",
    originalScheduledAt: "2026-09-06T08:00:00.000Z",
    rescheduledFromGameId: null,
    homeSeasonTeamId: "season:ssg",
    awaySeasonTeamId: "season:doo",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    innings: null,
    isTie: false,
    note: "QA temporary note",
    attendance: null,
    externalLinks: [],
  },
];

describe("SchedulePatchForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates the most recently patched game and its datetime input", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SchedulePatchForm
        games={games}
        teamDisplays={teamDisplays}
        initialGameId="game:patched"
        action={async () => {}}
      />,
    );

    const gameSelect = document.querySelector('select[name="gameId"]') as HTMLSelectElement | null;
    expect(gameSelect?.value).toBe("game:patched");
    expect(screen.getByDisplayValue("2026-09-06T17:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("QA temporary note")).toBeInTheDocument();
  });
});
