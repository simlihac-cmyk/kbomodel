# 팀 컨디션 전력치 설계 초안

이 문서는 `팀 컨디션` 페이지에서 사용할 전력치 계산식을 정리한 초안이다.

핵심 원칙:

- 전력치는 `우리 팀의 절대값`이다.
- 상대 팀도 같은 식으로 별도 계산한다.
- 화면에서는 양 팀 전력치를 `오각형 레이더 차트`로 겹쳐 보여준다.
- 비교는 시각적으로만 하고, 점수 계산 자체는 상대값에 의존하지 않는다.

## 시각화 구조

레이더 차트 5축:

- 공격력
- 선발 컨디션
- 불펜 여력
- 라인업 완성도
- 엔트리 건강도

차트 밖에 두는 사실형 정보:

- 오늘 경기 정보: 상대, 시간, 장소, 날씨, 취소 리스크, 시즌 상대전적
- 선발 상세: 승-패, ERA, 이닝, 상대 기록, 최근 3경기
- 불펜 소모: 최근 3~5경기 사용량
- 부상/말소/복귀 리스트
- 예상 라인업 / 확정 라인업
- 키플레이어 카드

## 공통 점수 함수

모든 축 점수는 `0~100`으로 계산한다.

```ts
up(x, lo, hi) = clamp(100 * (x - lo) / (hi - lo), 0, 100)
down(x, lo, hi) = 100 - up(x, lo, hi)

shrink(score, sample, k, priorScore) =
  (sample / (sample + k)) * score +
  (k / (sample + k)) * priorScore
```

- `up`: 높을수록 좋은 기록
- `down`: 낮을수록 좋은 기록
- `shrink`: 표본이 작을수록 해당 시즌 리그 평균 점수로 당겨 과대평가를 줄임

운영 원칙:

- 데이터가 없으면 기본값은 `50`
- 계산 중간값과 최종값은 모두 `clamp(0, 100)`
- 최근 지표는 시즌 지표보다 변동성이 크므로 `shrink`를 적극 사용

## 1. 공격력

정의:

- 오늘 예상 타선이 얼마나 점수를 낼 수 있는 상태인지

식:

```text
공격력 =
0.70 * lineupSeasonProduction
+ 0.30 * recentOffense
```

세부식:

```text
lineupSeasonProduction = up(예상 라인업 가중 OPS, 0.630, 0.860)
recentOffense = shrink(up(최근 5경기 팀 경기당 득점, 2.5, 7.0), sample, k, priorScore)
```

1차 구현 간소화:

- 타순별 예상 PA 가중치를 반영한 `예상 라인업 OPS`
- `최근 5경기 팀 경기당 득점`

현재 데이터 매핑 후보:

- `expectedLineup`
- `playerSeasonStats.ops`
- 팀 최근 경기의 `homeScore`, `awayScore`

## 2. 선발 컨디션

정의:

- 오늘 선발투수가 얼마나 믿을 만한 상태인지

식:

```text
선발 컨디션 =
0.30 * seasonEraScore
+ 0.20 * seasonLengthScore
+ 0.25 * recentEraScore
+ 0.25 * recentLengthScore
```

세부식:

```text
seasonEraScore = shrink(down(시즌 ERA, 2.50, 6.20), 시즌이닝, 40, priorScore)
seasonLengthScore = shrink(up(경기당 평균 이닝, 4.0, 7.0), sample, 5, priorScore)
recentEraScore = shrink(down(최근 3경기 ERA, 1.80, 6.80), sample, 3, priorScore)
recentLengthScore = shrink(up(최근 3경기 평균 이닝, 4.0, 7.0), sample, 3, priorScore)
```

보정 원칙:

- ERA만 보지 않고 `이닝 소화력`을 같이 반영
- 시즌 이닝이 적거나 최근 3경기 표본이 작으면 `shrink`로 과대평가 방지

현재 데이터 매핑 후보:

- `starterMatchup.teamStarter`
- `playerSeasonStats.era`
- `playerSeasonStats.inningsPitched`
- `playerGameStats.inningsPitched`
- `playerGameStats.earnedRuns`

## 3. 불펜 여력

정의:

- 오늘 불펜이 얼마나 안정적으로 가동 가능한 상태인지

식:

```text
불펜 여력 =
0.25 * bullpenQuality
+ 0.35 * fatigueScore
+ 0.25 * leverageAvailability
+ 0.15 * bullpenHealth
```

세부식:

```text
bullpenQuality = shrink(down(팀 불펜 ERA, 3.20, 6.20), sample, 12, priorScore)

fatigueScore =
0.45 * down(최근 5경기 불펜 총이닝, lo, hi)
+ 0.35 * down(최근 3일 불펜 등판 수, lo, hi)
+ 0.20 * down(필승조 연투 수, lo, hi)

leverageAvailability =
핵심 계투 3명의 휴식 점수 평균

bullpenHealth =
100 - 핵심 불펜 이탈 패널티 + 최근 복귀 보너스
```

휴식 점수 예시:

- 2일 이상 휴식: `100`
- 1일 휴식: `75`
- 연투: `45`
- 3연투 이상: `20`

현재 데이터 매핑 후보:

- `teamSeasonStats.bullpenEra`
- `bullpenComparison.team.recentLoadLabel`
- `playerGameStats` 내 불펜 등판 기록
- `bullpenComparison.team.anchors`
- `rosterEvents`

비고:

- 이 축은 `팀 컨디션` 페이지의 핵심 차별 요소다.
- 시즌 평균보다 `최근 3~5경기 소모`와 `필승조 가용성`에 더 민감해야 한다.

## 4. 라인업 완성도

정의:

- 오늘 타선이 평소 의도한 최적 전력에 얼마나 가까운지

식:

```text
라인업 완성도 =
0.55 * coreCoverage
+ 0.15 * orderStability
+ 0.20 * topOrderPresence
+ 0.10 * positionCoverage
```

세부식:

```text
coreCoverage =
예상 라인업이 팀 핵심 타자 6명의 생산력 중 몇 %를 포함하는지

orderStability =
1~5번 타순이 평소 가장 자주 서던 자리와 얼마나 일치하는지

topOrderPresence =
팀 핵심 타자 3명이 실제 예상 라인업에 포함되는지

positionCoverage =
포수 / 유격 / 중견 등 핵심 수비 포지션 공백이 없는지
```

현재 데이터 매핑 후보:

- `expectedLineup`
- `playerSplitStats` 중 `splitType === "situation"` and `splitKey.startsWith("BATTING #")`
- `playerSeasonStats.ops`, `homeRuns`, `rbi`, `hits`
- `players.primaryPositions`

비고:

- 확정 라인업 ingest가 붙으면 `예상 라인업` 대신 실제 라인업으로 교체
- 부상과 별개로 `주전 휴식`이나 `상위 타순 이탈`을 잡아내는 축

## 5. 엔트리 건강도

정의:

- 현재 엔트리가 얼마나 온전한지

식:

```text
엔트리 건강도 =
100
- unavailablePenalty
+ returnBonus
```

세부식:

```text
unavailablePenalty =
핵심 이탈 선수 영향도 합 * 0.55

returnBonus =
최근 복귀 선수 영향도 합 * 0.20
```

선수 영향도 예시:

```text
타자 영향도 =
0.55 * 타석 점유율
+ 0.30 * 생산력 점수
+ 0.15 * 장타 기여도

투수 영향도 =
0.50 * 이닝 점유율
+ 0.25 * 품질 점수
+ 0.25 * 레버리지 기여도
```

현재 데이터 매핑 후보:

- `rosterEvents`
- `playerSeasonStats.plateAppearances`
- `playerSeasonStats.ops`
- `playerSeasonStats.homeRuns`
- `playerSeasonStats.inningsPitched`
- `playerSeasonStats.era`
- `playerSeasonStats.saves`
- `playerSeasonStats.holds`

비고:

- 벤치 선수 말소와 중심 타자 말소를 다르게 반영해야 한다.
- 최근 복귀는 과도한 보너스를 주지 않도록 패널티보다 가볍게 반영한다.

## 총점

중앙에 `오늘 팀 전력` 총점을 둘 경우:

```text
총점 =
0.26 * 공격력
+ 0.22 * 선발 컨디션
+ 0.24 * 불펜 여력
+ 0.18 * 라인업 완성도
+ 0.10 * 엔트리 건강도
```

해석 기준 예시:

- `80~100 백분위`: 상위권
- `60~79 백분위`: 우세
- `40~59 백분위`: 중위권
- `20~39 백분위`: 주의
- `0~19 백분위`: 하위권

## 상대 팀 표시 원칙

- 상대 팀도 같은 5축을 같은 식으로 계산한다.
- 레이더 차트에서는 `우리 팀`과 `상대 팀`을 겹쳐 그린다.
- 다만 축 정의는 어디까지나 `각 팀의 절대 상태`다.
- `상대전적`, `선발 맞대결`, `최근 맞대결 흐름`은 차트 밖 카드에서 설명한다.

## 1차 구현 권장 버전

처음부터 모든 세부 요소를 다 넣기보다 아래 버전으로 시작한다.

- 공격력: `예상 라인업 OPS + 최근 득점`
- 선발 컨디션: `시즌 ERA + 최근 3경기 ERA + 이닝`
- 불펜 여력: `불펜 ERA + 정규화된 최근 소모 + 필승조 휴식`
- 라인업 완성도: `핵심 타자 포함률 + 타순 안정성`
- 엔트리 건강도: `주요 이탈/복귀 영향도`

이후 확장 후보:

- 수비 안정감 축 추가 여부 검토
- 확정 라인업 ingest 연결
- 날씨 / 구장 / 상대 선발 유형 상성 보정 추가

## 구현 메모

- 점수 계산은 별도 helper 모듈로 분리
- 각 축은 `score`와 함께 `why` 설명 1줄도 반환
- UI에는 숫자만 보여주지 말고 근거 문장을 같이 둔다

예시:

- 공격력 78: `상위 4타선 OPS가 높고 최근 5경기 평균 득점이 5점대를 유지`
- 불펜 여력 62: `필승조 1명이 연투 중이라 가용성은 보통 수준`
- 엔트리 건강도 48: `핵심 타자와 주전 불펜 1명이 이탈`
