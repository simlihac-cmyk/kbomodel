import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
};

export function PageHeader({ eyebrow, title, description, actions, compact = false }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-line/70 bg-white/85 shadow-panel",
        compact ? "px-4 py-4 sm:px-5 sm:py-5" : "px-4 py-5 sm:px-6 sm:py-7",
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "font-semibold uppercase tracking-[0.24em] text-accent",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-col lg:flex-row lg:items-end lg:justify-between",
          eyebrow ? "mt-2" : "",
          compact ? "gap-3" : "gap-4",
        )}
      >
        <div className="max-w-3xl">
          <h1
            className={cn(
              "font-display font-semibold tracking-tight text-ink",
              compact ? "text-xl sm:text-2xl lg:text-3xl" : "text-2xl sm:text-3xl lg:text-4xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "text-muted",
                compact ? "mt-2 text-sm leading-5 lg:text-sm" : "mt-3 text-sm leading-6 lg:text-base",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="w-full shrink-0 lg:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}
