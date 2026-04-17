import crypto from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

export function hashSemanticPayload(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

export function detectSemanticChange(previousPayload: unknown, nextPayload: unknown) {
  const previousHash = previousPayload === null || previousPayload === undefined ? null : hashSemanticPayload(previousPayload);
  const nextHash = hashSemanticPayload(nextPayload);

  return {
    previousHash,
    nextHash,
    changed: previousHash !== nextHash,
  };
}
