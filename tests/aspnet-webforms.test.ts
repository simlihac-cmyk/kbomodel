import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildAspNetPostbackForm,
  getSelectedAspNetSelectValue,
} from "@/lib/data-sources/kbo/fetch/aspnet-webforms";

const TEAM_STATS_SEASON_FIELD =
  "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ddlSeason$ddlSeason";

describe("aspnet webform helpers", () => {
  it("builds a postback form that preserves hidden fields and overrides season selection", async () => {
    const html = await readFile(
      "src/lib/data-sources/kbo/fixtures/official-ko/team-hitter.html",
      "utf8",
    );

    const form = buildAspNetPostbackForm(html, TEAM_STATS_SEASON_FIELD, {
      [TEAM_STATS_SEASON_FIELD]: "2024",
    });

    expect(form.get("__VIEWSTATE")).toBeTruthy();
    expect(form.get("__EVENTVALIDATION")).toBeTruthy();
    expect(form.get("__EVENTTARGET")).toBe(TEAM_STATS_SEASON_FIELD);
    expect(form.get(TEAM_STATS_SEASON_FIELD)).toBe("2024");
  });

  it("reads the selected season from an ASP.NET select", async () => {
    const html = await readFile(
      "src/lib/data-sources/kbo/fixtures/official-ko/team-pitcher.html",
      "utf8",
    );

    expect(getSelectedAspNetSelectValue(html, TEAM_STATS_SEASON_FIELD)).toBe("2026");
  });
});
