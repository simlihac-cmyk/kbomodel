# UX / IA

## 정보 구조
- `/`
  - 현재 ongoing season으로 리다이렉트
- `/season/[year]`
  - 현재 시즌 홈
- `/season/[year]/race`
  - 최종 순위 분포와 bucket odds
- `/season/[year]/scenario`
  - 시리즈 중심 가정 입력
- `/season/[year]/teams/[teamSlug]`
  - 시즌 팀 상세
- `/season/[year]/postseason`
  - projected bracket / round odds
- `/season/[year]/records`
  - 기록실 허브
- `/season/[year]/records/teams`
  - 팀기록
- `/season/[year]/records/pitchers`
  - 투수기록
- `/season/[year]/records/hitters`
  - 타자기록
- `/archive`
  - 시즌 아카이브 허브
- `/archive/[year]`
  - 시즌 아카이브 상세
- `/teams/[teamSlug]`
  - 프랜차이즈/구단 아카이브
- `/games/[gameId]`
  - 경기 상세
- `/players/[playerId]`
  - 선수 상세
- `/model`
  - 모델 설명
- `/admin/*`
  - 관리자 레이어

## UI 원칙
- 한국어 중심
- 데이터 대시보드 느낌
- 표 가독성 우선
- 모바일은 핵심 카드 우선, 표는 horizontal scroll 허용

## scenario UX
- 기본 모드: quick mode
- 빠른 입력:
  - 홈 위닝시리즈
  - 원정 위닝시리즈
  - 홈 스윕
  - 원정 스윕
  - 모델대로
- 좁혀 보기:
  - 팀 중심 모드
  - 경쟁선 모드
  - 정밀 모드
