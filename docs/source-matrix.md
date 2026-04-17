# Source Matrix

| Dataset | Preferred Source | Fallback Source | Extraction Method | Cadence | Raw Snapshot Path | Normalized Entity Target | Model Feature Target | Risk Notes | Blocker Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| schedule list / calendar | Official KBO Korean Schedule service (`GetScheduleList`) | Official KBO English Daily Schedule | Official JSON service parse, English HTML cross-check | 20m | `data/raw/kbo/official-kbo-ko/schedule-calendar/{date}.html` | `Series`, `Game` via `series-games` | remaining schedule, head-to-head remaining games, home/away schedule shape | Korean service schema may change, future games may omit review links | verified against live 2026-04 season-wide schedule service |
| live scoreboard / linescore | Official KBO English Scoreboard | Official KBO Korean Scoreboard | HTML card + linescore table parse | 5m during game windows | `data/raw/kbo/official-kbo-en/scoreboard/{date}.html` | `Game`, `GameBoxScore` via `scoreboard` | recent form, pitcher usage inputs, tie environment | live page may lag or omit attendance | verified against live scheduled page and 2026-04-01 final page |
| standings | Official KBO English Team Standings | Official KBO Korean Team Rank | HTML table parse | 20m | `data/raw/kbo/official-kbo-en/standings/{date}.html` | normalized standings snapshot | current standings, home/away splits, offense inputs | games-behind format may vary | verified against live 2026-04-15 official page |
| player register / active roster | Official KBO Korean Register | Official KBO Korean Register All | HTML table parse | daily | `data/raw/kbo/official-kbo-ko/player-register/{date}.html` | `Player` candidate enrichment | roster availability adjustment | name/position variations | fixture not added yet |
| player movement / injured / rehab / FA / trade | Official KBO Korean player movement | none | HTML table parse | 6h | `data/raw/kbo/official-kbo-ko/roster-movement/{date}.html` | `RosterEvent` | roster availability adjustment | page may mix transaction types | parser-ready with fixture |
| player season stats (current-season partial) | Official KBO English Batting/Pitching Top5 + Player Summary pages | none | HTML top5 card parse + per-player summary table parse | daily / preflight | `data/raw/kbo/official-kbo-en/batting-top5/{date}.html`, `.../pitching-top5/{date}.html`, `.../player-summary-*/{date}-{pcode}.html` | `player-season-stats` | player leaderboard inputs, key player cards, player detail basics | partial coverage only for players surfaced on official Top5 pages | verified against live 2026-04-15 pages |
| team hitter records | Official KBO Korean team hitter record | none | HTML team table parse | 6h / preflight | `data/raw/kbo/official-kbo-ko/team-hitter/{date}.html` | `team-hitter-stats` | offense inputs, published `teamSeasonStats.offensePlus` | table columns may change by season | verified against live 2026-04-15 page |
| team pitcher records | Official KBO Korean team pitcher record | none | HTML team table parse | 6h / preflight | `data/raw/kbo/official-kbo-ko/team-pitcher/{date}.html` | `team-pitcher-stats` | pitching inputs, bullpen baseline, published `teamSeasonStats.pitchingPlus` | innings text formatting can vary | verified against live 2026-04-15 page |
| historical team season summaries | Official KBO Korean historical record | none | HTML table parse | ad hoc / archive refresh | `data/raw/kbo/official-kbo-ko/historical-team-record/{key}.html` | historical team record rows | prior generation inputs, archive depth | season layout variance | parser-ready, live variance unknown |
| franchise / team-brand lineage | Official KBO Korean team history | none | HTML section + nested brand table parse | ad hoc | `data/raw/kbo/official-kbo-ko/team-history/{key}.html` | `Franchise`, `TeamBrand` | franchise identity continuity, archive routing | historical brand text may need manual cleanup | parser-ready with fixture |
| season rules / postseason / tie rules | Official KBO Korean GameManage / League pages | mobile GameManage page | HTML section parse | season start / ad hoc | `data/raw/kbo/official-kbo-ko/rules/{key}.html` | `Ruleset` | postseason ladder resolution, tie rules | year-specific page URLs differ | parser-ready with fixture |
| weather | Official KBO weather page | none | HTML table parse | same day / hourly | `data/raw/kbo/official-kbo-ko/weather/{date}.html` | `WeatherSnapshot` | optional weather inputs | availability may be same-day only | not fixture-backed yet |
| player search | Official KBO English Player Search | Official KBO Korean Register | HTML table parse | weekly | `data/raw/kbo/official-kbo-en/player-search/{date}.html` | player candidate enrichment | roster availability context | not baseline | not fixture-backed yet |
| team information | Official KBO English Team Information | Official KBO Korean team pages | HTML table parse | monthly | `data/raw/kbo/official-kbo-en/team-information/{date}.html` | venue/team metadata candidates | home field inputs | not baseline | not fixture-backed yet |
| sabermetric enrichment | Statiz | none | HTML table parse, feature-flagged | ad hoc | `data/raw/kbo/statiz/statiz-war/{date}.html` | enrichment-only stat rows | optional offense/starter/bullpen enrichments | unofficial and layout-sensitive | disabled by default |

## Source-To-Domain Mapping

| Source Dataset | Domain Entities |
| --- | --- |
| schedule-calendar | `Season`, `SeasonTeam`, `Series`, `Game`, `Venue`, `ManualPatch` |
| scoreboard | `Game`, `GameBoxScore`, `Player`, `WeatherSnapshot`, `ManualPatch` |
| standings | `Season`, `SeasonTeam`, `TeamSeasonStat`, `ManualPatch` |
| player-register / player-register-all | `Player`, `SeasonTeam`, `RosterEvent` candidate layer |
| batting-top5 / pitching-top5 / player-summary-* | `Player`, `PlayerSeasonStat`, `SeasonTeam` |
| roster-movement | `RosterEvent`, `Player`, `SeasonTeam`, `ManualPatch` |
| team-hitter | `SeasonTeam`, `TeamSeasonStat` |
| team-pitcher | `SeasonTeam`, `TeamSeasonStat` |
| historical-team-record | `Season`, `TeamBrand`, `SeasonSummary`, archive record rows |
| team-history | `Franchise`, `TeamBrand`, `Venue`, `ManualPatch` |
| rules | `Season`, `Ruleset`, postseason metadata |
| weather | `WeatherSnapshot`, `Game` link candidates |
| manual patches | `ManualPatch`, plus corrections over `Series`, `Game`, `Venue`, `TeamBrand`, `Player` naming |

## Source-To-Model-Feature Mapping

| Source Dataset | Model Feature Inputs |
| --- | --- |
| schedule-calendar | remaining schedule, head-to-head remaining games, homeFieldAdjustment opportunity set |
| scoreboard | recentForm inputs, pitcher usage inputs, tieEnvironment inputs |
| standings | offenseRating inputs, home/away splits, current standings baseline |
| player-register / roster-movement | rosterAvailabilityAdjustment inputs |
| batting-top5 / pitching-top5 / player-summary-* | hitter/pitcher leaderboard inputs, key player card inputs |
| team-hitter | offenseRating inputs, current-season team attack baseline |
| team-pitcher | starterRating / bullpenRating baseline inputs, tieEnvironment hints |
| historical-team-record | prior generation seeds for offense/starter/bullpen priors |
| rules | postseason bracket rules, tie rules, playoff game conditions |
| weather | optional weather inputs, tie/run environment hints |
| Statiz enrichment | optional offenseRating / starterRating / bullpenRating enrichments only |
