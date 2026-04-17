import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";

export type FetchHtmlResult = {
  html: string;
  fetchedAt: string;
  httpStatus: number;
  checksum: string;
  sourceUrl: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtml(sourceUrl: string, init?: RequestInit): Promise<FetchHtmlResult> {
  const maxRetries = Number.parseInt(process.env.FETCH_MAX_RETRIES ?? "3", 10);
  const retryBackoffMs = Number.parseInt(process.env.FETCH_RETRY_BACKOFF_MS ?? "750", 10);
  const politenessMs = Number.parseInt(process.env.FETCH_POLITENESS_MS ?? "250", 10);
  const userAgent = process.env.INGEST_USER_AGENT ?? "kbo-race-lab/0.1 (+ingest)";

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 0 || politenessMs > 0) {
        await sleep(attempt === 0 ? politenessMs : politenessMs + retryBackoffMs * attempt);
      }

      const response = await fetch(sourceUrl, {
        ...init,
        headers: {
          "user-agent": userAgent,
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });

      const html = await response.text();

      if (!response.ok && attempt < maxRetries) {
        lastError = new Error(`Fetch failed with ${response.status}`);
        continue;
      }

      return {
        html,
        fetchedAt: new Date().toISOString(),
        httpStatus: response.status,
        checksum: checksumHtml(html),
        sourceUrl: response.url || sourceUrl,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${sourceUrl}`);
}
