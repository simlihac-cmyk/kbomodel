# Automation Pipeline

## 기본 결정
- 기본 스케줄러는 GitHub Actions다.
- 기본 타임존은 `Asia/Seoul`이다.
- 현재 시즌 full schedule baseline은 공식 KBO 한국어 일정 서비스가 우선이다.
- standings / scoreboard는 공식 KBO English mirror를 우선 사용하고, 한국어 페이지를 fallback으로 둔다.
- publish 기본 모드는 `file`이며, production 권장 모드는 `signed-http`다.

## 왜 GitHub Actions인가
- 이 repo는 이미 file-backed ingest와 published bundle을 갖고 있어서 외부 스케줄러가 붙기 쉽다.
- Vercel redeploy 중심 구조보다 poller와 reconcile job을 분리하기 쉽다.
- hot path와 cold path를 워크플로 단위로 명확히 나누기 쉽다.

## Hot Path vs Cold Path
### Hot Path
- today schedule
- live scoreboard
- current standings
- current manifests
- current simulation input / result

### Cold Path
- player register / register-all
- roster movement
- team history
- historical team record
- rules metadata
- optional Statiz enrichment

## 왜 live update와 full recompute를 분리하나
- 이닝별 스코어 변화는 scoreboard freshness에는 중요하지만 시즌 전체 Monte Carlo를 매번 다시 돌릴 정도의 이벤트는 아니다.
- full recompute는 FINAL / POSTPONED / RESCHEDULED / standings correction 같은 semantic transition에서만 돈다.

## Publisher Modes
- `file`: 로컬/개발 기본. `data/normalized/kbo/publish`와 `manifests`에 쓴다.
- `signed-http`: production 권장. 내부 endpoint에 signed request로 publish한다.
- `blob-put`: presigned URL 계열이나 object gateway에 JSON을 직접 PUT하는 외부 저장소 모드다.
- `blob-plan`: 먼저 upload plan을 발급받고, 그 계획의 `PUT` URL과 헤더대로 업로드하는 presigned-style 모드다.
- `git`: fallback only. hot polling 기본값으로 쓰지 않는다.

## S3-compatible Presign
- planner route는 S3-compatible credential env가 있으면 실제 SigV4 presigned PUT URL을 발급한다.
- 이 구현은 AWS S3 query-string SigV4 규칙과 R2의 S3-compatible presigned URL 모델을 따른다.
- env가 없으면 deterministic blob planner로 fallback 한다.

## Failure Handling
- parser breakage는 workflow를 fail loud하게 만들고, 현재 manifest는 마지막 정상 publish를 유지한다.
- cold sync 실패는 hot path를 막지 않는다.
- official live 검증이 덜 된 dataset은 publish 단계에서 empty-state를 유지한다.
