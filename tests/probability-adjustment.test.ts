import { describe, expect, it } from "vitest";

import { applyProbabilityAdjustment } from "@/lib/sim/kbo/probability-adjustment";
import {
  DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS,
  probabilityAdjustmentParameterSetSchema,
} from "@/lib/sim/kbo/probability-adjustment-parameters";

describe("applyProbabilityAdjustment", () => {
  it("preserves tie probability while adjusting only the decisive edge", () => {
    const parameters = probabilityAdjustmentParameterSetSchema.parse({
      ...DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS,
      homeBias: 0.18,
      awayBias: -0.12,
      tieBias: 4.5,
      homeWeights: {
        ...DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS.homeWeights,
        recent10Gap: 0.4,
        recent10ByProgress: 0.2,
      },
      awayWeights: {
        ...DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS.awayWeights,
        recent10Gap: -0.25,
      },
      tieWeights: {
        ...DEFAULT_PROBABILITY_ADJUSTMENT_PARAMETERS.tieWeights,
        recent10Gap: 10,
      },
    });

    const adjusted = applyProbabilityAdjustment({
      homeWinProb: 0.47,
      awayWinProb: 0.49,
      tieProb: 0.04,
      features: {
        recent10Gap: 0.5,
        pctGap: 0.1,
        venueSplitGap: 0.05,
        restGap: 0,
        seasonProgress: 0.12,
        recent10ByProgress: 0.44,
        pctByProgress: 0.012,
      },
      parameters,
    });

    expect(adjusted.tieProb).toBeCloseTo(0.04, 8);
    expect(adjusted.homeWinProb + adjusted.awayWinProb + adjusted.tieProb).toBeCloseTo(1, 8);
    expect(adjusted.homeWinProb).toBeGreaterThan(0.47);
    expect(adjusted.awayWinProb).toBeLessThan(0.49);
  });
});
