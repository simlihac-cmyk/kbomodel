import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { appendAuditLogEntry } from "@/lib/audit/log";
import { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } from "@/lib/auth/rate-limit";
import { getCurrentAdminSession, signInAdmin } from "@/lib/auth/server";

async function loginAction(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "unknown";
  const rateLimitKey = `${ip}:${username}`;

  if (isLoginRateLimited(rateLimitKey)) {
    redirect(`/login?error=rate-limit&next=${encodeURIComponent(next)}`);
  }

  const success = await signInAdmin(username, password);
  if (!success) {
    recordFailedLoginAttempt(rateLimitKey);
    await appendAuditLogEntry({
      actorUsername: username || "unknown",
      actorRole: "admin",
      action: "admin.login.failed",
      targetType: "auth",
      targetId: username || "unknown",
      summary: `${username || "unknown"} 로그인 시도가 실패했습니다.`,
      ipAddress: ip,
      metadata: {
        next,
      },
    });
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  clearLoginAttempts(rateLimitKey);
  await appendAuditLogEntry({
    actorUsername: username,
    actorRole: "admin",
    action: "admin.login.succeeded",
    targetType: "auth",
    targetId: username,
    summary: `${username} 로그인에 성공했습니다.`,
    ipAddress: ip,
    metadata: {
      next,
    },
  });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await getCurrentAdminSession();
  const { next, error } = await searchParams;

  if (session) {
    redirect(next && next.startsWith("/admin") ? next : "/admin");
  }

  const nextTarget = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="운영자 로그인"
        title="관리자 영역 로그인"
        description="공개 사용자 영역과 운영자 관리 영역은 분리됩니다. 관리자 인증 후에만 `/admin` 경로와 서버 수정 액션에 접근할 수 있습니다."
      />

      <SectionCard title="로그인" subtitle="초기 버전은 단일 관리자 계정과 세션 쿠키를 사용합니다.">
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={nextTarget} />
          <label className="block text-sm text-muted">
            아이디
            <input
              name="username"
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink"
            />
          </label>
          <label className="block text-sm text-muted">
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-ink"
            />
          </label>
          {error === "invalid" ? (
            <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-warning">
              로그인 정보가 올바르지 않습니다.
            </p>
          ) : null}
          {error === "rate-limit" ? (
            <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-warning">
              로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
              로그인
            </button>
            <Link href="/" className="text-sm text-muted underline underline-offset-4">
              공개 홈으로 돌아가기
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
