import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionMaxAge, verifyAdminSessionToken, type AdminSession } from "@/lib/auth/session";
import { validateAdminCredentials } from "@/lib/auth/password";

function isSecureCookieRequest(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function getCurrentAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyAdminSessionToken(token);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getCurrentAdminSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function signInAdmin(username: string, password: string): Promise<boolean> {
  const valid = validateAdminCredentials(username, password);
  if (!valid) {
    return false;
  }

  const token = await createAdminSessionToken(username);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookieRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: getAdminSessionMaxAge(),
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecureCookieRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
