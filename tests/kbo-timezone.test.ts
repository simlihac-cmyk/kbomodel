import { describe, expect, it } from "vitest";

import {
  formatDateOnlyLabel,
  formatDateTimeInputValue,
  formatDateTimeLabel,
  parseDateTimeInputValue,
} from "@/lib/utils/format";
import { getKboDateKey, isAfterNightlyWindow, isWeeklyColdSyncWindow } from "@/lib/scheduler/kbo/windows";

describe("KBO timezone helpers", () => {
  it("keeps the KST calendar date across midnight instead of slicing UTC ISO strings", () => {
    expect(getKboDateKey(new Date("2026-04-16T00:30:00+09:00"))).toBe("2026-04-16");
    expect(getKboDateKey(new Date("2026-04-16T23:55:00+09:00"))).toBe("2026-04-16");
  });

  it("treats nightly and weekly windows as after-threshold windows instead of exact-minute matches", () => {
    expect(isAfterNightlyWindow(new Date("2026-04-16T00:16:00+09:00"))).toBe(false);
    expect(isAfterNightlyWindow(new Date("2026-04-16T00:17:00+09:00"))).toBe(true);
    expect(isAfterNightlyWindow(new Date("2026-04-16T01:05:00+09:00"))).toBe(true);

    expect(isWeeklyColdSyncWindow(new Date("2026-04-20T04:10:00+09:00"))).toBe(false);
    expect(isWeeklyColdSyncWindow(new Date("2026-04-20T04:11:00+09:00"))).toBe(true);
    expect(isWeeklyColdSyncWindow(new Date("2026-04-20T05:00:00+09:00"))).toBe(true);
  });

  it("formats UI dates in KST instead of relying on the server locale timezone", () => {
    expect(formatDateTimeInputValue("2026-04-15T00:05:00Z")).toBe("2026-04-15T09:05");
    expect(parseDateTimeInputValue("2026-04-15T18:30")).toBe("2026-04-15T09:30:00.000Z");
    expect(formatDateOnlyLabel("2026-04-15T15:30:00Z")).toContain("4. 16.");
    expect(formatDateTimeLabel("2026-04-15T15:30:00Z")).toContain("4. 16.");
  });
});
