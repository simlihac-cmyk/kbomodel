import type { KboDataBundle } from "@/lib/domain/kbo/types";
import {
  normalizedFranchiseLineageSchema,
  type ManualSourcePatchBundle,
  type NormalizedSourceReference,
  type ParsedFranchiseHistoryRow,
} from "@/lib/data-sources/kbo/dataset-types";
import { resolveVenueId } from "@/lib/data-sources/kbo/merge/apply-manual-patches";
import { slugifyFragment } from "@/lib/data-sources/kbo/adapters/shared/html";

type NormalizeFranchiseHistoryArgs = {
  rows: ParsedFranchiseHistoryRow[];
  bundle: KboDataBundle;
  patches: ManualSourcePatchBundle;
  sourceRef: NormalizedSourceReference;
};

export function normalizeFranchiseHistory({
  rows,
  bundle,
  patches,
  sourceRef,
}: NormalizeFranchiseHistoryArgs) {
  const existingBrandMap = new Map(bundle.teamBrands.map((brand) => [brand.displayNameKo, brand] as const));

  const franchises = rows.map((row) => ({
    franchiseId: row.franchiseId,
    slug: slugifyFragment(row.canonicalNameKo),
    canonicalNameKo: row.canonicalNameKo,
    shortNameKo: row.shortNameKo,
    regionKo: row.regionKo,
    foundedYear: row.foundedYear,
    primaryVenueId: resolveVenueId(row.primaryVenueName, "official-kbo-ko", bundle, patches) ?? bundle.venues[0]?.venueId ?? "unknown",
    championships: row.championships,
    brandHistorySummary: row.brandHistorySummary,
  }));

  const teamBrands = rows.flatMap((row) =>
    row.brands.map((brand) => {
      const existing = existingBrandMap.get(brand.displayNameKo);
      return {
        brandId: existing?.brandId ?? slugifyFragment(brand.displayNameKo),
        franchiseId: row.franchiseId,
        displayNameKo: brand.displayNameKo,
        shortNameKo: brand.shortNameKo,
        shortCode: brand.shortCode,
        seasonStartYear: brand.seasonStartYear,
        seasonEndYear: brand.seasonEndYear,
        primaryColor: existing?.primaryColor ?? "#1f2937",
        secondaryColor: existing?.secondaryColor ?? "#9ca3af",
        wordmarkText: existing?.wordmarkText ?? brand.shortCode,
        logoPath: existing?.logoPath ?? `/logos/${slugifyFragment(brand.displayNameKo)}.svg`,
        notes: brand.notes,
      };
    }),
  );

  return normalizedFranchiseLineageSchema.parse({
    generatedAt: new Date().toISOString(),
    sources: [sourceRef],
    franchises,
    teamBrands,
  });
}
