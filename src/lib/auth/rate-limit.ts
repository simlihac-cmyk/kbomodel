const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const loginAttempts = new Map<string, AttemptWindow>();

function now(): number {
  return Date.now();
}

function readWindow(key: string): AttemptWindow {
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now()) {
    const fresh = {
      count: 0,
      resetAt: now() + WINDOW_MS,
    };
    loginAttempts.set(key, fresh);
    return fresh;
  }

  return current;
}

export function isLoginRateLimited(key: string): boolean {
  return readWindow(key).count >= MAX_ATTEMPTS;
}

export function recordFailedLoginAttempt(key: string): void {
  const current = readWindow(key);
  loginAttempts.set(key, {
    ...current,
    count: current.count + 1,
  });
}

export function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}
