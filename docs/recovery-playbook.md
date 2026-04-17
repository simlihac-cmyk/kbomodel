# Recovery Playbook

## Source Outage
- English scoreboard/standings가 실패하면 Korean fallback을 우선 검토한다.
- schedule baseline은 Korean service가 우선이므로, 이 경로가 막히면 current hot path 품질이 크게 낮아진다.

## Partial Publish Rollback
- `data/normalized/kbo/manifests/*`의 마지막 정상 버전을 확인한다.
- `data/normalized/kbo/publish/*`와 `app-bundle/latest.json`을 마지막 정상 snapshot으로 되돌린다.
- 외부 blob 모드면 동일한 상대 경로를 blob storage에서 직전 정상 버전으로 되돌린다.
- blob-plan 모드면 planner가 가리키는 same-key object를 직전 정상 버전으로 복구한다.

## Stale Standings Fallback
- hot poller는 실패하더라도 마지막 성공 manifest를 남긴다.
- frontend는 stale freshness badge를 보여주도록 계약이 준비돼 있다.

## Manual Patch Emergency
- 일정/명칭 문제는 `data/manual-patches/kbo/source-overrides.json`
- 운영 보정은 `data/kbo/manual-adjustments.json`
- patch는 raw를 고치지 않고 normalized 이후에만 덮는다.

## Simulation Emergency Policy
- live inning drift가 길어지면 simulation은 stale로 두고 rerun을 미룬다.
- final state transition 이후 reconcile에서 authoritative rerun을 한다.
