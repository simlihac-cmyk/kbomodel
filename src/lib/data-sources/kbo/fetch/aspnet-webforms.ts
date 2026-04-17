import { loadHtml } from "@/lib/data-sources/kbo/adapters/shared/html";
import type { FetchHtmlResult } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";

function toFieldValue(value: string | string[] | undefined | null) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function buildAspNetPostbackForm(
  html: string,
  eventTarget: string,
  overrides: Record<string, string> = {},
) {
  const $ = loadHtml(html);
  const form = new URLSearchParams();

  $("input[name]").each((_, element) => {
    const field = $(element);
    const name = field.attr("name");
    if (!name) {
      return;
    }

    const type = (field.attr("type") ?? "text").toLowerCase();
    if ((type === "checkbox" || type === "radio") && !field.is(":checked")) {
      return;
    }

    form.set(name, toFieldValue(field.val() as string | string[] | undefined));
  });

  $("select[name]").each((_, element) => {
    const field = $(element);
    const name = field.attr("name");
    if (!name) {
      return;
    }

    const selected = field.find("option[selected]").first();
    const fallback = field.find("option").first();
    const value = selected.attr("value") ?? fallback.attr("value") ?? "";
    form.set(name, value);
  });

  form.set("__EVENTTARGET", eventTarget);
  form.set("__EVENTARGUMENT", "");
  form.set("__LASTFOCUS", "");

  for (const [name, value] of Object.entries(overrides)) {
    form.set(name, value);
  }

  return form;
}

export function getSelectedAspNetSelectValue(html: string, fieldName: string) {
  const $ = loadHtml(html);
  const matched = $("select")
    .toArray()
    .map((element) => $(element))
    .find((field) => field.attr("name") === fieldName);
  if (!matched) {
    return null;
  }

  const selected = matched.find("option[selected]").first();
  const fallback = matched.find("option").first();
  return selected.attr("value") ?? fallback.attr("value") ?? null;
}

export async function fetchAspNetSeasonSelectionPage(args: {
  url: string;
  seasonYear: number;
  seasonFieldName: string;
}): Promise<FetchHtmlResult> {
  const userAgent = process.env.INGEST_USER_AGENT ?? "kbo-race-lab/0.1 (+ingest)";
  const initialResponse = await fetch(args.url, {
    headers: {
      "user-agent": userAgent,
    },
    cache: "no-store",
  });
  const initialHtml = await initialResponse.text();
  const form = buildAspNetPostbackForm(initialHtml, args.seasonFieldName, {
    [args.seasonFieldName]: String(args.seasonYear),
  });
  const cookieHeader =
    typeof initialResponse.headers.getSetCookie === "function"
      ? initialResponse.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ")
      : "";
  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "user-agent": userAgent,
      "content-type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      referer: args.url,
    },
    body: form.toString(),
    cache: "no-store",
  });
  const html = await response.text();

  return {
    html,
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    checksum: checksumHtml(html),
    sourceUrl: response.url || args.url,
  };
}
