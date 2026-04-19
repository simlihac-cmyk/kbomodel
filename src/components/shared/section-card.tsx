import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  compact?: boolean;
};

export function SectionCard({
  title,
  subtitle,
  actions,
  className,
  children,
  compact = false,
}: SectionCardProps) {
  return (
    <section className={cn("panel", className)}>
      <div className={cn("panel-header", compact && "px-4 py-3.5")}>
        <div>
          <h2 className={cn("font-display font-semibold text-ink", compact ? "text-base sm:text-lg" : "text-lg")}>
            {title}
          </h2>
          {subtitle ? <p className={cn("mt-1 text-muted", compact ? "text-xs sm:text-sm" : "text-sm")}>{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div className={cn("panel-body", compact && "px-4 py-3.5")}>{children}</div>
    </section>
  );
}
