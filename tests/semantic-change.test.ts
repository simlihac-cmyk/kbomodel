import { describe, expect, it } from "vitest";

import { detectSemanticChange, hashSemanticPayload } from "@/lib/scheduler/kbo/semantic-change";

describe("semantic change detection", () => {
  it("ignores object key order differences", () => {
    const left = { b: 2, a: 1 };
    const right = { a: 1, b: 2 };

    expect(hashSemanticPayload(left)).toBe(hashSemanticPayload(right));
    expect(detectSemanticChange(left, right).changed).toBe(false);
  });

  it("detects score changes as semantic changes", () => {
    const previous = { gameId: "g1", homeScore: 3, awayScore: 2 };
    const next = { gameId: "g1", homeScore: 4, awayScore: 2 };

    expect(detectSemanticChange(previous, next).changed).toBe(true);
  });
});
