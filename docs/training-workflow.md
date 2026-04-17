# Training Workflow

## 목적
- 학습은 성능 좋은 노트북에서 수행한다.
- 운영/배포는 기존 Mac 환경을 유지한다.
- 결과는 검증 가능한 번들 형태로 다시 Mac에 반입한다.

## 1. Mac에서 학습 입력 패키지 만들기
```bash
pnpm training:kbo:export
```

- 기본 출력 경로: `artifacts/kbo-training-packages/<package-id>/`
- 기본 압축 파일: `artifacts/kbo-training-packages/<package-id>.tar.gz`
- 포함 데이터:
  - `data/normalized/kbo/history-training`
  - `data/normalized/kbo/training-corpus`
- `manifest.json`에는 commit hash, 연도, 추천 split, 파일 checksum이 들어간다.
- 학습 입력에는 `실측 원본값`과 그 원본에서 `결정적으로 계산되는 파생값`만 포함한다.
- 과거 원본이 없는 예상 선발, 부상, 임의 선수 영향값은 학습 코퍼스에 넣지 않는다.

## 2. 노트북으로 가져가기
- repo는 같은 commit으로 clone하거나 현재 작업 폴더를 동기화한다.
- 위에서 만든 `tar.gz`를 노트북으로 옮긴다.
- 압축을 풀고 학습 코드는 같은 commit 기준으로 실행한다.

### git으로 가져갈 때 권장 범위
- `git clone` 또는 새 repo를 만들어 코드와 학습 코퍼스를 함께 맞춘다.
- `pnpm-lock.yaml`은 반드시 git에 포함한다.
- 학습용으로 꼭 필요한 데이터는 아래 두 경로다.
  - `data/normalized/kbo/history-training`
  - `data/normalized/kbo/training-corpus`
- 아래 산출물은 git에 넣지 않는다.
  - `node_modules/`
  - `.next/`
  - `artifacts/`
  - `.env.local`
  - `tsconfig.tsbuildinfo`

### git add 예시
```bash
git add \
  .gitignore \
  README.md \
  package.json \
  pnpm-lock.yaml \
  tsconfig.json \
  next.config.ts \
  tailwind.config.ts \
  postcss.config.js \
  middleware.ts \
  vitest.config.ts \
  vitest.setup.ts \
  src \
  scripts \
  docs \
  tests \
  data/normalized/kbo/history-training \
  data/normalized/kbo/training-corpus
```

### 노트북에서 받기
```bash
git clone <repo-url>
cd <repo-dir>
pnpm install
pnpm training:kbo:fit
```

## 3. 노트북에서 실제 학습 실행
```bash
pnpm training:kbo:fit -- --max-rounds=10 --starts=5
```

- 기본 입력 경로: `data/normalized/kbo/training-corpus`
- 기본 split:
  - fit years: `suggestedSplit.trainYears` 중 마지막 해를 제외한 연도
  - tune years: `suggestedSplit.trainYears`의 마지막 해
  - validation years: `suggestedSplit.validationYears`
- 기본 출력 경로: `artifacts/kbo-training-results/<fit-id>/`
- 산출 파일:
  - `parameters.json`
  - `backtest-summary.json`
- 현재 학습기는 `팀 상태 -> 전력 합성(strength params) -> 경기 확률(game params)`을 단계적으로 같이 튜닝한다.
- 기본적으로 `multi-start`와 `rolling validation`을 함께 사용한다.
  - `starts=5`면 서로 다른 초기값 5개로 학습을 반복한다.
  - rolling validation은 `2023`, `2024`, `2025`처럼 뒤 연도를 순차 홀드아웃으로 다시 확인한다.
- 시작점 수를 줄이고 싶으면 `--starts=3`, rolling validation을 끄고 싶으면 `--no-rolling-validation`을 붙인다.
- strength 학습 대상에는 아래가 포함된다.
  - `currentWeight / priorWeight` 곡선
  - 타선/실점 억제/불펜 proxy 신호 계수
  - 최근 폼 가중치
  - 홈 이점 split 반영치
  - confidence 계산 계수
- 득실차 가중치는 강한 고정값으로 두지 않고, `0`까지 내려갈 수 있게 학습 탐색 범위를 열어뒀다.
- game 학습 대상에는 기존과 같이 기대득점/홈 어드밴티지/tie 관련 계수가 포함된다.
- 학습 결과는 멀티클래스 log-loss 기준으로 선택한다.

## 4. 노트북에서 결과 번들 포장
- 결과 디렉터리에 최소한 아래 파일을 둔다.
  - `parameters.json`
  - `backtest-summary.json`
- 선택 파일:
  - `calibration.json`
  - `notes.md`
  - 추가 리포트 파일

```bash
pnpm training:kbo:pack-results \
  --source-package=/path/to/exported/manifest.json \
  --results-dir=/path/to/result-dir
```

- 이 명령은 결과 파일 checksum을 계산하고 `manifest.json`을 만든다.

## 5. Mac으로 결과 반입
```bash
pnpm training:kbo:import-results -- --from=/path/to/result-dir
```

- 결과는 `data/normalized/kbo/model-training/bundles/<bundle-id>/`로 복사된다.
- 최신 반입 정보는 아래 파일에 기록된다.
  - `data/normalized/kbo/model-training/registry.json`
  - `data/normalized/kbo/model-training/latest.json`

## 6. git으로 가져온 결과를 운영 파라미터로 승격
학습 결과를 `trained-results/.../parameters.json` 형태로 git으로 가져왔다면 아래 명령으로 현재 운영 파라미터 파일을 갱신한다.

```bash
pnpm training:kbo:promote -- --from=trained-results/<result-dir>/parameters.json
```

- 이 명령은 아래 두 파일을 같이 갱신한다.
  - `src/lib/sim/kbo/current-strength-model-parameters.ts`
  - `src/lib/sim/kbo/current-model-parameters.ts`
- 이후 `pnpm test`, `pnpm build`로 확인한 뒤 배포하면 된다.

## 운영 원칙
- 학습 입력 패키지와 결과 번들은 항상 manifest + checksum 기준으로 이동한다.
- 노트북 학습 중에는 입력 데이터를 바꾸지 않는다.
- 운영 반영은 `latest.json`에 올라간 번들을 기준으로 다음 단계에서 연결한다.
