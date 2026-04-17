# Ingest Workflow

## Pipeline Stages

1. **Fetch raw HTML**
   - source registry에서 dataset별 preferred source를 고른다.
   - live fetch가 가능하면 해당 HTML을 가져온다.
   - live fetch가 막혀 있으면 local fallback HTML을 사용한다.

2. **Snapshot and cache**
   - raw HTML을 `data/raw/kbo/{sourceId}/{datasetId}/{snapshotKey}.html`에 저장한다.
   - 메타데이터는 같은 경로의 `.json`에 저장한다.
   - 메타데이터 필드:
     - `fetchedAt`
     - `sourceUrl`
     - `httpStatus`
     - `checksum`
     - `parserVersion`
     - `fixtureBacked`

3. **Parse**
   - source별 adapter가 raw HTML을 typed row 배열로 변환한다.
   - English/Korean adapter는 분리 유지한다.
   - headless browser는 사용하지 않고 Cheerio 기반 HTML parse를 기본으로 한다.

4. **Normalize**
   - UI가 읽기 쉬운 generic scrape row가 아니라 KBO domain-oriented payload로 변환한다.
   - 핵심 normalized output:
     - `series-games`
     - `scoreboard`
     - `standings`
     - `roster-events`
     - `franchise-lineage`
     - `historical-team-records`
     - `rulesets`

5. **Validate**
   - 모든 normalized payload는 Zod schema를 통과해야 한다.
   - parse 성공과 normalize 성공을 분리해 기록한다.

6. **Patch**
   - `data/manual-patches/kbo/source-overrides.json`을 overlay한다.
   - alias, reschedule, naming mismatch, parser miss correction은 이 레이어에서 해결한다.
   - raw snapshot은 수정하지 않는다.

7. **Publish to repositories**
   - normalized JSON을 `data/normalized/kbo/{datasetName}/{snapshotKey}.json`에 저장한다.
   - 앱이 직접 읽는 published bundle은 `data/normalized/kbo/app-bundle/latest.json`에 생성한다.
   - `OFFICIAL_KBO_ONLY=true` 기본값에서는 current-season `standings`, `series-games`, `scoreboard`가 fallback-backed면 publish를 막는다.
   - 추후 DB adapter가 들어와도 repository contract는 유지한다.

8. **Expose to app**
   - 앱/시뮬레이션 레이어는 raw HTML이 아니라 published bundle과 normalized repository만 읽는다.
   - simulation baseline은 standings + series-games + roster-events + optional scoreboard/weather에서 만든다.

## Layered Architecture

1. Raw source layer
2. Normalized KBO domain layer
3. Manual patch layer
4. Derived feature layer
5. Simulation input layer

## Current Commands

```bash
pnpm ingest:kbo:current
pnpm ingest:kbo:fixtures
pnpm ingest:kbo:schedule
pnpm ingest:kbo:scoreboard
pnpm ingest:kbo:standings
pnpm ingest:kbo:roster
pnpm ingest:kbo:history
pnpm normalize:kbo
```

## Starter Operational Flow

### Local / fallback-backed

```bash
pnpm ingest:kbo:fixtures
```

- local fallback HTML을 raw snapshot으로 저장한다.
- parser/normalizer를 실행한다.
- normalized JSON preview를 `data/normalized/kbo`에 쓴다.

### Live-first current season

```bash
pnpm ingest:kbo:current
```

- official English `Daily Schedule`, `Team Standings`, `Scoreboard`를 live fetch한다.
- season-wide `schedule-calendar`는 한국어 공식 일정 서비스(`/ws/Schedule.asmx/GetScheduleList`)를 live fetch한다.
- standings와 scoreboard는 official English mirror를 우선 fetch한다.
- raw snapshot metadata에는 `fixtureBacked: false`가 기록된다.
- current-season publish bundle은 이 세 dataset이 live snapshot일 때만 생성된다.

## Raw Snapshot Layout

```text
data/raw/kbo/{sourceId}/{datasetId}/{snapshotKey}.html
data/raw/kbo/{sourceId}/{datasetId}/{snapshotKey}.json
```

## Normalized Output Layout

```text
data/normalized/kbo/series-games/{snapshotKey}.json
data/normalized/kbo/scoreboard/{snapshotKey}.json
data/normalized/kbo/standings/{snapshotKey}.json
data/normalized/kbo/roster-events/{snapshotKey}.json
data/normalized/kbo/franchise-lineage/{snapshotKey}.json
data/normalized/kbo/historical-team-records/{snapshotKey}.json
data/normalized/kbo/rulesets/{snapshotKey}.json
data/normalized/kbo/app-bundle/latest.json
```

## Failure Boundaries

- fetch 실패: raw snapshot 없음, normalize 미실행
- parse 실패: raw snapshot은 남기되 normalized publish 중단
- normalize/validate 실패: parser contract 점검, patch로 보정 불가한지 확인
- patch 충돌: raw나 parsed를 바꾸지 말고 patch 파일만 수정

## Next Automation Step

- cron/scheduler로 source fetch 분리
- 경기 시간대에는 scoreboard cadence를 더 짧게
- standings와 schedule normalize 후 simulation baseline refresh
- 관리자 화면에서 raw snapshot diff와 normalized publish history 조회
