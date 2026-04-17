# KBO Race Lab

KBO 전용 순위 레이스, 시나리오, 아카이브 웹앱입니다. 멀티스포츠 플랫폼이 아니라 KBO 고유 UX와 도메인 구조를 우선으로 설계했습니다.

## 핵심 설계
- `Franchise`와 `TeamBrand`를 분리해 브랜드 변천과 프랜차이즈 계보를 함께 다룹니다.
- `Series`와 `Game`를 분리해 KBO 팬이 실제로 쓰는 시리즈 중심 UX를 만듭니다.
- generic league abstraction을 최소화하고 KBO ruleset 차이를 별도 객체로 뒀습니다.
- baseline 공식 데이터와 local scenario override를 분리해 설명 가능한 delta를 제공합니다.

## 스택
- Next.js 15 App Router
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Zod
- Web Worker
- Vitest + Testing Library
- pnpm

## 실행
```bash
pnpm install
pnpm bootstrap:kbo
pnpm ingest:kbo:current
pnpm lint
pnpm typecheck
pnpm test
pnpm dev
```

## 관리자 보안 설정
```bash
pnpm auth:hash-password -- your-strong-password
```

`.env.local` 예시:
```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=scrypt:...
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

- 공개 사용자 영역과 `/admin/*`는 분리됩니다.
- 관리자 경로는 로그인 후 세션 쿠키가 있어야 접근 가능합니다.
- 수동 보정 같은 서버 write action도 관리자 세션을 다시 확인합니다.

## 주요 폴더
- `src/app` 라우트
- `src/components` 화면 구성 요소
- `src/lib/auth` 관리자 인증/인가 유틸
- `src/lib/domain/kbo` KBO 도메인 타입/규칙/standings/tiebreakers/postseason
- `src/lib/repositories/kbo` file/memory adapter와 view model 조립
- `src/lib/sim/kbo` 전력 분해, 확률, 시뮬레이션
- `src/lib/workers` worker contract와 simulation worker
- `src/stores` scenario/ui 상태
- `data/kbo` bootstrap bundle와 manual patch
- `docs` 제품/도메인/모델/운영 문서

## 현재 범위
- ongoing season 1개
- 10개 팀
- 현재 시즌 공식 일정/순위/팀 스탯 기반 예측
- 공식 historical standings가 확보된 완료 시즌 아카이브
- 과거 시즌 경기/선수 세부 화면은 공식 ingest 확보 범위까지만 노출
- 현재 시즌 팀 타격/투수 baseline은 공식 KBO ingest 기준
- 현재 시즌 공식 선수 기록은 영문 Top5 + 선수 Summary ingest 기준으로 부분 반영
- projected postseason and scenario workflow
- file-backed admin manual adjustment
- file-backed audit log

## 실데이터 연동 포인트
- `KboRepository` 인터페이스를 유지한 채 DB adapter 추가
- raw ingest를 `data/kbo/raw` 또는 외부 저장소로 확장
- schedule, boxscore, player stat normalization 파이프라인 교체

## 데이터 소스 / 인입
- 공식 KBO Korean = baseline truth
- 공식 KBO English = schedule/scoreboard/standings의 parse-friendly mirror
- Statiz = optional enrichment only
- manual patch = 최종 운영 보정 레이어
- 앱은 `data/kbo/bundle.json`을 직접 읽는 대신, ingest가 만든 `data/normalized/kbo/app-bundle/latest.json`을 우선 읽습니다.
- `data/kbo/bundle.json`은 현재 단계에서는 publish 입력용 bootstrap source 역할로만 남아 있습니다.
- `OFFICIAL_KBO_ONLY=true` 기본값에서는 local fallback current-season 데이터가 섞이면 published bundle 생성이 막힙니다.

관련 문서:
- `docs/data-source-strategy.md`
- `docs/source-matrix.md`
- `docs/ingest-workflow.md`

관련 명령:
```bash
pnpm ingest:kbo:current
pnpm ingest:kbo:hot
pnpm ingest:kbo:preflight
pnpm ingest:kbo:nightly
pnpm ingest:kbo:weekly
pnpm publish:kbo:current
pnpm ingest:kbo:fixtures
pnpm ingest:kbo:publish
pnpm ingest:kbo:schedule
pnpm ingest:kbo:scoreboard
pnpm ingest:kbo:standings
pnpm ingest:kbo:team-stats
pnpm ingest:kbo:player-stats
pnpm ingest:kbo:roster
pnpm ingest:kbo:history
pnpm normalize:kbo
```

모델 참고:
- 승률은 전년도 기준점, 현재 승률, 최근 10경기, 홈/원정 흐름, 기대 득점 기반의 규칙 모델로 계산합니다.
- 별도 학습 기반 승률 보정은 현재 운영 경로에서 사용하지 않습니다.
- 대신 `패스 / 관심 / 픽 / 강한 픽` 형태의 pick confidence를 Elo, 최근 흐름, 휴식일 같은 사실 기반 신호로 따로 계산합니다.

## 보안 문서
- `docs/security-model.md`

## 운영 / 배포 문서
- `docs/automation-pipeline.md`
- `docs/operations-runbook.md`
- `docs/deployment-checklist.md`
- `.env.production.r2.example`
- `.env.production.s3.example`

## Known gaps
- 현재 시즌 핵심 standings/schedule/scoreboard/team hitter/team pitcher는 공식 KBO live ingest 기준이고, 선수 기록도 영문 Top5 + Summary 기준으로 부분 반영한다. 다만 전체 선수 리더보드와 깊은 경기 로그는 아직 더 확장해야 한다.
- 월간 일정은 한국어 공식 일정 서비스 기준으로 3월~9월 전체를 publish하지만, 선수/기록실/아카이브 depth는 아직 공식 ingest를 더 붙여야 한다.
- admin CRUD는 조회 + 수동 보정 저장 위주다.
