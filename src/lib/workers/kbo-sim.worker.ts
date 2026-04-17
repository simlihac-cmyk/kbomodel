/// <reference lib="webworker" />

import { workerRequestSchema } from "@/lib/workers/kbo-worker-contract";
import { runSimulationRequest } from "@/lib/workers/kbo-worker-contract";

const scope = self as DedicatedWorkerGlobalScope;
const cancelledRequests = new Set<string>();

scope.onmessage = (event: MessageEvent<unknown>) => {
  try {
    const message = workerRequestSchema.parse(event.data);

    if (message.type === "cancel") {
      cancelledRequests.add(message.requestId);
      scope.postMessage({
        type: "cancelled",
        requestId: message.requestId,
      });
      return;
    }

    if (cancelledRequests.has(message.requestId)) {
      scope.postMessage({
        type: "cancelled",
        requestId: message.requestId,
      });
      return;
    }

    const result = runSimulationRequest(message.payload, message.iterations);
    if (cancelledRequests.has(message.requestId)) {
      scope.postMessage({
        type: "cancelled",
        requestId: message.requestId,
      });
      return;
    }

    scope.postMessage({
      type: "result",
      requestId: message.requestId,
      payload: result,
    });
  } catch (error) {
    scope.postMessage({
      type: "error",
      requestId:
        typeof event.data === "object" &&
        event.data !== null &&
        "requestId" in event.data &&
        typeof (event.data as { requestId?: unknown }).requestId === "string"
          ? (event.data as { requestId: string }).requestId
          : "unknown",
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};
