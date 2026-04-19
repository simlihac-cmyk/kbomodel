import type { getSeasonDashboardData } from "@/lib/repositories/kbo/view-models";

export type SeasonRecordsData = NonNullable<Awaited<ReturnType<typeof getSeasonDashboardData>>>;
