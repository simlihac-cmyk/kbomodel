import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedHistoricalTeamRecordsSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedHistoricalTeamRecordRow,
} from "@/lib/data-sources/kbo/dataset-types";

type NormalizeHistoricalTeamRecordArgs = {
  rows: ParsedHistoricalTeamRecordRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

function resolveFranchiseId(bundle: KboDataBundle, rawTeamName: string) {
  const brand = bundle.teamBrands.find(
    (item) => item.displayNameKo === rawTeamName || item.shortNameKo === rawTeamName || item.shortCode === rawTeamName,
  );
  return brand?.franchiseId ?? `unknown:${rawTeamName}`;
}

export function normalizeHistoricalTeamRecord({
  rows,
  bundle,
  sourceRef,
}: NormalizeHistoricalTeamRecordArgs) {
  return normalizedHistoricalTeamRecordsSchema.parse({
    generatedAt: new Date().toISOString(),
    sources: [sourceRef],
    rows: rows.map((row) => ({
      year: row.year,
      franchiseId: resolveFranchiseId(bundle, row.teamName),
      brandLabel: row.teamName,
      rank: row.rank,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      postseasonResult: row.postseasonResult,
    })),
  });
}
