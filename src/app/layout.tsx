import type { Metadata } from "next";

import "@/app/globals.css";

import { getCurrentAdminSession } from "@/lib/auth/server";
import { PageShell } from "@/components/shared/page-shell";
import { kboRepository } from "@/lib/repositories/kbo";
import { getAutomationStatusView } from "@/lib/repositories/kbo/view-models";

export const metadata: Metadata = {
  title: "KBO Race Lab",
  description: "KBO 최종순위 예측과 5강 경우의 수 계산을 위한 전용 웹앱",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [currentSeason, session] = await Promise.all([
    kboRepository.getCurrentSeason(),
    getCurrentAdminSession(),
  ]);
  const automationStatus = await getAutomationStatusView();

  return (
    <html lang="ko">
      <body>
        <PageShell currentYear={currentSeason.year} isAdmin={Boolean(session)} automationStatus={automationStatus}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}
