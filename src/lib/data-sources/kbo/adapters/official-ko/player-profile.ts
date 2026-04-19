import { loadHtml, textOrNull } from "@/lib/data-sources/kbo/adapters/shared/html";
import { parsedPlayerProfileRowSchema, type ParsedPlayerProfileRow } from "@/lib/data-sources/kbo/dataset-types";

function normalizeBirthDate(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  const match = rawValue.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) {
    return textOrNull(rawValue);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parsePositionDetails(rawValue: string | null) {
  const normalized = textOrNull(rawValue);
  if (!normalized) {
    return {
      positionLabel: null,
      batsThrows: null,
    };
  }

  const match = normalized.match(/^(.*?)(?:\(([^()]*)\))?$/);
  return {
    positionLabel: textOrNull(match?.[1] ?? normalized),
    batsThrows: textOrNull(match?.[2] ?? null),
  };
}

export function parseOfficialKoPlayerProfile(
  html: string,
  identity: { pcode: string; statType: "hitter" | "pitcher" },
): ParsedPlayerProfileRow | null {
  const $ = loadHtml(html);
  const profile = $("div.player_basic").first();
  if (profile.length === 0) {
    return null;
  }

  const teamHeading = profile.prevAll("h4").first().clone();
  teamHeading.find("span").remove();

  const fields = new Map<string, string>();
  profile.find("li").each((_, element) => {
    const label = textOrNull(
      $(element)
        .find("strong")
        .text()
        .replace(/:\s*$/, ""),
    );
    const value = textOrNull($(element).find("span").text());
    if (label && value) {
      fields.set(label, value);
    }
  });

  const playerName =
    fields.get("선수명") ??
    textOrNull(profile.find("img").attr("alt")) ??
    null;
  if (!playerName) {
    return null;
  }

  const { positionLabel, batsThrows } = parsePositionDetails(fields.get("포지션") ?? null);

  return parsedPlayerProfileRowSchema.parse({
    pcode: identity.pcode,
    statType: identity.statType,
    teamName: textOrNull(teamHeading.text()),
    playerName,
    backNumber: textOrNull(fields.get("등번호") ?? null),
    birthDate: normalizeBirthDate(fields.get("생년월일") ?? null),
    positionLabel,
    batsThrows,
    heightWeight: textOrNull(fields.get("신장/체중") ?? null),
    career: textOrNull(fields.get("경력") ?? null),
    draftInfo: textOrNull(fields.get("지명순위") ?? null),
    joinInfo: textOrNull(fields.get("입단년도") ?? null),
  });
}
