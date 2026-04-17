# Cron Plan

모든 시간 설명은 KST 기준이며, workflow 파일에는 UTC cron으로 변환해 적었다.

## kbo-hot-poller
- KST: 12:03-23:58, 5분 간격
- UTC cron: `3-58/5 3-14 * * *`
- 역할:
  - phase 판단
  - hot path refresh
  - live snapshot publish
  - finalization 시 full recompute
- no-op 예시:
  - 경기 없음
  - active window 밖
  - semantic change 없음

## kbo-nightly-reconcile
- KST: 매일 00:17
- UTC cron: `17 15 * * *`
- 역할:
  - today/yesterday authoritative refetch
  - standings / scoreboard / bundle 재정합
  - baseline simulation 재계산

## kbo-daily-preflight
- KST: 매일 07:12
- UTC cron: `12 22 * * *`
- 역할:
  - 경기일 아침 baseline refresh
  - standings / register / movement refresh
  - baseline input meaningful change 시 sim rerun

## kbo-weekly-cold-sync
- KST: 매주 월요일 04:11
- UTC cron: `11 19 * * 0`
- 역할:
  - team history
  - historical team records
  - rules metadata
  - optional enrichment
