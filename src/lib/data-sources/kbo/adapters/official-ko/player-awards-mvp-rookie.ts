import { parseOfficialKoAwardDualPage } from "@/lib/data-sources/kbo/adapters/official-ko/player-awards-shared";

export function parseOfficialKoPlayerAwardsMvpRookie(html: string) {
  return parseOfficialKoAwardDualPage(html);
}
