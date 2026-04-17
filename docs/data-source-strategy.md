# KBO Data Source Strategy

## Final Recommendation

이 저장소의 기본 source-of-truth 정책은 아래로 확정한다.

1. **Official KBO Korean site = baseline truth**
   - 규정, 팀 계보, 선수 등록/이동, 역사 기록, 팀 타격/투수 기록은 한국어 공식 페이지를 기준으로 본다.
2. **Official KBO English site = parse-friendly mirror**
   - 일정, 스코어보드, 순위는 구조가 더 단순하면 영문 페이지를 우선 파싱한다.
   - 선수 개인 시즌 기록은 한국어 direct leaders 페이지가 단순 fetch에서 막히는 범위가 있어, 현재는 영문 `Top5` + 개별 `Player Summary` 조합을 공식 partial source로 사용한다.
   - 다만 baseline truth tier는 여전히 공식 KBO이며, 영문 페이지는 “공식 mirror”로 취급한다.
   - 예외: **시즌 전체 월간 일정 수집은 영문 Daily Schedule이 일자 단위 화면만 제공하므로, 한국어 공식 일정 서비스(JSON)를 운영 기본값으로 사용한다.**
3. **Statiz = optional enrichment only**
   - WAR류, 세이버 지표, 추가 leaderboards 같은 비핵심 강화에만 사용한다.
   - Statiz가 꺼져도 사이트 핵심 기능은 그대로 동작해야 한다.
4. **Manual patch layer = final operational override**
   - 우천 순연, 재편성, 표기 오류, 영문/국문 이름 불일치, 구장 alias, 모델용 메모는 patch로 덮는다.
   - raw snapshot은 절대 수정하지 않는다.

## Why Official KBO Is Baseline Truth

- KBO 전용 제품에서 순위, 일정, 경기 결과, 규정의 기준은 공식 KBO여야 한다.
- 팀 전력 baseline도 공식 팀 타격/투수 기록에서 바로 읽어야, 시뮬레이션 입력과 기록실이 같은 truth를 바라보게 된다.
- 현재 시즌 레이스/시뮬레이션은 한 경기의 순연, 무승부, 재편성에도 민감하므로 비공식 source를 baseline으로 둘 수 없다.
- 향후 관리자 보정과 audit log를 운영하려면 “무엇을 공식 원본으로 봤는가”가 먼저 고정되어야 한다.

## Why The Official English Mirror Is Useful

- 영문 일정, 스코어보드, 순위는 일반적으로 table/card 구조가 단순해서 HTML 파서 계약을 안정적으로 시작하기 좋다.
- Korean page는 사람이 읽기에는 좋지만, JS 의존이나 레이아웃 복잡도가 더 높을 수 있다.
- 따라서 **scoreboard / standings는 English-first, Korean-fallback** 전략을 채택한다.
- 다만 **schedule-calendar는 concrete blocker가 확인되었다.**
  - 영문 `Daily Schedule`은 특정 일자 화면에는 적합하지만, 현재 시즌 나머지 월 일정을 이어서 수집하는 용도로는 시즌 전체 범위를 안정적으로 제공하지 않는다.
  - 운영용 current-season ingest는 한국어 공식 일정 서비스(`/ws/Schedule.asmx/GetScheduleList`)를 우선 사용하고, 영문 일정 페이지는 cross-check와 parser fixture 용도로 유지한다.

## Why Statiz Is Enrichment Only

- Statiz는 훌륭한 분석 source이지만 공식 baseline이 아니다.
- 이 앱의 핵심인 `현재 순위`, `남은 일정`, `경기 결과`, `포스트시즌 경로`, `관리자 정정`은 비공식 source에 의존하면 안 된다.
- Statiz는 아래 용도에만 허용한다.
  - optional WAR-like signals
  - 추가 팀/선수 세이버 지표
  - enrichment-only model features

## What We Will Not Ingest

- 저작권이 걸린 동영상/이미지 asset 로컬 저장
- 비공식 source의 standings/schedule/result를 baseline truth로 저장
- UI가 raw HTML parse object를 직접 읽는 구조
- raw snapshot을 덮어써서 “수정된 진실”처럼 보이게 만드는 운영 방식

## Source Trust Tiers

| Tier | Meaning | Sources |
| --- | --- | --- |
| `official-baseline` | 도메인 truth 기준 | KBO Korean official |
| `official-mirror` | 공식 mirror, 파싱 우선 가능 | KBO English official |
| `optional-enrichment` | 꺼져도 제품 핵심 동작 유지 | Statiz |

## Manual Patches

Manual patch는 아래를 처리한다.

- English/Korean team alias mismatch
- venue naming mismatch
- postponed / rescheduled metadata correction
- source parser miss 보정
- player/team naming inconsistency
- season note / rules note / 운영 메모
- 공식 팀 타격/투수 기록이 없는 기간의 모델 메모

Patch는 항상 아래 순서를 따른다.

1. raw snapshot 저장
2. parser 실행
3. normalizer 실행
4. **manual patch overlay**
5. normalized publish

## Operational Risks

- 공식 HTML 구조 변경
- 영문 mirror의 업데이트 지연 또는 필드 누락
- 동일 경기의 game key, 링크 구조, reschedule 표기 변화
- 역사 페이지의 시즌별 레이아웃 차이
- 한국어/영문 팀명, 구장명 표기 불일치

대응 원칙:

- fetch와 parse를 분리한다.
- source별 parser version을 메타데이터에 남긴다.
- fixture-driven parser 계약 테스트를 유지한다.
- raw HTML snapshot을 날짜/키 단위로 디스크에 남긴다.
- patch layer는 diff-friendly JSON으로 유지한다.

## Migration Path To Automated Ingestion

현재 단계:

- file-backed raw snapshot
- fixture-driven parser
- file-backed normalized outputs
- manual patch overlay

다음 단계:

1. cron/job으로 `fetch-kbo-source` 자동화
2. dataset별 normalize job 분리
3. import preview와 raw snapshot browsing 연동
4. PostgreSQL/Drizzle 또는 Prisma 기반 repository로 교체
5. simulation baseline refresh job 연결

## Open Questions

- 영문 Scoreboard가 시즌 전체 linescore와 pitcher result를 항상 충분히 주는지 live verification 필요
- Korean GameCenter에서 box score 세부 필드까지 headless 없이 안정 파싱 가능한지 확인 필요
- 한국어 일정 서비스의 향후 응답 스키마 변경 여부를 계속 감시해야 함
- roster movement 페이지가 injury/rehab/FA를 한 페이지에서 일관되게 주는지 추가 확인 필요
- weather page의 same-day availability와 경기별 연결 키 확인 필요
- Statiz enrichment를 실제로 어느 필드까지 쓸지 모델 단계에서 별도 결정 필요
