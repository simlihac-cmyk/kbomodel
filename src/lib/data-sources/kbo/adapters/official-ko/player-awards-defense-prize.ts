import { parseOfficialKoAwardGridPage } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-shared";

export function parseOfficialKoPlayerAwardsDefensePrize(html: string) {
  return parseOfficialKoAwardGridPage(html, "KBO 수비상");
}
