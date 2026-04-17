import { describe, expect, it } from "vitest";

import { pickPreferredSource, resolveSourcePriority } from "@/lib/data-sources/kbo/merge/source-priority";
import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";

describe("KBO source priority", () => {
  it("prefers official Korean month schedule service and official English mirrors where they are cleaner", () => {
    expect(resolveSourcePriority("schedule-calendar", kboSourceRegistry)[0]?.sourceId).toBe("official-kbo-ko");
    expect(resolveSourcePriority("scoreboard", kboSourceRegistry)[0]?.sourceId).toBe("official-kbo-en");
    expect(resolveSourcePriority("standings", kboSourceRegistry)[0]?.sourceId).toBe("official-kbo-en");
  });

  it("falls back to Korean official when English is unavailable", () => {
    const preferred = pickPreferredSource("standings", kboSourceRegistry, ["official-kbo-ko"]);
    expect(preferred?.sourceId).toBe("official-kbo-ko");
  });

  it("keeps Statiz out of core baseline datasets", () => {
    const scheduleSources = resolveSourcePriority("schedule-calendar", kboSourceRegistry, false).map(
      (entry) => entry.sourceId,
    );
    expect(scheduleSources).not.toContain("statiz");
  });
});
