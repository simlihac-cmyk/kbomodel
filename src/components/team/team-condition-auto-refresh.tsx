"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type TeamConditionAutoRefreshProps = {
  scheduledAt: string;
  watchPendingSignals: boolean;
  intervalMs?: number;
  watchWindowMinutes?: number;
};

export function TeamConditionAutoRefresh({
  scheduledAt,
  watchPendingSignals,
  intervalMs = 300_000,
  watchWindowMinutes = 60,
}: TeamConditionAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!watchPendingSignals) {
      return;
    }

    const scheduledMs = new Date(scheduledAt).getTime();
    if (!Number.isFinite(scheduledMs)) {
      return;
    }

    const watchStartMs = scheduledMs - watchWindowMinutes * 60 * 1000;
    let intervalId: number | null = null;
    let startTimeoutId: number | null = null;

    const clearRefreshInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const refreshIfNeeded = () => {
      const now = Date.now();
      if (now < watchStartMs || now >= scheduledMs) {
        clearRefreshInterval();
        return;
      }
      if (document.visibilityState !== "visible") {
        return;
      }
      router.refresh();
    };

    const startRefreshInterval = () => {
      const now = Date.now();
      if (now >= scheduledMs) {
        return;
      }
      if (now < watchStartMs) {
        return;
      }
      if (intervalId !== null) {
        return;
      }
      intervalId = window.setInterval(refreshIfNeeded, intervalMs);
    };

    const scheduleWindowStart = () => {
      const now = Date.now();
      if (now >= scheduledMs) {
        return;
      }
      if (now >= watchStartMs) {
        startRefreshInterval();
        return;
      }
      startTimeoutId = window.setTimeout(() => {
        router.refresh();
        startRefreshInterval();
      }, watchStartMs - now);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (now >= watchStartMs && now < scheduledMs) {
        router.refresh();
        startRefreshInterval();
      }
    };

    scheduleWindowStart();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearRefreshInterval();
      if (startTimeoutId !== null) {
        window.clearTimeout(startTimeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, router, scheduledAt, watchPendingSignals, watchWindowMinutes]);

  return null;
}
