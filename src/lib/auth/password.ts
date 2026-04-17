import { randomBytes, timingSafeEqual, scryptSync } from "node:crypto";

const DEFAULT_DEV_USERNAME = "admin";
const DEFAULT_DEV_PASSWORD = "change-me-admin";

type PasswordHashParts = {
  salt: Buffer;
  key: Buffer;
};

function readAdminUsername(): string {
  return process.env.ADMIN_USERNAME ?? DEFAULT_DEV_USERNAME;
}

function readPasswordHash(): string | null {
  return process.env.ADMIN_PASSWORD_HASH ?? null;
}

function getDevPassword(): string {
  return process.env.ADMIN_PASSWORD ?? DEFAULT_DEV_PASSWORD;
}

function parsePasswordHash(input: string): PasswordHashParts | null {
  const [scheme, salt, key] = input.split(":");
  if (scheme !== "scrypt" || !salt || !key) {
    return null;
  }

  try {
    return {
      salt: Buffer.from(salt, "base64"),
      key: Buffer.from(key, "base64"),
    };
  } catch {
    return null;
  }
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyHashedPassword(password: string, hash: string): boolean {
  const parsed = parsePasswordHash(hash);
  if (!parsed) {
    return false;
  }

  const derived = scryptSync(password, parsed.salt, parsed.key.length);
  return timingSafeEqual(derived, parsed.key);
}

export function validateAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = readAdminUsername();
  if (username !== expectedUsername) {
    return false;
  }

  const passwordHash = readPasswordHash();
  if (passwordHash) {
    return verifyHashedPassword(password, passwordHash);
  }

  if (process.env.NODE_ENV !== "production") {
    return password === getDevPassword();
  }

  return false;
}

export function getAdminUsername(): string {
  return readAdminUsername();
}
