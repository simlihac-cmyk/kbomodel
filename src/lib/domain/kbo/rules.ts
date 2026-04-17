import type { KboSeasonRuleset, PostseasonRoundConfig } from "@/lib/domain/kbo/types";

export function getPostseasonRound(
  ruleset: KboSeasonRuleset,
  round: PostseasonRoundConfig["round"],
): PostseasonRoundConfig {
  const config = ruleset.postseasonFormat.find((item) => item.round === round);
  if (!config) {
    throw new Error(`Missing postseason round config for ${round}`);
  }

  return config;
}

export function usesSpecialPlayoffGame(
  ruleset: KboSeasonRuleset,
  position: number,
): boolean {
  return ruleset.specialPlayoffGamePositions.includes(position);
}

export function describeRuleset(ruleset: KboSeasonRuleset): string[] {
  return [
    `정규시즌 팀당 ${ruleset.regularSeasonGamesPerTeam}경기`,
    `상대 팀당 ${ruleset.gamesPerOpponent}경기`,
    ruleset.tiesAllowed ? "정규시즌 무승부 허용" : "정규시즌 무승부 없음",
    `동률 우선순위: ${ruleset.tiebreakerOrder.join(" > ")}`,
    ...ruleset.notes,
  ];
}
