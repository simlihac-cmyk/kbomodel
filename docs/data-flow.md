# Data Flow

## Layered Flow
1. Fetch
2. Parse
3. Normalize
4. Patch
5. Derive
6. Simulation Input Build
7. Publish

## 현재 repo 기준 설명
- raw snapshots: `data/raw/kbo`
- normalized outputs: `data/normalized/kbo/*`
- published bundle: `data/normalized/kbo/app-bundle/latest.json`
- automation publish snapshots: `data/normalized/kbo/publish/*`
- manifests: `data/normalized/kbo/manifests/*`

## Dataset Entry Points
- schedule: official-ko schedule service -> `series-games`
- standings: official-en standings -> `standings`
- scoreboard: official-en scoreboard -> `scoreboard`
- player register-all: official-ko register-all -> `players`
- team history: official-ko team-history -> `franchise-lineage`
- historical team record: official-ko historical record -> `historical-team-records`

## Hot-path only stages
- scoreboard refresh
- today snapshot rebuild
- current manifest update
- live scoreboard publish

## Full recompute stages
- published bundle rebuild
- simulation input rebuild
- simulation result rebuild
- simulation manifest update
