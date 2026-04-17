import { load } from "cheerio";

export function loadHtml(html: string) {
  return load(html);
}

export function textOrNull(value: string | undefined | null) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

export function parseInteger(value: string | undefined | null) {
  const text = textOrNull(value);
  if (!text) {
    return null;
  }
  const normalized = text.replace(/,/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseFloatNumber(value: string | undefined | null) {
  const text = textOrNull(value);
  if (!text) {
    return null;
  }
  const parsed = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function slugifyFragment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
