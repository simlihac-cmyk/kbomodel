"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { appendAuditLogEntry } from "@/lib/audit/log";
import { getCurrentAdminSession } from "@/lib/auth/server";
import { signOutAdmin } from "@/lib/auth/server";

export async function logoutAdminAction() {
  const session = await getCurrentAdminSession();
  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  if (session) {
    await appendAuditLogEntry({
      actorUsername: session.username,
      actorRole: "admin",
      action: "admin.logout",
      targetType: "auth",
      targetId: session.username,
      summary: `${session.username} 로그아웃`,
      ipAddress,
      metadata: {},
    });
  }

  await signOutAdmin();
  redirect("/");
}
