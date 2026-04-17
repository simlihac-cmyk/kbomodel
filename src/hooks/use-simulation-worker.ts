"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SIMULATION_ITERATIONS, DEFAULT_WORKER_DEBOUNCE_MS } from "@/lib/domain/kbo/constants";
import type { ScenarioOverride, SimulationInput, SimulationSnapshot } from "@/lib/domain/kbo/types";
import { serializeScenarioKey } from "@/lib/sim/kbo";
import type { WorkerResponse } from "@/lib/workers/kbo-worker-contract";

type WorkerState = {
  snapshot: SimulationSnapshot;
  loading: boolean;
  error: string | null;
};

const simulationCache = new Map<string, SimulationSnapshot>();

export function useSimulationWorker(
  baseInput: Omit<SimulationInput, "scenarioOverrides">,
  initialSnapshot: SimulationSnapshot,
  scenarioOverrides: ScenarioOverride[],
): WorkerState {
  const [state, setState] = useState<WorkerState>({
    snapshot: initialSnapshot,
    loading: false,
    error: null,
  });
  const requestIdRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const scenarioKey = useMemo(
    () => `${baseInput.season.seasonId}:${serializeScenarioKey(scenarioOverrides)}`,
    [baseInput.season.seasonId, scenarioOverrides],
  );

  useEffect(() => {
    simulationCache.set(`${baseInput.season.seasonId}:[]`, initialSnapshot);
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../lib/workers/kbo-sim.worker.ts", import.meta.url));
    }

    const worker = workerRef.current;
    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      if (!requestIdRef.current || response.requestId !== requestIdRef.current) {
        return;
      }

      if (response.type === "result") {
        simulationCache.set(scenarioKey, response.payload);
        setState({
          snapshot: response.payload,
          loading: false,
          error: null,
        });
      } else if (response.type === "error") {
        setState((current) => ({
          ...current,
          loading: false,
          error: response.error,
        }));
      } else if (response.type === "cancelled") {
        setState((current) => ({
          ...current,
          loading: false,
        }));
      }
    };

    worker.addEventListener("message", handleMessage);
    return () => {
      worker.removeEventListener("message", handleMessage);
    };
  }, [baseInput.season.seasonId, initialSnapshot, scenarioKey]);

  useEffect(() => {
    const cached = simulationCache.get(scenarioKey);
    if (cached) {
      setState({
        snapshot: cached,
        loading: false,
        error: null,
      });
      return;
    }

    if (scenarioOverrides.length === 0) {
      setState({
        snapshot: initialSnapshot,
        loading: false,
        error: null,
      });
      return;
    }

    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    const timeout = window.setTimeout(() => {
      const requestId = `${baseInput.season.seasonId}:${Date.now()}`;
      if (requestIdRef.current) {
        worker.postMessage({
          type: "cancel",
          requestId: requestIdRef.current,
        });
      }

      requestIdRef.current = requestId;
      worker.postMessage({
        type: "simulate",
        requestId,
        iterations: DEFAULT_SIMULATION_ITERATIONS,
        payload: {
          ...baseInput,
          scenarioOverrides,
        },
      });
    }, DEFAULT_WORKER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [baseInput, initialSnapshot, scenarioKey, scenarioOverrides]);

  useEffect(
    () => () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    },
    [],
  );

  return state;
}
