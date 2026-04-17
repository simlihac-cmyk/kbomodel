import { redirect } from "next/navigation";

import { kboRepository } from "@/lib/repositories/kbo";

export default async function HomePage() {
  const currentSeason = await kboRepository.getCurrentSeason();
  redirect(`/season/${currentSeason.year}`);
}
