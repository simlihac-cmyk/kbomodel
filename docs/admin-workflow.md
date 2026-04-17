# Admin Workflow

## 현재 운영 방식
- publish 입력용 bootstrap source는 `data/kbo/bundle.json`
- 앱이 읽는 최신 bundle은 `data/normalized/kbo/app-bundle/latest.json`
- 수동 보정은 `data/kbo/manual-adjustments.json`
- 일정 보정은 `data/kbo/schedule-patches.json`
- 시즌 메타 보정은 `data/kbo/season-meta-patches.json`
- 팀 브랜드 보정은 `data/kbo/team-brand-patches.json`
- raw ingest preview 기본 파일은 `data/kbo/raw/manual-import-preview.json`
- 여러 raw snapshot은 `data/kbo/raw/*.json`
- normalize 후보 큐는 `data/kbo/import-candidates.json`
- `/admin/*`는 관리자 로그인과 세션 쿠키가 있어야 접근 가능

## 관리자 레이어 역할
- 시즌 메타데이터 확인
- 시즌 메타데이터 patch 저장
- 브랜드/구장 구조 확인 및 TeamBrand patch 저장
- 일정/경기 상태 patch 저장
- import preview에서 raw vs normalized 비교
- import preview에서 changed row를 schedule patch로 반영
- import preview에서 new row를 normalize 후보 큐로 저장
- normalize 후보 큐에서 개별 제거 / source 단위 비우기
- manual adjustment 저장
- audit log 확인

## 보안 원칙
- 관리자 UI 노출과 서버 write 권한은 별개로 본다.
- middleware로 경로를 막고, server action에서도 세션을 다시 확인한다.
- admin 비밀번호는 hash로 보관하고 session secret은 env로 분리한다.
- write action과 로그인 이벤트는 `data/kbo/audit-log.json`에 남긴다.

## 왜 file-backed adapter부터 시작했는가
- 초기 실행 가능성이 가장 높다.
- bootstrap bundle와 manual patch를 함께 버전 관리할 수 있다.
- repository contract를 먼저 고정해 두면 DB 전환 시 UI 수정량이 작다.

## DB 전환 시 우선 순위
1. `KboRepository` 인터페이스를 유지한 채 DB adapter 추가
2. manual adjustment / season meta / team brand / schedule patch를 테이블로 분리
3. ingest raw / normalized staging 테이블 추가
4. admin action을 transaction 기반으로 전환
