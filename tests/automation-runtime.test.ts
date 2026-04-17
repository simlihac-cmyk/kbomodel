import { beforeEach, describe, expect, it, vi } from "vitest";

const getBundle = vi.fn();
const refreshCurrentLiveBundle = vi.fn();

vi.mock("@/lib/repositories/kbo", () => ({
  kboRepository: {
    getBundle,
  },
}));

vi.mock("@/lib/data-sources/kbo/pipeline/refresh-current", () => ({
  refreshCurrentLiveBundle,
}));

describe("automation runtime bundle bootstrap", () => {
  beforeEach(() => {
    getBundle.mockReset();
    refreshCurrentLiveBundle.mockReset();
  });

  it("returns the current bundle immediately when published data already exists", async () => {
    const bundle = { seasons: [], games: [] };
    getBundle.mockResolvedValue(bundle);

    const { loadCurrentBundleForAutomation } = await import(
      "@/lib/scheduler/kbo/runtime"
    );

    await expect(loadCurrentBundleForAutomation()).resolves.toBe(bundle);
    expect(refreshCurrentLiveBundle).not.toHaveBeenCalled();
    expect(getBundle).toHaveBeenCalledTimes(1);
  });

  it("bootstraps a live bundle when published data is missing", async () => {
    const bundle = { seasons: [], games: [] };
    getBundle
      .mockRejectedValueOnce(
        new Error(
          "No published official KBO bundle is available. Run a live ingest first, for example `pnpm ingest:kbo:current`.",
        ),
      )
      .mockResolvedValueOnce(bundle);

    const { loadCurrentBundleForAutomation } = await import(
      "@/lib/scheduler/kbo/runtime"
    );

    await expect(loadCurrentBundleForAutomation()).resolves.toBe(bundle);
    expect(refreshCurrentLiveBundle).toHaveBeenCalledTimes(1);
    expect(getBundle).toHaveBeenCalledTimes(2);
  });
});
