import type { ReactNode } from "react";

import Link from "next/link";

import { logoutAdminAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils/cn";

type PageShellProps = {
  currentYear: number;
  isAdmin: boolean;
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

export function PageShell({ currentYear, isAdmin, children, className }: PageShellProps) {
  const navLinks = publicNavLinks(currentYear);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/season/${currentYear}`} className="min-w-0 font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
              KBO Race Lab
            </Link>
            <p className="hidden text-sm text-muted lg:block">
              KBO 전용 순위 예측, 경우의 수 계산, 아카이브
            </p>
            <div className="hidden items-center gap-2 sm:flex">
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

            <div className="sm:hidden">
              <details className="group relative [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex list-none items-center gap-2 rounded-full border border-line/80 bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm">
                  <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.7">
                    <path d="M3.5 5.5h13" strokeLinecap="round" />
                    <path d="M3.5 10h13" strokeLinecap="round" />
                    <path d="M3.5 14.5h13" strokeLinecap="round" />
                  </svg>
                  메뉴
                </summary>

                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[26px] border border-line/80 bg-white/95 p-2 shadow-panel backdrop-blur">
                  <nav className="grid gap-2">
                    {navLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-2xl border border-line/70 bg-slate-50/80 px-4 py-3 text-sm font-medium text-ink transition hover:border-accent/30 hover:text-accent"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-2 border-t border-line/70 pt-2">
                    {isAdmin ? (
                      <div className="grid gap-2">
                        <Link
                          href="/admin"
                          className="rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm font-medium text-accent"
                        >
                          관리자 콘솔
                        </Link>
                        <form action={logoutAdminAction}>
                          <button
                            type="submit"
                            className="w-full rounded-2xl border border-line/80 bg-white px-4 py-3 text-sm font-medium text-muted"
                          >
                            로그아웃
                          </button>
                        </form>
                      </div>
                    ) : (
                      <Link
                        href="/login"
                        className="block rounded-2xl border border-line/80 bg-white px-4 py-3 text-sm font-medium text-muted"
                      >
                        운영자 로그인
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </div>
          <nav className="hidden gap-2 overflow-x-auto pb-1 sm:flex">
            {navLinks.map((item) => (
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
        </div>
      </header>
      <main className={cn("mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8", className)}>{children}</main>
    </div>
  );
}
