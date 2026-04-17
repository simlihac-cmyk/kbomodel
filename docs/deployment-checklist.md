# Deployment Checklist

## 1. 관리자 보안
- `ADMIN_USERNAME` 설정
- `ADMIN_PASSWORD_HASH` 설정
- `ADMIN_SESSION_SECRET`를 충분히 길고 랜덤한 값으로 설정
- `/login`과 `/admin` 접근 제어 확인

## 2. 공식 ingest 기본값
- `OFFICIAL_KBO_ONLY=true`
- `ENABLE_STATIZ_ENRICHMENT=false`
- `KBO_TIMEZONE=Asia/Seoul`
- `HOT_POLLER_ENABLED=true`
- `FULL_SIM_ON_FINAL_ONLY=true`

## 3. publish 전략 선택
### 권장
- `INGEST_PUBLISH_MODE=blob-plan`
- planner route를 통해 presigned PUT 발급
- object storage로 직접 업로드

### 개발 / fallback
- `INGEST_PUBLISH_MODE=file`
- 로컬 파일 저장

## 4. R2 배포 시 확인
- `INGEST_S3_REGION=auto`
- `INGEST_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
- `INGEST_S3_FORCE_PATH_STYLE=true`
- `INGEST_S3_BUCKET` 설정
- `INGEST_S3_PUBLIC_BASE_URL`가 실제 CDN/공개 경로와 맞는지 확인

## 5. AWS S3 배포 시 확인
- `INGEST_S3_REGION`이 실제 버킷 리전과 일치하는지 확인
- `INGEST_S3_ENDPOINT` 확인
- virtual-hosted style을 쓰면 `INGEST_S3_FORCE_PATH_STYLE=false`
- 버킷 CORS / PUT 정책 확인

## 6. planner route 점검
- `POST /api/internal/ingest/blob-plan`이 200을 반환하는지 확인
- 응답에 `signer: "s3-presign"`이 나오는지 확인
- `uploadUrl`에 `X-Amz-Algorithm=AWS4-HMAC-SHA256`가 붙는지 확인

## 7. health endpoint 점검
- `GET /api/internal/ingest/health`
- `publishMode`, `blobPlanUrl`, `s3PresignEnabled` 값 확인
- freshness manifest가 비정상적으로 stale 상태가 아닌지 확인

## 8. 스케줄러 점검
- `kbo-hot-poller`
- `kbo-daily-preflight`
- `kbo-nightly-reconcile`
- `kbo-weekly-cold-sync`
- concurrency 설정이 중복 실행을 막는지 확인

## 9. 첫 배포 후 수동 점검
1. `pnpm ingest:kbo:hot`
2. `pnpm ingest:kbo:nightly`
3. `/season/2026`
4. `/season/2026/race`
5. `/season/2026/scenario`
6. `/api/internal/ingest/health`

## 10. 장애 대응 준비
- 마지막 정상 manifest 경로 확인
- object storage rollback 절차 확인
- 수동 patch 경로 확인
- parser breakage 시 nightly만 멈추지 않도록 hot path fallback 전략 확인
