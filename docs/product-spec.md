# Product Spec

## 목표
- KBO 현재 시즌 순위 레이스를 공식 순위표 감각으로 보여준다.
- 남은 경기 가정을 시리즈 단위로 빠르게 입력하게 한다.
- 현재 시즌과 깊은 아카이브를 자연스럽게 공존시킨다.
- 초기에는 bootstrap bundle + manual patch로 운영하고, 이후 DB로 옮기기 쉽게 한다.

## 왜 KBO 전용 구조인가
- 멀티스포츠 추상화보다 KBO 팬이 바로 읽는 정보 구조가 더 중요하다.
- KBO는 시리즈 단위 UX, 무승부, 5강 포스트시즌 ladder, 브랜드 변천 같은 고유성이 강하다.
- generic league abstraction을 크게 만들면 `Series`, `5위 레이스`, `와일드카드 어드밴티지` 같은 핵심 도메인이 흐려진다.

## 핵심 사용자 여정
1. 홈에서 현재 시즌 대시보드로 들어간다.
2. standings table과 bucket odds로 전체 판세를 읽는다.
3. race 페이지에서 팀별 최종 순위 분포와 결정전 경보를 본다.
4. scenario 페이지에서 시리즈 단위 가정을 넣고 delta를 확인한다.
5. 팀/경기/선수/아카이브로 deeper dive 한다.

## 현재 구현 범위
- 현재 시즌 1개
- 공식 historical standings 기반 완료 시즌 아카이브
- 10개 팀
- 현재 시즌 시리즈/경기/선수 흐름과 경우의 수 계산
- 과거 시즌 경기/선수 상세는 공식 ingest 확보 범위부터 공개
- Web Worker 기반 Monte Carlo
- local scenario override + baseline 분리
- 관리자 조회 화면 + manual adjustment 저장

## 이후 확장 포인트
- 공식 일정/박스스코어 ingest
- PostgreSQL/Prisma 또는 Drizzle adapter
- 더 깊은 선수/상황별/월별 기록
- 선발 예고 반영과 delta recompute 최적화 고도화
