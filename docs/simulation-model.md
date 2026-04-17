# Simulation Model

## 설계 원칙
- black box가 아니라 설명 가능한 모델
- 단일 rating 하나로 뭉개지지 않음
- 현재 시즌 반영 비중은 경기 수가 늘수록 증가
- Web Worker에서 Monte Carlo 수행

## 전력 분해
- `offenseRating`
- `starterRating`
- `bullpenRating`
- `homeFieldAdjustment`
- `recentFormAdjustment`
- `confidenceScore`

## prior와 current 혼합
- prior는 `SeasonTeam.preseasonPriors`와 이전 시즌 성과를 기반으로 한다.
- current는 `TeamSeasonStat` 기반 offense/pitching signal과 최근 10경기 폼을 사용한다.
- 게임 수가 적을수록 prior weight가 크고, 시즌이 진행될수록 current weight가 커진다.

## 경기 승률 계산
- offense edge, starter edge, bullpen edge, recent form, home field를 합산한다.
- 정규시즌은 win / tie / loss 확률을 모두 출력한다.
- 함께 `expectedRunsHome`, `expectedRunsAway`, explanation reasons를 만든다.

## 정규시즌 Monte Carlo
- 남은 경기만 시뮬레이션한다.
- baseline final games는 고정한다.
- scenario override는 남은 game/series에만 적용한다.
- iteration마다 KBO식 tie resolver를 적용해 최종 1~10위 분포를 집계한다.
- 1위~5위 / 탈락 bucket을 별도로 제공한다.

## 포스트시즌
- top 5를 KBO ladder에 연결한다.
- wildcard 4위 어드밴티지, 준PO, PO, KS를 ruleset에서 가져온다.
- 팀별 round reach, KS, champion odds를 집계한다.

## 성능
- baseline snapshot은 서버에서 미리 계산한다.
- scenario recompute는 Web Worker + debounce로 돌린다.
- 클라이언트에는 scenario key 기반 cache를 둔다.
