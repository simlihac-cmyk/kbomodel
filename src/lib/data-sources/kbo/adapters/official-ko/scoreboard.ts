import { parseOfficialEnScoreboard } from "@/lib/data-sources/kbo/adapters/official-en/scoreboard";

export function parseOfficialKoScoreboard(html: string) {
  return parseOfficialEnScoreboard(html);
}
