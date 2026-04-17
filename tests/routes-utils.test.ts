import { describe, expect, it } from "vitest";

import {
  buildGameRoute,
  buildPlayerRoute,
  buildScenarioRoute,
  buildSeasonTeamRoute,
  buildTeamArchiveRoute,
  decodeRouteEntityParam,
  decodeRouteSegmentParam,
  normalizeTeamSlug,
} from "@/lib/utils/routes";

describe("route utils", () => {
  it("builds encoded player and game routes for entity ids with colons and Korean text", () => {
    expect(buildPlayerRoute("player:kbo-2026:kbo-2026:lg:오스틴")).toBe(
      "/players/player%3Akbo-2026%3Akbo-2026%3Alg%3A%EC%98%A4%EC%8A%A4%ED%8B%B4",
    );
    expect(buildGameRoute("game:official-kbo-ko:20260328KTLG0")).toBe(
      "/games/game%3Aofficial-kbo-ko%3A20260328KTLG0",
    );
    expect(buildSeasonTeamRoute(2026, "ssg-랜더스")).toBe(
      "/season/2026/teams/ssg-landers",
    );
    expect(buildTeamArchiveRoute("키움-히어로즈")).toBe(
      "/teams/kiwoom-heroes",
    );
    expect(buildScenarioRoute(2026, { mode: "team", teamSlug: "키움-히어로즈" })).toBe(
      "/season/2026/scenario?mode=team&team=kiwoom-heroes",
    );
    expect(
      buildScenarioRoute(2026, {
        mode: "race",
        raceFilter: "fifth",
        target: "postseason",
        teamSlug: "ssg-랜더스",
        shareToken: "abc_123",
      }),
    ).toBe(
      "/season/2026/scenario?mode=race&race=fifth&target=postseason&team=ssg-landers&share=abc_123",
    );
  });

  it("decodes encoded route params back to repository ids", () => {
    expect(
      decodeRouteEntityParam("player%3Akbo-2026%3Akbo-2026%3Alg%3A%EC%98%A4%EC%8A%A4%ED%8B%B4"),
    ).toBe("player:kbo-2026:kbo-2026:lg:오스틴");
    expect(
      decodeRouteSegmentParam("%ED%82%A4%EC%9B%80-%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88"),
    ).toBe("kiwoom-heroes");
    expect(normalizeTeamSlug("ssg-랜더스")).toBe("ssg-landers");
  });
});
