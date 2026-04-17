import { describe, expect, it } from "vitest";

import { collectKboPublicRevalidationPaths } from "@/lib/server/revalidate-kbo-paths";

describe("collectKboPublicRevalidationPaths", () => {
  it("includes season, team archive, season team, and game detail paths without duplicates", () => {
    const paths = collectKboPublicRevalidationPaths({
      years: [2026, 2026],
      teamSlugs: ["ssg-랜더스", "ssg-landers"],
      gameIds: ["game:official-kbo-ko:20260328KTLG0"],
      includeArchiveHub: false,
    });

    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/season/2026",
        "/season/2026/race",
        "/season/2026/scenario",
        "/season/2026/records",
        "/season/2026/postseason",
        "/archive/2026",
        "/teams/ssg-landers",
        "/season/2026/teams/ssg-landers",
        "/games/game%3Aofficial-kbo-ko%3A20260328KTLG0",
      ]),
    );
    expect(paths).not.toContain("/archive");
    expect(paths.filter((path) => path === "/teams/ssg-landers")).toHaveLength(1);
  });
});
