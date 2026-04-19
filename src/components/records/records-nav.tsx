import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import {
  buildSeasonRecordsRoute,
  type SeasonRecordsCategory,
} from "@/lib/utils/routes";

type RecordsNavProps = {
  year: number;
  active: "overview" | SeasonRecordsCategory;
};

const RECORDS_NAV_ITEMS: Array<{
  key: "overview" | SeasonRecordsCategory;
  label: string;
  href: (year: number) => string;
}> = [
  { key: "overview", label: "기록실 홈", href: (year) => buildSeasonRecordsRoute(year) },
  { key: "teams", label: "팀기록", href: (year) => buildSeasonRecordsRoute(year, "teams") },
  { key: "pitchers", label: "투수기록", href: (year) => buildSeasonRecordsRoute(year, "pitchers") },
  { key: "hitters", label: "타자기록", href: (year) => buildSeasonRecordsRoute(year, "hitters") },
];

export function RecordsNav({ year, active }: RecordsNavProps) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="기록실 섹션 이동">
      {RECORDS_NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href(year)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-accent text-white"
                : "border border-line/80 bg-white text-muted hover:border-accent hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
