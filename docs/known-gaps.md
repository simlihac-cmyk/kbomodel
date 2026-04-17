# Known Gaps

- `data/kbo/bundle.json` bootstrap 데이터는 개발용 기준점이며, published bundle의 공식 truth를 대체하지 않는다.
- 현재 시즌은 전체 144경기 완주 스케줄이 아니라 시뮬레이션과 UX 검증용 subset이다.
- probable starter, weather, travel, injury depth chart는 아직 정교하게 반영하지 않았다.
- admin은 조회와 manual adjustment 저장까지는 되지만, 전체 CRUD 폼은 아직 단순하다.
- 로그인 rate limit는 현재 프로세스 메모리 기반이라 다중 인스턴스 production 환경에선 더 강한 저장소 기반 제한이 필요하다.
- player/game archive는 공식 경기·선수 ingest가 확보된 범위까지만 연다.
- chart는 lightweight CSS 기반이며 대형 시각화 라이브러리는 아직 넣지 않았다.
