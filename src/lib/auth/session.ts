export const ADMIN_SESSION_COOKIE = "kbo_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEV_SESSION_SECRET = "dev-admin-session-secret-change-me";

type AdminSessionPayload = {
  sub: string;
  role: "admin";
  exp: number;
};

export type AdminSession = {
  username: string;
  role: "admin";
  expiresAt: number;
};

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(normalized + padding);
}

function getSessionSecret(): string {
  const configured = process.env.ADMIN_SESSION_SECRET;
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_SESSION_SECRET;
  }

  throw new Error("Missing ADMIN_SESSION_SECRET in production.");
}

async function importSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string): Promise<string> {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(signature);
  return base64UrlEncode(String.fromCharCode(...bytes));
}

function parsePayload(token: string): AdminSessionPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    return JSON.parse(base64UrlDecode(payload)) as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function createAdminSessionToken(username: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: username,
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies AdminSessionPayload),
  );
  const unsigned = `${header}.${payload}`;
  const signature = await sign(unsigned);
  return `${unsigned}.${signature}`;
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSession | null> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const unsigned = `${header}.${payload}`;
  const expectedSignature = await sign(unsigned);
  if (expectedSignature !== signature) {
    return null;
  }

  const parsed = parsePayload(token);
  if (!parsed || parsed.role !== "admin" || parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    username: parsed.sub,
    role: parsed.role,
    expiresAt: parsed.exp,
  };
}

export function getAdminSessionMaxAge(): number {
  return SESSION_TTL_SECONDS;
}
