import { AdminNav } from "@/components/shared/admin-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { listAuditLogEntries } from "@/lib/audit/log";
import { formatDateTimeLabel } from "@/lib/utils/format";

export default async function AdminAuditPage() {
  const entries = await listAuditLogEntries();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Audit"
        title="운영 이력 로그"
        description="로그인 성공/실패, 로그아웃, 수동 보정 저장 같은 운영 이벤트를 시간순으로 확인합니다."
        actions={<AdminNav />}
      />

      <SectionCard title="Audit Log" subtitle="최신 순으로 최대 300건을 보관합니다.">
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.auditLogId} className="rounded-2xl border border-line/80 px-4 py-4 text-sm">
              <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-medium text-ink">{entry.summary}</p>
                <p className="text-muted">{formatDateTimeLabel(entry.occurredAt)}</p>
              </div>
              <p className="mt-2 text-muted">
                {entry.actorUsername} · {entry.action} · {entry.targetId}
              </p>
              <p className="mt-1 text-muted">IP {entry.ipAddress ?? "-"}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
