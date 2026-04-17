import type { ReactNode } from "react";

import { requireAdminSession } from "@/lib/auth/server";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminSession();

  return children;
}
