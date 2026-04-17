# Ingest Plan

## 목표
- 자동 수집이 가능하면 활용
- 수동 보정이 가능한 구조 유지
- raw ingest와 normalized model을 분리

## 권장 단계
1. 공식 일정/결과 raw fetch
2. raw JSON snapshot 저장
3. normalize script로 `Series`, `Game`, `BoxScore`, `Stat`로 변환
4. validation with Zod
5. new row는 `import-candidates.json` 같은 후보 큐로 분리
6. manual patch overlay 적용
7. repository adapter로 노출

## 현재 상태
- `scripts/bootstrap-kbo-data.mjs`로 bootstrap bundle 생성
- `scripts/validate-kbo-data.ts`로 parse 검증
- `data/kbo/raw/manual-import-preview.json`로 preview shape 제공
- `/admin/imports`에서 changed row patch 적용과 new row 후보 큐 저장 가능
