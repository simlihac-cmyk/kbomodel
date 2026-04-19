import { parseOfficialKoAwardGridPage } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-shared";

export function parseOfficialKoPlayerAwardsGoldenGlove(html: string) {
  return parseOfficialKoAwardGridPage(html, "골든글러브");
}
