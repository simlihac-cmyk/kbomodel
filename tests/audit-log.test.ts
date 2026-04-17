import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { appendAuditLogEntry, listAuditLogEntries } from "@/lib/audit/log";

const auditLogPath = path.join(process.cwd(), "data", "kbo", "audit-log.json");
const originalAuditLog = await fs.readFile(auditLogPath, "utf8");

describe("audit log", () => {
  afterEach(async () => {
    await fs.writeFile(auditLogPath, originalAuditLog, "utf8");
  });

  it("appends audit entries and returns latest first", async () => {
    await appendAuditLogEntry({
      actorUsername: "admin",
      actorRole: "admin",
      action: "manualAdjustment.saved",
      targetType: "manualAdjustment",
      targetId: "kbo-2026:lg",
      summary: "LG 수동 보정 저장",
      ipAddress: "127.0.0.1",
      metadata: {
        offenseDelta: 1.2,
      },
    });

    const entries = await listAuditLogEntries();
    expect(entries[0]?.actorUsername).toBe("admin");
    expect(entries[0]?.action).toBe("manualAdjustment.saved");
    expect(entries[0]?.targetId).toBe("kbo-2026:lg");
  });
});
