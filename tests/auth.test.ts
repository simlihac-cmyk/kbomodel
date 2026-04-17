import { afterEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword, validateAdminCredentials, verifyHashedPassword } from "@/lib/auth/password";
import { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } from "@/lib/auth/rate-limit";
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/auth/session";

describe("admin auth", () => {
  afterEach(() => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    vi.useRealTimers();
  });

  it("creates and verifies admin session tokens", async () => {
    process.env.ADMIN_SESSION_SECRET = "test-session-secret";

    const token = await createAdminSessionToken("admin");
    const session = await verifyAdminSessionToken(token);

    expect(session?.username).toBe("admin");
    expect(session?.role).toBe("admin");
  });

  it("hashes and verifies admin passwords", () => {
    const hash = hashAdminPassword("super-secure-password");

    expect(verifyHashedPassword("super-secure-password", hash)).toBe(true);
    expect(verifyHashedPassword("wrong-password", hash)).toBe(false);
  });

  it("validates credentials against configured admin hash", () => {
    process.env.ADMIN_USERNAME = "operator";
    process.env.ADMIN_PASSWORD_HASH = hashAdminPassword("very-secure-password");

    expect(validateAdminCredentials("operator", "very-secure-password")).toBe(true);
    expect(validateAdminCredentials("operator", "wrong-password")).toBe(false);
    expect(validateAdminCredentials("other", "very-secure-password")).toBe(false);
  });

  it("rate-limits repeated failed login attempts", () => {
    const key = "127.0.0.1:admin";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordFailedLoginAttempt(key);
    }

    expect(isLoginRateLimited(key)).toBe(true);
    clearLoginAttempts(key);
    expect(isLoginRateLimited(key)).toBe(false);
  });
});
