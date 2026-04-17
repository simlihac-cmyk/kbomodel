import type { ReactNode } from "react";

import Link from "next/link";

import { logoutAdminAction } from "@/app/actions/auth";
import { FreshnessBadges, type AutomationStatusViewModel } from "@/components/shared/freshness-badges";
import { cn } from "@/lib/utils/cn";

type PageShellProps = {
  currentYear: number;
  isAdmin: boolean;
  automationStatus: AutomationStatusViewModel | null;
  children: ReactNode;
  className?: string;
};

const publicNavLinks = (year: number) => [
  { href: `/season/${year}`, label: "대시보드" },
  { href: `/season/${year}/race`, label: "순위전망" },
  { href: `/season/${year}/scenario`, label: "경우의 수" },
  { href: `/season/${year}/postseason`, label: "포스트시즌" },
  { href: `/season/${year}/records`, label: "기록실" },
  { href: "/archive", label: "아카이브" },
  { href: "/model", label: "모델" },
];

export function PageShell({ currentYear, isAdmin, automationStatus, children, className }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/season/${currentYear}`} className="font-display text-xl font-semibold tracking-tight text-ink">
              KBO Race Lab
            </Link>
            <p className="hidden text-sm text-muted lg:block">
              KBO 전용 순위 예측, 경우의 수 계산, 아카이브
            </p>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <Link
                    href="/admin"
                    className="rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
                  >
                    관리자 콘솔
                  </Link>
                  <form action={logoutAdminAction}>
                    <button
                      type="submit"
                      className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                    >
                      로그아웃
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted"
                >
                  운영자 로그인
                </Link>
              )}
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {publicNavLinks(currentYear).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-sm text-accent transition hover:border-accent"
              >
                관리자
              </Link>
            ) : null}
          </nav>
          <FreshnessBadges status={automationStatus} compact />
        </div>
      </header>
      <main className={cn("mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8", className)}>{children}</main>
    </div>
  );
}
