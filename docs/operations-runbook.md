# Operations Runbook

## 수동 실행
- hot phase: `pnpm ingest:kbo:hot`
- daily preflight: `pnpm ingest:kbo:preflight`
- nightly reconcile: `pnpm ingest:kbo:nightly`
- weekly cold sync: `pnpm ingest:kbo:weekly`

## 현재 bundle만 다시 publish
- `pnpm publish:kbo:current`

## 현재 시즌 live ingest 강제 refresh
- `pnpm ingest:kbo:current`

## 마지막 publish 확인
- `data/normalized/kbo/manifests/current.json`
- `data/normalized/kbo/manifests/today.json`
- `data/normalized/kbo/manifests/simulation.json`

## parser breakage 확인
1. raw snapshot이 저장됐는지 본다.
2. `pnpm test`로 fixture contract가 깨졌는지 본다.
3. 해당 source adapter selector를 수정한다.
4. `pnpm ingest:kbo:current` 또는 reconcile를 다시 돌린다.

## hot polling 일시 중지
- workflow disable
- 또는 `HOT_POLLER_ENABLED=false`

## signed publish endpoint 점검
- `GET /api/internal/ingest/health`
- `POST /api/internal/ingest/publish`
- `POST /api/internal/ingest/finalize`

## 외부 blob publish 점검
- `INGEST_PUBLISH_MODE=blob-put`
- `INGEST_BLOB_BASE_URL` 설정
- 필요하면 `INGEST_BLOB_AUTH_HEADER`, `INGEST_BLOB_AUTH_VALUE`, `INGEST_BLOB_PATH_PREFIX` 설정
- hot/nightly job 실행 후 외부 경로에 아래 파일이 올라가는지 본다.
  - `publish/current-state.json`
  - `publish/today-snapshot.json`
  - `publish/live-scoreboard.json`
  - `manifests/current.json`
  - `manifests/today.json`
  - `manifests/simulation.json`

## presigned-style blob plan 점검
- `INGEST_PUBLISH_MODE=blob-plan`
- `INGEST_BLOB_PLAN_URL` 설정
- `INGEST_BLOB_PLAN_SECRET` 또는 `INGEST_PUBLISH_SECRET` 설정
- planner endpoint는 `POST /api/internal/ingest/blob-plan`
- planner가 반환한 `uploadUrl`, `headers`, `method`대로 publisher가 업로드한다.
- 현재 기본 planner는 deterministic URL planner이며, production에서는 이 planner를 S3/R2 signer로 교체하면 된다.
