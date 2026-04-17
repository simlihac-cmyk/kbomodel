import { parseOfficialEnStandings } from "@/lib/data-sources/kbo/adapters/official-en/standings";

export function parseOfficialKoStandings(html: string) {
  return parseOfficialEnStandings(html);
}
