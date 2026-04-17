# Data Model

## 핵심 분리

### Franchise vs TeamBrand
- `Franchise`는 구단 계보다.
- `TeamBrand`는 시즌별 표기 이름, 컬러, 로고, 약칭이다.
- 이유:
  - SSG/키움처럼 브랜드가 바뀌어도 프랜차이즈 축은 이어진다.
  - 아카이브와 현재 시즌을 함께 다룰 때 브랜드 변천을 자연스럽게 표현할 수 있다.

### Series vs Game
- `Series`는 KBO UX의 기본 단위다.
- `Game`은 실제 결과, 연기, 재편성, 박스스코어 단위다.
- 이유:
  - 사용자가 720경기를 하나씩 누르는 UX는 무너진다.
  - quick scenario는 series override가 자연스럽고, archive/game detail은 game 단위가 필요하다.

### Baseline vs Scenario Override
- baseline은 서버 기준 공식 데이터다.
- scenario override는 클라이언트 local state다.
- 이유:
  - 공식 데이터와 사용자 가정이 섞이면 설명 불가능해진다.
  - delta view, reset to official, share-ready serializer가 쉬워진다.

## 엔티티 계층
- Identity: `Franchise`, `TeamBrand`, `Venue`
- Competition: `Season`, `KboSeasonRuleset`, `SeasonTeam`
- Schedule: `Series`, `Game`
- Archive: `GameBoxScore`, `Player`, `RosterEvent`, `PlayerSeasonStat`, `PlayerGameStat`, `TeamSeasonStat`, `TeamSplitStat`, `Award`, `SeasonSummary`, `PostseasonResult`
- Simulation: `TeamStrengthSnapshot`, `GameProbabilitySnapshot`, `SimulationSnapshot`, `RankDistribution`, `BucketOdds`, `PostseasonOdds`, `ExplanationReason`
- Scenario: `UserScenario`, `ScenarioOverride`

## 저장 전략
- `data/kbo/bundle.json`
  - 현재는 publish 입력용 bootstrap source
- `data/normalized/kbo/app-bundle/latest.json`
  - 앱이 실제로 읽는 ingest-published bundle
- `data/kbo/manual-adjustments.json`
- file adapter가 Zod parse 후 repository contract로 노출
- memory adapter를 별도로 두어 이후 DB adapter와 같은 인터페이스를 유지
