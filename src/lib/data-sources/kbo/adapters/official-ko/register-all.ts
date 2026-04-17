import { parseOfficialKoRegister } from "@/lib/data-sources/kbo/adapters/official-ko/register";

export function parseOfficialKoRegisterAll(html: string) {
  return parseOfficialKoRegister(html);
}
