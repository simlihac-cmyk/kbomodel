import { getKboDateKey } from "@/lib/scheduler/kbo/windows";
import { kboRepository } from "@/lib/repositories/kbo";

export async function buildCurrentStateSnapshot() {
  const season = await kboRepository.getCurrentSeason();
  const seasonContext = await kboRepository.getSeasonContext(season.year);
  if (!seasonContext) {
    return null;
  }

  const todayDate = getKboDateKey();
  const gamesToday = seasonContext.games.filter((game) => game.scheduledAt.slice(0, 10) === todayDate);
  const liveGames = gamesToday.filter(
    (game) => game.status !== "final" && game.homeScore !== null && game.awayScore !== null,
  );

  return {
    generatedAt: new Date().toISOString(),
    season: seasonContext.season,
    standingsBaseline: seasonContext.teamSeasonStats,
    gamesToday,
    liveGames,
    hasLiveGames: liveGames.length > 0,
    allGamesFinal: gamesToday.length > 0 && gamesToday.every((game) => game.status === "final" || game.status === "postponed"),
  };
}
