import { promises as fs } from "node:fs";
import path from "node:path";

import { auditLogBundleSchema } from "@/lib/domain/kbo/schemas";
import type { AuditAction, AuditLogBundle, AuditLogEntry } from "@/lib/domain/kbo/types";

const AUDIT_LOG_PATH = path.join(process.cwd(), "data", "kbo", "audit-log.json");
const MAX_AUDIT_LOG_ENTRIES = 300;

function createEmptyAuditLogBundle(): AuditLogBundle {
  return {
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

async function readAuditLogFile(): Promise<AuditLogBundle> {
  try {
    const raw = await fs.readFile(AUDIT_LOG_PATH, "utf8");
    return auditLogBundleSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyAuditLogBundle();
    }

    throw error;
  }
}

async function writeAuditLogFile(bundle: AuditLogBundle): Promise<void> {
  await fs.writeFile(AUDIT_LOG_PATH, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

function slugifyAuditId(value: string): string {
  return value.replace(/[^a-zA-Z0-9:-]+/g, "-");
}

export async function listAuditLogEntries(): Promise<AuditLogEntry[]> {
  const bundle = await readAuditLogFile();
  return bundle.entries
    .slice()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export async function appendAuditLogEntry(input: {
  actorUsername: string;
  actorRole: "admin";
  action: AuditAction;
  targetType: "manualAdjustment" | "schedule" | "season" | "teamBrand" | "import" | "auth";
  targetId: string;
  summary: string;
  ipAddress: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<AuditLogEntry> {
  const bundle = await readAuditLogFile();
  const occurredAt = new Date().toISOString();
  const entry: AuditLogEntry = {
    auditLogId: slugifyAuditId(`${occurredAt}:${input.action}:${input.targetId}`),
    occurredAt,
    actorUsername: input.actorUsername,
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    ipAddress: input.ipAddress,
    metadata: input.metadata ?? {},
  };

  const next: AuditLogBundle = {
    updatedAt: occurredAt,
    entries: [entry, ...bundle.entries].slice(0, MAX_AUDIT_LOG_ENTRIES),
  };

  await writeAuditLogFile(next);
  return entry;
}
