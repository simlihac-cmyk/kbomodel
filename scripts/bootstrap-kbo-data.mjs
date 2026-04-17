import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data", "kbo");

const teamCatalog = [
  {
    franchiseId: "doosan",
    slug: "doosan-bears",
    canonicalNameKo: "두산 베어스",
    shortNameKo: "두산",
    regionKo: "서울",
    venueId: "jamsil",
    championships: 6,
    brandHistorySummary: "OB 시절을 거쳐 두산 베어스로 이어진 서울 프랜차이즈.",
    currentBrandId: "doosan-bears",
    historicBrandId: "doosan-bears",
    displayNameKo: "두산 베어스",
    shortCode: "DOO",
    primaryColor: "#111827",
    secondaryColor: "#c09f6b",
    wordmarkText: "BEARS",
    managerNameKo: "김윤서",
    priors: { offenseRating: 101, starterRating: 100, bullpenRating: 98 },
    currentStrength: 100,
    hitter: { playerId: "doo-h-1", slug: "doo-kim-junho", nameKo: "김준호", nameEn: "Jun-ho Kim" },
    pitcher: { playerId: "doo-p-1", slug: "doo-lee-hyunjin", nameKo: "이현진", nameEn: "Hyun-jin Lee" },
  },
  {
    franchiseId: "lg",
    slug: "lg-twins",
    canonicalNameKo: "LG 트윈스",
    shortNameKo: "LG",
    regionKo: "서울",
    venueId: "jamsil",
    championships: 3,
    brandHistorySummary: "MBC 청룡 계보를 잇는 서울 프랜차이즈.",
    currentBrandId: "lg-twins",
    historicBrandId: "lg-twins",
    displayNameKo: "LG 트윈스",
    shortCode: "LG",
    primaryColor: "#9d174d",
    secondaryColor: "#2d3748",
    wordmarkText: "TWINS",
    managerNameKo: "박성호",
    priors: { offenseRating: 105, starterRating: 106, bullpenRating: 103 },
    currentStrength: 108,
    hitter: { playerId: "lg-h-1", slug: "lg-choi-seungho", nameKo: "최승호", nameEn: "Seung-ho Choi" },
    pitcher: { playerId: "lg-p-1", slug: "lg-han-jihoon", nameKo: "한지훈", nameEn: "Ji-hoon Han" },
  },
  {
    franchiseId: "kia",
    slug: "kia-tigers",
    canonicalNameKo: "KIA 타이거즈",
    shortNameKo: "KIA",
    regionKo: "광주",
    venueId: "gwangju",
    championships: 12,
    brandHistorySummary: "해태 시절을 포함해 KBO 최다 한국시리즈 우승 계보를 가진 프랜차이즈.",
    currentBrandId: "kia-tigers",
    historicBrandId: "kia-tigers",
    displayNameKo: "KIA 타이거즈",
    shortCode: "KIA",
    primaryColor: "#d62828",
    secondaryColor: "#1f2937",
    wordmarkText: "TIGERS",
    managerNameKo: "장태성",
    priors: { offenseRating: 104, starterRating: 102, bullpenRating: 101 },
    currentStrength: 104,
    hitter: { playerId: "kia-h-1", slug: "kia-yoon-seongmin", nameKo: "윤성민", nameEn: "Seong-min Yoon" },
    pitcher: { playerId: "kia-p-1", slug: "kia-kang-dohyuk", nameKo: "강도혁", nameEn: "Do-hyuk Kang" },
  },
  {
    franchiseId: "samsung",
    slug: "samsung-lions",
    canonicalNameKo: "삼성 라이온즈",
    shortNameKo: "삼성",
    regionKo: "대구",
    venueId: "daegu",
    championships: 8,
    brandHistorySummary: "대구를 대표하는 전통 프랜차이즈.",
    currentBrandId: "samsung-lions",
    historicBrandId: "samsung-lions",
    displayNameKo: "삼성 라이온즈",
    shortCode: "SAM",
    primaryColor: "#1d4ed8",
    secondaryColor: "#93c5fd",
    wordmarkText: "LIONS",
    managerNameKo: "정민석",
    priors: { offenseRating: 100, starterRating: 99, bullpenRating: 99 },
    currentStrength: 99,
    hitter: { playerId: "sam-h-1", slug: "sam-park-joowon", nameKo: "박주원", nameEn: "Joo-won Park" },
    pitcher: { playerId: "sam-p-1", slug: "sam-song-jaemin", nameKo: "송재민", nameEn: "Jae-min Song" },
  },
  {
    franchiseId: "lotte",
    slug: "lotte-giants",
    canonicalNameKo: "롯데 자이언츠",
    shortNameKo: "롯데",
    regionKo: "부산",
    venueId: "sajik",
    championships: 2,
    brandHistorySummary: "부산을 대표하는 원년 프랜차이즈 중 하나.",
    currentBrandId: "lotte-giants",
    historicBrandId: "lotte-giants",
    displayNameKo: "롯데 자이언츠",
    shortCode: "LOT",
    primaryColor: "#0f172a",
    secondaryColor: "#60a5fa",
    wordmarkText: "GIANTS",
    managerNameKo: "류진호",
    priors: { offenseRating: 99, starterRating: 96, bullpenRating: 95 },
    currentStrength: 96,
    hitter: { playerId: "lot-h-1", slug: "lot-jung-hyobin", nameKo: "정효빈", nameEn: "Hyo-bin Jung" },
    pitcher: { playerId: "lot-p-1", slug: "lot-kim-taeyul", nameKo: "김태율", nameEn: "Tae-yul Kim" },
  },
  {
    franchiseId: "hanwha",
    slug: "hanwha-eagles",
    canonicalNameKo: "한화 이글스",
    shortNameKo: "한화",
    regionKo: "대전",
    venueId: "daejeon",
    championships: 1,
    brandHistorySummary: "빙그레 시절을 포함한 대전 프랜차이즈.",
    currentBrandId: "hanwha-eagles",
    historicBrandId: "hanwha-eagles",
    displayNameKo: "한화 이글스",
    shortCode: "HAN",
    primaryColor: "#ea580c",
    secondaryColor: "#111827",
    wordmarkText: "EAGLES",
    managerNameKo: "임준수",
    priors: { offenseRating: 98, starterRating: 102, bullpenRating: 97 },
    currentStrength: 101,
    hitter: { playerId: "han-h-1", slug: "han-noh-jisoo", nameKo: "노지수", nameEn: "Ji-soo Noh" },
    pitcher: { playerId: "han-p-1", slug: "han-yu-seonho", nameKo: "유선호", nameEn: "Seon-ho Yu" },
  },
  {
    franchiseId: "kt",
    slug: "kt-wiz",
    canonicalNameKo: "KT 위즈",
    shortNameKo: "KT",
    regionKo: "수원",
    venueId: "suwon",
    championships: 1,
    brandHistorySummary: "창단 이후 빠르게 상위권 경쟁에 합류한 신흥 프랜차이즈.",
    currentBrandId: "kt-wiz",
    historicBrandId: "kt-wiz",
    displayNameKo: "KT 위즈",
    shortCode: "KT",
    primaryColor: "#111827",
    secondaryColor: "#ef4444",
    wordmarkText: "WIZ",
    managerNameKo: "손기범",
    priors: { offenseRating: 101, starterRating: 101, bullpenRating: 100 },
    currentStrength: 102,
    hitter: { playerId: "kt-h-1", slug: "kt-shin-woojin", nameKo: "신우진", nameEn: "Woo-jin Shin" },
    pitcher: { playerId: "kt-p-1", slug: "kt-oh-minjae", nameKo: "오민재", nameEn: "Min-jae Oh" },
  },
  {
    franchiseId: "nc",
    slug: "nc-dinos",
    canonicalNameKo: "NC 다이노스",
    shortNameKo: "NC",
    regionKo: "창원",
    venueId: "changwon",
    championships: 1,
    brandHistorySummary: "창원 연고의 현대적 운영 색이 강한 프랜차이즈.",
    currentBrandId: "nc-dinos",
    historicBrandId: "nc-dinos",
    displayNameKo: "NC 다이노스",
    shortCode: "NC",
    primaryColor: "#1f4b8f",
    secondaryColor: "#d4af37",
    wordmarkText: "DINOS",
    managerNameKo: "오세찬",
    priors: { offenseRating: 97, starterRating: 98, bullpenRating: 96 },
    currentStrength: 97,
    hitter: { playerId: "nc-h-1", slug: "nc-moon-dohyun", nameKo: "문도현", nameEn: "Do-hyun Moon" },
    pitcher: { playerId: "nc-p-1", slug: "nc-ryu-hanbin", nameKo: "류한빈", nameEn: "Han-bin Ryu" },
  },
  {
    franchiseId: "ssg",
    slug: "ssg-landers",
    canonicalNameKo: "SSG 랜더스",
    shortNameKo: "SSG",
    regionKo: "인천",
    venueId: "incheon",
    championships: 5,
    brandHistorySummary: "쌍방울-해태 계보가 아닌 SK 와이번스에서 SSG 랜더스로 이어진 인천 프랜차이즈.",
    currentBrandId: "ssg-landers",
    historicBrandId: "sk-wyverns",
    displayNameKo: "SSG 랜더스",
    shortCode: "SSG",
    primaryColor: "#b91c1c",
    secondaryColor: "#f5d0fe",
    wordmarkText: "LANDERS",
    managerNameKo: "백정현",
    priors: { offenseRating: 100, starterRating: 97, bullpenRating: 99 },
    currentStrength: 98,
    hitter: { playerId: "ssg-h-1", slug: "ssg-cho-yunho", nameKo: "조윤호", nameEn: "Yun-ho Cho" },
    pitcher: { playerId: "ssg-p-1", slug: "ssg-lim-joon", nameKo: "임준", nameEn: "Joon Lim" },
  },
  {
    franchiseId: "heroes",
    slug: "kiwoom-heroes",
    canonicalNameKo: "키움 히어로즈",
    shortNameKo: "키움",
    regionKo: "서울",
    venueId: "gocheok",
    championships: 0,
    brandHistorySummary: "우리-서울-넥센-키움으로 이어지는 서울 프랜차이즈.",
    currentBrandId: "kiwoom-heroes",
    historicBrandId: "nexen-heroes",
    displayNameKo: "키움 히어로즈",
    shortCode: "KIW",
    primaryColor: "#7c2d12",
    secondaryColor: "#f59e0b",
    wordmarkText: "HEROES",
    managerNameKo: "문지환",
    priors: { offenseRating: 95, starterRating: 94, bullpenRating: 93 },
    currentStrength: 94,
    hitter: { playerId: "kiw-h-1", slug: "kiw-bae-siwon", nameKo: "배시원", nameEn: "Si-won Bae" },
    pitcher: { playerId: "kiw-p-1", slug: "kiw-choi-dongha", nameKo: "최동하", nameEn: "Dong-ha Choi" },
  },
];

const venues = [
  { venueId: "jamsil", slug: "jamsil", nameKo: "잠실야구장", cityKo: "서울", openedYear: 1982, capacity: 25000, dome: false },
  { venueId: "gocheok", slug: "gocheok-sky-dome", nameKo: "고척스카이돔", cityKo: "서울", openedYear: 2015, capacity: 16744, dome: true },
  { venueId: "gwangju", slug: "gwangju-kia-champions-field", nameKo: "광주-KIA 챔피언스 필드", cityKo: "광주", openedYear: 2014, capacity: 20500, dome: false },
  { venueId: "daegu", slug: "daegu-samsung-lions-park", nameKo: "대구 삼성 라이온즈 파크", cityKo: "대구", openedYear: 2016, capacity: 24000, dome: false },
  { venueId: "sajik", slug: "sajik-baseball-stadium", nameKo: "사직야구장", cityKo: "부산", openedYear: 1985, capacity: 22600, dome: false },
  { venueId: "daejeon", slug: "daejeon-ballpark", nameKo: "대전 한화생명 볼파크", cityKo: "대전", openedYear: 2025, capacity: 20000, dome: false },
  { venueId: "suwon", slug: "suwon-kt-wiz-park", nameKo: "수원 KT 위즈 파크", cityKo: "수원", openedYear: 2015, capacity: 18700, dome: false },
  { venueId: "changwon", slug: "changwon-nc-park", nameKo: "창원 NC 파크", cityKo: "창원", openedYear: 2019, capacity: 22000, dome: false },
  { venueId: "incheon", slug: "incheon-landers-field", nameKo: "인천 SSG 랜더스필드", cityKo: "인천", openedYear: 2002, capacity: 23000, dome: false },
];

const teamBrands = [
  ...teamCatalog.map((team) => ({
    brandId: team.currentBrandId,
    franchiseId: team.franchiseId,
    displayNameKo: team.displayNameKo,
    shortNameKo: team.shortNameKo,
    shortCode: team.shortCode,
    seasonStartYear: team.franchiseId === "ssg" ? 2021 : team.franchiseId === "heroes" ? 2019 : 1982,
    seasonEndYear: null,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    wordmarkText: team.wordmarkText,
    logoPath: `/logos/${team.currentBrandId}.svg`,
    notes: `${team.displayNameKo} 현재 브랜드`,
  })),
  {
    brandId: "sk-wyverns",
    franchiseId: "ssg",
    displayNameKo: "SK 와이번스",
    shortNameKo: "SK",
    shortCode: "SK",
    seasonStartYear: 2000,
    seasonEndYear: 2020,
    primaryColor: "#e11d48",
    secondaryColor: "#fb7185",
    wordmarkText: "WYVERNS",
    logoPath: "/logos/sk-wyverns.svg",
    notes: "SSG 이전 브랜드",
  },
  {
    brandId: "nexen-heroes",
    franchiseId: "heroes",
    displayNameKo: "넥센 히어로즈",
    shortNameKo: "넥센",
    shortCode: "NEX",
    seasonStartYear: 2010,
    seasonEndYear: 2018,
    primaryColor: "#6b21a8",
    secondaryColor: "#f59e0b",
    wordmarkText: "HEROES",
    logoPath: "/logos/nexen-heroes.svg",
    notes: "키움 이전 브랜드",
  },
];

const seasons = [
  {
    seasonId: "kbo-2026",
    year: 2026,
    label: "2026 신한 SOL뱅크 KBO 리그",
    status: "ongoing",
    phase: "regular",
    rulesetId: "kbo-rules-2026",
    openingDay: "2026-03-21",
    regularSeasonStart: "2026-03-21",
    regularSeasonEnd: "2026-10-03",
    postseasonStart: "2026-10-06",
    postseasonEnd: "2026-11-01",
    updatedAt: "2026-04-15T09:00:00+09:00",
  },
  {
    seasonId: "kbo-2025",
    year: 2025,
    label: "2025 신한 SOL뱅크 KBO 리그",
    status: "completed",
    phase: "completed",
    rulesetId: "kbo-rules-2025",
    openingDay: "2025-03-22",
    regularSeasonStart: "2025-03-22",
    regularSeasonEnd: "2025-10-01",
    postseasonStart: "2025-10-04",
    postseasonEnd: "2025-11-02",
    updatedAt: "2025-11-02T23:00:00+09:00",
  },
  {
    seasonId: "kbo-2017",
    year: 2017,
    label: "2017 타이어뱅크 KBO 리그",
    status: "completed",
    phase: "completed",
    rulesetId: "kbo-rules-2017",
    openingDay: "2017-03-31",
    regularSeasonStart: "2017-03-31",
    regularSeasonEnd: "2017-10-03",
    postseasonStart: "2017-10-05",
    postseasonEnd: "2017-10-30",
    updatedAt: "2017-10-30T23:00:00+09:00",
  },
];

const rulesets = [
  {
    rulesetId: "kbo-rules-2026",
    label: "2026 KBO 규정",
    regularSeasonGamesPerTeam: 144,
    gamesPerOpponent: 16,
    tiesAllowed: true,
    tiebreakerOrder: ["headToHead", "runDifferential", "runScored", "teamCode"],
    specialPlayoffGamePositions: [],
    postseasonFormat: [
      { round: "wildcard", label: "와일드카드 결정전", bestOf: 3, higherSeedAdvantageWins: 1 },
      { round: "semipo", label: "준플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "po", label: "플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "ks", label: "한국시리즈", bestOf: 7, higherSeedAdvantageWins: 0 },
    ],
    notes: ["동률은 상대전적 우선", "와일드카드는 4위 팀 1승 어드밴티지"],
  },
  {
    rulesetId: "kbo-rules-2025",
    label: "2025 KBO 규정",
    regularSeasonGamesPerTeam: 144,
    gamesPerOpponent: 16,
    tiesAllowed: true,
    tiebreakerOrder: ["headToHead", "runDifferential", "runScored", "teamCode"],
    specialPlayoffGamePositions: [],
    postseasonFormat: [
      { round: "wildcard", label: "와일드카드 결정전", bestOf: 3, higherSeedAdvantageWins: 1 },
      { round: "semipo", label: "준플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "po", label: "플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "ks", label: "한국시리즈", bestOf: 7, higherSeedAdvantageWins: 0 },
    ],
    notes: ["완성 시즌 아카이브 seed", "실제 연동 시 공식 기록으로 대체"],
  },
  {
    rulesetId: "kbo-rules-2017",
    label: "2017 KBO 규정",
    regularSeasonGamesPerTeam: 144,
    gamesPerOpponent: 16,
    tiesAllowed: true,
    tiebreakerOrder: ["headToHead", "runDifferential", "runScored", "teamCode"],
    specialPlayoffGamePositions: [1, 5],
    postseasonFormat: [
      { round: "wildcard", label: "와일드카드 결정전", bestOf: 3, higherSeedAdvantageWins: 1 },
      { round: "semipo", label: "준플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "po", label: "플레이오프", bestOf: 5, higherSeedAdvantageWins: 0 },
      { round: "ks", label: "한국시리즈", bestOf: 7, higherSeedAdvantageWins: 0 },
    ],
    notes: ["1위, 5위 동률 시 결정전 가능성 반영"],
  },
];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(dateString, offset, hour = 18) {
  const date = new Date(`${dateString}T${String(hour).padStart(2, "0")}:30:00+09:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function getSeriesStatus(gameTimes, currentMoment) {
  const completedGames = gameTimes.filter((scheduledAt) => new Date(scheduledAt).getTime() <= currentMoment).length;
  if (completedGames >= gameTimes.length) {
    return {
      status: "final",
      actualLength: gameTimes.length,
      completedGames,
    };
  }

  if (completedGames > 0) {
    return {
      status: "in_progress",
      actualLength: completedGames,
      completedGames,
    };
  }

  return {
    status: "scheduled",
    actualLength: 0,
    completedGames: 0,
  };
}

function createRoundRobin(ids) {
  const teams = [...ids];
  const rounds = [];
  for (let round = 0; round < teams.length - 1; round += 1) {
    const roundPairs = [];
    for (let index = 0; index < teams.length / 2; index += 1) {
      const home = teams[index];
      const away = teams[teams.length - 1 - index];
      roundPairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(roundPairs);
    teams.splice(1, 0, teams.pop());
  }
  return rounds;
}

function createSeasonTeams() {
  return seasons.flatMap((season) =>
    teamCatalog.map((team) => ({
      seasonTeamId: `${season.seasonId}:${team.franchiseId}`,
      seasonId: season.seasonId,
      franchiseId: team.franchiseId,
      brandId:
        season.year <= 2018
          ? team.historicBrandId
          : team.currentBrandId,
      venueId: team.venueId,
      managerNameKo: team.managerNameKo,
      preseasonPriors: team.priors,
      manualAdjustments: [],
      preseasonOutlook:
        season.year === 2026
          ? `${team.shortNameKo}는 선발과 불펜 밸런스를 기준으로 중상위권 경쟁력 평가를 받았습니다.`
          : `${team.shortNameKo}의 시즌 전 기대치를 간단히 담은 seed 설명입니다.`,
    })),
  );
}

function createFranchises() {
  return teamCatalog.map((team) => ({
    franchiseId: team.franchiseId,
    slug: team.slug,
    canonicalNameKo: team.canonicalNameKo,
    shortNameKo: team.shortNameKo,
    regionKo: team.regionKo,
    foundedYear: team.franchiseId === "kt" ? 2013 : team.franchiseId === "nc" ? 2011 : 1982,
    primaryVenueId: team.venueId,
    championships: team.championships,
    brandHistorySummary: team.brandHistorySummary,
  }));
}

function createRegularSeasonSchedule(season, roundsToGenerate, options = {}) {
  const ids = teamCatalog.map((team) => team.franchiseId);
  const rounds = createRoundRobin(ids);
  const series = [];
  const games = [];
  const currentMoment = new Date(season.updatedAt).getTime();
  const roundSpacingDays = options.roundSpacingDays ?? (season.status === "ongoing" ? 4 : 5);
  const startOffsetDays = options.startOffsetDays ?? 0;

  for (let roundIndex = 0; roundIndex < roundsToGenerate; roundIndex += 1) {
    const startDate = new Date(`${season.regularSeasonStart}T00:00:00+09:00`);
    startDate.setDate(startDate.getDate() + roundIndex * roundSpacingDays + startOffsetDays);
    const startDateText = startDate.toISOString().slice(0, 10);
    const roundPairs = rounds[roundIndex % rounds.length];

    roundPairs.forEach(([homeFranchiseId, awayFranchiseId]) => {
      const homeTeam = teamCatalog.find((team) => team.franchiseId === homeFranchiseId);
      const awayTeam = teamCatalog.find((team) => team.franchiseId === awayFranchiseId);
      const seriesId = `${season.seasonId}-r${roundIndex + 1}-${homeFranchiseId}-${awayFranchiseId}`;
      const gameTimes = Array.from({ length: 3 }, (_, gameIndex) => addDays(startDateText, gameIndex));
      const { status, actualLength } =
        season.status === "completed"
          ? { status: "final", actualLength: 3 }
          : getSeriesStatus(gameTimes, currentMoment);
      const isNearRaceBand =
        season.year === 2026 &&
        roundIndex >= 4 &&
        roundIndex <= 8 &&
        Math.abs(homeTeam.currentStrength - awayTeam.currentStrength) <= 6;

      series.push({
        seriesId,
        seasonId: season.seasonId,
        type: "regular",
        homeSeasonTeamId: `${season.seasonId}:${homeFranchiseId}`,
        awaySeasonTeamId: `${season.seasonId}:${awayFranchiseId}`,
        plannedLength: 3,
        actualLength,
        startDate: startDateText,
        endDate: addDays(startDateText, 2, 23).slice(0, 10),
        venueId: homeTeam.venueId,
        status,
        importanceNote:
          isNearRaceBand
            ? `${homeTeam.shortNameKo}-${awayTeam.shortNameKo} 시리즈는 상위권 또는 5위선 판도에 바로 연결될 수 있습니다.`
            : undefined,
      });

      for (let gameIndex = 0; gameIndex < 3; gameIndex += 1) {
        const gameId = `${seriesId}-g${gameIndex + 1}`;
        const scheduledAt = gameTimes[gameIndex];
        const random = mulberry32(hashString(gameId));
        const isFinal =
          season.status === "completed" || new Date(scheduledAt).getTime() <= currentMoment;
        const tieChance = season.year >= 2025 ? 0.07 : 0.05;
        const homeBase = 4.5 + (homeTeam.currentStrength - 100) * 0.04 + random() * 1.8;
        const awayBase = 4.2 + (awayTeam.currentStrength - 100) * 0.04 + random() * 1.8;
        let homeScore = null;
        let awayScore = null;
        let isTie = false;

        if (isFinal) {
          homeScore = Math.max(0, Math.round(homeBase + (random() - 0.45) * 2));
          awayScore = Math.max(0, Math.round(awayBase + (random() - 0.55) * 2));
          if (Math.abs(homeScore - awayScore) <= 1 && random() < tieChance) {
            homeScore = awayScore = Math.max(homeScore, awayScore);
            isTie = true;
          } else if (homeTeam.currentStrength >= awayTeam.currentStrength && random() > 0.62) {
            homeScore += 1;
          } else if (awayTeam.currentStrength > homeTeam.currentStrength && random() > 0.62) {
            awayScore += 1;
          }
        }

        games.push({
          gameId,
          seasonId: season.seasonId,
          seriesId,
          homeSeasonTeamId: `${season.seasonId}:${homeFranchiseId}`,
          awaySeasonTeamId: `${season.seasonId}:${awayFranchiseId}`,
          scheduledAt,
          status:
            !isFinal && random() < 0.02 && season.status === "ongoing"
              ? "postponed"
              : isFinal
                ? "final"
                : "scheduled",
          originalScheduledAt: null,
          rescheduledFromGameId: null,
          homeScore,
          awayScore,
          innings: isFinal ? 9 : null,
          isTie,
          note:
            season.year === 2026 && !isFinal && gameIndex === 1
              ? "시나리오 편집용 남은 경기"
              : season.year === 2026 && !isFinal && random() < 0.03
                ? "우천 변수 가능성"
              : null,
          attendance: isFinal ? 13200 + Math.round(random() * 9000) : null,
          externalLinks: [
            {
              label: "KBO 요약",
              url: `https://example.com/kbo/${season.year}/games/${gameId}`,
            },
          ],
        });
      }
    });
  }

  return { series, games };
}

function createPostseasonSeries(season, standingsOrder) {
  const [first, second, third, fourth, fifth] = standingsOrder;
  const series = [];
  const games = [];

  const rounds = [
    { round: "wildcard", home: fourth, away: fifth, start: `${season.year}-10-03`, games: 2 },
    { round: "semipo", home: third, away: fourth, start: `${season.year}-10-07`, games: 4 },
    { round: "po", home: second, away: third, start: `${season.year}-10-14`, games: 5 },
    { round: "ks", home: first, away: second, start: `${season.year}-10-21`, games: 6 },
  ];

  rounds.forEach((roundConfig, roundIndex) => {
    const seriesId = `${season.seasonId}-${roundConfig.round}`;
    series.push({
      seriesId,
      seasonId: season.seasonId,
      type: roundConfig.round,
      homeSeasonTeamId: `${season.seasonId}:${roundConfig.home}`,
      awaySeasonTeamId: `${season.seasonId}:${roundConfig.away}`,
      plannedLength: roundConfig.games,
      actualLength: roundConfig.games,
      startDate: roundConfig.start,
      endDate: addDays(roundConfig.start, roundConfig.games - 1, 23).slice(0, 10),
      venueId: teamCatalog.find((team) => team.franchiseId === roundConfig.home).venueId,
      status: "final",
      importanceNote: "완성 시즌 포스트시즌 결과 seed",
    });

    for (let gameIndex = 0; gameIndex < roundConfig.games; gameIndex += 1) {
      const gameId = `${seriesId}-g${gameIndex + 1}`;
      const random = mulberry32(hashString(gameId));
      const homeScore = 3 + Math.round(random() * 5) + (gameIndex % 2 === 0 ? 1 : 0);
      const awayScore = 2 + Math.round(random() * 4);
      games.push({
        gameId,
        seasonId: season.seasonId,
        seriesId,
        homeSeasonTeamId: `${season.seasonId}:${roundConfig.home}`,
        awaySeasonTeamId: `${season.seasonId}:${roundConfig.away}`,
        scheduledAt: addDays(roundConfig.start, gameIndex),
        status: "final",
        originalScheduledAt: null,
        rescheduledFromGameId: null,
        homeScore,
        awayScore: awayScore >= homeScore ? awayScore - 1 : awayScore,
        innings: 9,
        isTie: false,
        note: null,
        attendance: 18200 + Math.round(random() * 7000),
        externalLinks: [
          {
            label: "포스트시즌 리캡",
            url: `https://example.com/kbo/${season.year}/postseason/${gameId}`,
          },
        ],
      });
    }
  });

  return { series, games };
}

function computeTeamStatsFromGames(season, games) {
  const statsMap = Object.fromEntries(
    teamCatalog.map((team) => [
      `${season.seasonId}:${team.franchiseId}`,
      {
        seasonId: season.seasonId,
        seasonTeamId: `${season.seasonId}:${team.franchiseId}`,
        wins: 0,
        losses: 0,
        ties: 0,
        runsScored: 0,
        runsAllowed: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        last10: "0-0",
        streak: "-",
        offensePlus: Math.round(team.priors.offenseRating + (team.currentStrength - 100) * 0.8),
        pitchingPlus: Math.round(team.priors.starterRating + team.priors.bullpenRating / 2 - 48),
        bullpenEra: Number((3.4 + (102 - team.priors.bullpenRating) * 0.04).toFixed(2)),
        teamWar: Number((12 + (team.currentStrength - 96) * 0.8).toFixed(1)),
        outcomes: [],
      },
    ]),
  );

  const finalGames = [...games]
    .filter((game) => game.status === "final")
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  finalGames.forEach((game) => {
    const home = statsMap[game.homeSeasonTeamId];
    const away = statsMap[game.awaySeasonTeamId];

    home.runsScored += game.homeScore;
    home.runsAllowed += game.awayScore;
    away.runsScored += game.awayScore;
    away.runsAllowed += game.homeScore;

    if (game.isTie || game.homeScore === game.awayScore) {
      home.ties += 1;
      away.ties += 1;
      home.outcomes.push("T");
      away.outcomes.push("T");
      return;
    }

    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.homeWins += 1;
      away.awayLosses += 1;
      home.outcomes.push("W");
      away.outcomes.push("L");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.awayWins += 1;
      home.homeLosses += 1;
      away.outcomes.push("W");
      home.outcomes.push("L");
    }
  });

  return Object.values(statsMap).map((entry) => {
    const sample = entry.outcomes.slice(-10);
    const wins = sample.filter((item) => item === "W").length;
    const losses = sample.filter((item) => item === "L").length;
    const ties = sample.filter((item) => item === "T").length;
    const latest = entry.outcomes.at(-1) ?? "T";
    let streakCount = 0;
    for (let index = entry.outcomes.length - 1; index >= 0; index -= 1) {
      if (entry.outcomes[index] !== latest) {
        break;
      }
      streakCount += 1;
    }
    return {
      seasonId: entry.seasonId,
      seasonTeamId: entry.seasonTeamId,
      wins: entry.wins,
      losses: entry.losses,
      ties: entry.ties,
      runsScored: entry.runsScored,
      runsAllowed: entry.runsAllowed,
      homeWins: entry.homeWins,
      homeLosses: entry.homeLosses,
      awayWins: entry.awayWins,
      awayLosses: entry.awayLosses,
      last10: `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`,
      streak:
        latest === "T"
          ? `무${streakCount}`
          : `${latest === "W" ? "승" : "패"}${streakCount}`,
      offensePlus: entry.offensePlus,
      pitchingPlus: entry.pitchingPlus,
      bullpenEra: entry.bullpenEra,
      teamWar: entry.teamWar,
    };
  });
}

const completedStandings = {
  2025: [
    ["lg", 86, 54, 4],
    ["kia", 83, 57, 4],
    ["kt", 78, 62, 4],
    ["doosan", 75, 65, 4],
    ["samsung", 73, 67, 4],
    ["hanwha", 69, 71, 4],
    ["lotte", 67, 73, 4],
    ["ssg", 64, 76, 4],
    ["nc", 60, 80, 4],
    ["heroes", 55, 85, 4],
  ],
  2017: [
    ["kia", 87, 55, 2],
    ["doosan", 84, 57, 3],
    ["lotte", 80, 62, 2],
    ["nc", 79, 62, 3],
    ["sk", 75, 68, 1],
    ["lg", 69, 72, 3],
    ["hanwha", 61, 81, 2],
    ["nexen", 60, 82, 2],
    ["samsung", 55, 84, 5],
    ["kt", 50, 94, 0],
  ],
};

function normalizeHistoricKey(franchiseId, seasonYear) {
  if (seasonYear === 2017 && franchiseId === "ssg") {
    return "sk";
  }
  if (seasonYear === 2017 && franchiseId === "heroes") {
    return "nexen";
  }
  return franchiseId;
}

function createCompletedTeamStats(season) {
  const rows = completedStandings[season.year];
  return rows.map(([key, wins, losses, ties], index) => {
    const team = teamCatalog.find(
      (item) => normalizeHistoricKey(item.franchiseId, season.year) === key,
    );
    const baseRuns = 660 - index * 18;
    return {
      seasonId: season.seasonId,
      seasonTeamId: `${season.seasonId}:${team.franchiseId}`,
      wins,
      losses,
      ties,
      runsScored: baseRuns,
      runsAllowed: 590 + index * 15,
      homeWins: Math.floor(wins * 0.54),
      homeLosses: Math.floor(losses * 0.44),
      awayWins: wins - Math.floor(wins * 0.54),
      awayLosses: losses - Math.floor(losses * 0.44),
      last10: `${Math.max(3, 8 - Math.floor(index / 2))}-${Math.max(1, 2 + Math.floor(index / 3))}`,
      streak: index % 2 === 0 ? "승2" : "패1",
      offensePlus: 110 - index * 2,
      pitchingPlus: 112 - index * 2,
      bullpenEra: Number((3.35 + index * 0.12).toFixed(2)),
      teamWar: Number((44 - index * 2.5).toFixed(1)),
    };
  });
}

function createTeamSplitStats(teamSeasonStats) {
  return teamSeasonStats.flatMap((stat) => [
    {
      splitId: `${stat.seasonTeamId}:home`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "home",
      wins: stat.homeWins,
      losses: stat.homeLosses,
      ties: Math.floor(stat.ties / 2),
      metricLabel: "홈",
      metricValue: `${stat.homeWins}-${stat.homeLosses}${Math.floor(stat.ties / 2) > 0 ? `-${Math.floor(stat.ties / 2)}` : ""} / ${(stat.homeWins / Math.max(1, stat.homeWins + stat.homeLosses)).toFixed(3)}`,
    },
    {
      splitId: `${stat.seasonTeamId}:away`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "away",
      wins: stat.awayWins,
      losses: stat.awayLosses,
      ties: Math.ceil(stat.ties / 2),
      metricLabel: "원정",
      metricValue: `${stat.awayWins}-${stat.awayLosses}${Math.ceil(stat.ties / 2) > 0 ? `-${Math.ceil(stat.ties / 2)}` : ""} / ${(stat.awayWins / Math.max(1, stat.awayWins + stat.awayLosses)).toFixed(3)}`,
    },
    {
      splitId: `${stat.seasonTeamId}:oneRun`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "oneRun",
      wins: Math.floor(stat.wins * 0.28),
      losses: Math.floor(stat.losses * 0.24),
      ties: 0,
      metricLabel: "1점차 경기",
      metricValue: `${Math.floor(stat.wins * 0.28)}-${Math.floor(stat.losses * 0.24)}`,
    },
    {
      splitId: `${stat.seasonTeamId}:extraInnings`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "extraInnings",
      wins: Math.floor(stat.wins * 0.12),
      losses: Math.floor(stat.losses * 0.11),
      ties: Math.min(2, stat.ties),
      metricLabel: "연장전",
      metricValue: `${Math.floor(stat.wins * 0.12)}-${Math.floor(stat.losses * 0.11)}${Math.min(2, stat.ties) > 0 ? `-${Math.min(2, stat.ties)}` : ""}`,
    },
    {
      splitId: `${stat.seasonTeamId}:vsLeft`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "vsLeft",
      wins: Math.floor(stat.wins * 0.47),
      losses: Math.floor(stat.losses * 0.44),
      ties: Math.floor(stat.ties / 2),
      metricLabel: "좌완 상대",
      metricValue: `${(0.69 + (stat.offensePlus - 100) * 0.004).toFixed(3)} OPS`,
    },
    {
      splitId: `${stat.seasonTeamId}:vsRight`,
      seasonId: stat.seasonId,
      seasonTeamId: stat.seasonTeamId,
      splitType: "vsRight",
      wins: Math.floor(stat.wins * 0.53),
      losses: Math.floor(stat.losses * 0.56),
      ties: Math.ceil(stat.ties / 2),
      metricLabel: "우완 상대",
      metricValue: `${(0.71 + (stat.offensePlus - 100) * 0.003).toFixed(3)} OPS`,
    },
  ]);
}

function createPlayers() {
  return teamCatalog.flatMap((team) => [
    {
      playerId: team.hitter.playerId,
      slug: team.hitter.slug,
      nameKo: team.hitter.nameKo,
      nameEn: team.hitter.nameEn,
      birthDate: "1997-04-18",
      batsThrows: "우투좌타",
      primaryPositions: ["OF"],
      debutYear: 2020,
      franchiseIds: [team.franchiseId],
      bio: `${team.displayNameKo} 중심 타선을 책임지는 fictional seed 선수입니다.`,
    },
    {
      playerId: team.pitcher.playerId,
      slug: team.pitcher.slug,
      nameKo: team.pitcher.nameKo,
      nameEn: team.pitcher.nameEn,
      birthDate: "1996-08-12",
      batsThrows: "우투우타",
      primaryPositions: ["SP"],
      debutYear: 2019,
      franchiseIds: [team.franchiseId],
      bio: `${team.displayNameKo} 선발 축을 상징하는 fictional seed 선수입니다.`,
    },
  ]);
}

function createPlayerSeasonStats(seasonTeamStats) {
  return seasonTeamStats.flatMap((stat) => {
    const franchiseId = stat.seasonTeamId.split(":")[1];
    const team = teamCatalog.find((item) => item.franchiseId === franchiseId);
    const completed = stat.wins + stat.losses + stat.ties > 30;
    const hitterGames = completed ? 132 : Math.max(8, stat.wins + stat.losses + stat.ties);
    const pitcherGames = completed ? 28 : 4;
    return [
      {
        statId: `${stat.seasonId}:${team.hitter.playerId}`,
        seasonId: stat.seasonId,
        playerId: team.hitter.playerId,
        seasonTeamId: stat.seasonTeamId,
        statType: "hitter",
        games: hitterGames,
        plateAppearances: completed ? 560 : 42,
        atBats: completed ? 490 : 36,
        hits: completed ? Math.round(150 + (stat.offensePlus - 100) * 2) : 12 + Math.round(stat.offensePlus / 20),
        homeRuns: completed ? 18 + Math.round((stat.offensePlus - 100) / 2) : 2 + Math.round((stat.offensePlus - 96) / 6),
        ops: Number((0.72 + (stat.offensePlus - 100) * 0.005).toFixed(3)),
        era: null,
        inningsPitched: null,
        strikeouts: null,
        saves: null,
        wins: null,
        losses: null,
        war: Number((completed ? 3.1 : 0.4 + (stat.offensePlus - 100) * 0.05).toFixed(1)),
      },
      {
        statId: `${stat.seasonId}:${team.pitcher.playerId}`,
        seasonId: stat.seasonId,
        playerId: team.pitcher.playerId,
        seasonTeamId: stat.seasonTeamId,
        statType: "pitcher",
        games: pitcherGames,
        plateAppearances: null,
        atBats: null,
        hits: null,
        homeRuns: null,
        ops: null,
        era: Number((3.15 + (106 - stat.pitchingPlus) * 0.05).toFixed(2)),
        inningsPitched: completed ? 168 + Math.round((stat.pitchingPlus - 100) * 1.5) : 24 + Math.round((stat.pitchingPlus - 100) * 0.5),
        strikeouts: completed ? 164 + Math.round((stat.pitchingPlus - 100) * 2) : 24 + Math.round((stat.pitchingPlus - 100) * 0.6),
        saves: 0,
        wins: completed ? 12 + Math.round((stat.pitchingPlus - 100) * 0.4) : 2,
        losses: completed ? 7 + Math.max(0, Math.round((100 - stat.pitchingPlus) * 0.3)) : 1,
        war: Number((completed ? 3.6 : 0.6 + (stat.pitchingPlus - 100) * 0.04).toFixed(1)),
      },
    ];
  });
}

function distributeRuns(totalRuns, seed) {
  const random = mulberry32(hashString(seed));
  const innings = Array.from({ length: 9 }, () => 0);
  for (let run = 0; run < totalRuns; run += 1) {
    innings[Math.floor(random() * innings.length)] += 1;
  }
  return innings;
}

function createBoxScores(games) {
  return games
    .filter((game) => game.status === "final")
    .slice(0, 24)
    .map((game) => {
      const homeFranchiseId = game.homeSeasonTeamId.split(":")[1];
      const awayFranchiseId = game.awaySeasonTeamId.split(":")[1];
      const homeTeam = teamCatalog.find((team) => team.franchiseId === homeFranchiseId);
      const awayTeam = teamCatalog.find((team) => team.franchiseId === awayFranchiseId);
      const homeLine = distributeRuns(game.homeScore, `${game.gameId}:home`);
      const awayLine = distributeRuns(game.awayScore, `${game.gameId}:away`);
      const homeWon = game.homeScore > game.awayScore;
      return {
        gameId: game.gameId,
        winningPitcherId: homeWon ? homeTeam.pitcher.playerId : awayTeam.pitcher.playerId,
        losingPitcherId: homeWon ? awayTeam.pitcher.playerId : homeTeam.pitcher.playerId,
        savePitcherId: Math.abs(game.homeScore - game.awayScore) <= 3 ? (homeWon ? homeTeam.pitcher.playerId : awayTeam.pitcher.playerId) : null,
        lineScore: homeLine.map((home, inning) => ({
          inning: inning + 1,
          home,
          away: awayLine[inning],
        })),
        highlights: [
          {
            playerId: homeTeam.hitter.playerId,
            label: `${homeTeam.shortNameKo} 핵심 타자`,
            value: `${homeWon ? "3안타 2타점" : "2안타"}`,
          },
          {
            playerId: awayTeam.pitcher.playerId,
            label: `${awayTeam.shortNameKo} 선발`,
            value: `${homeWon ? "5이닝 3실점" : "6이닝 2실점"}`,
          },
        ],
      };
    });
}

function createPlayerGameStats(boxScores, games) {
  return boxScores.flatMap((boxScore) => {
    const game = games.find((item) => item.gameId === boxScore.gameId);
    const homeFranchiseId = game.homeSeasonTeamId.split(":")[1];
    const awayFranchiseId = game.awaySeasonTeamId.split(":")[1];
    const homeTeam = teamCatalog.find((team) => team.franchiseId === homeFranchiseId);
    const awayTeam = teamCatalog.find((team) => team.franchiseId === awayFranchiseId);
    return [
      {
        playerGameStatId: `${game.gameId}:${homeTeam.hitter.playerId}`,
        gameId: game.gameId,
        seasonId: game.seasonId,
        playerId: homeTeam.hitter.playerId,
        seasonTeamId: game.homeSeasonTeamId,
        statType: "hitter",
        summaryLine: "4타수 2안타 1타점",
      },
      {
        playerGameStatId: `${game.gameId}:${homeTeam.pitcher.playerId}`,
        gameId: game.gameId,
        seasonId: game.seasonId,
        playerId: homeTeam.pitcher.playerId,
        seasonTeamId: game.homeSeasonTeamId,
        statType: "pitcher",
        summaryLine: "6이닝 2실점 7K",
      },
      {
        playerGameStatId: `${game.gameId}:${awayTeam.hitter.playerId}`,
        gameId: game.gameId,
        seasonId: game.seasonId,
        playerId: awayTeam.hitter.playerId,
        seasonTeamId: game.awaySeasonTeamId,
        statType: "hitter",
        summaryLine: "4타수 1안타",
      },
      {
        playerGameStatId: `${game.gameId}:${awayTeam.pitcher.playerId}`,
        gameId: game.gameId,
        seasonId: game.seasonId,
        playerId: awayTeam.pitcher.playerId,
        seasonTeamId: game.awaySeasonTeamId,
        statType: "pitcher",
        summaryLine: "5이닝 3실점 4K",
      },
    ];
  });
}

function createRosterEvents() {
  return [
    {
      rosterEventId: "2026:lg:injury",
      seasonId: "kbo-2026",
      playerId: "lg-p-1",
      seasonTeamId: "kbo-2026:lg",
      type: "injured",
      date: "2026-04-10",
      note: "어깨 피로로 등판 간격 조정",
    },
    {
      rosterEventId: "2026:kia:activate",
      seasonId: "kbo-2026",
      playerId: "kia-h-1",
      seasonTeamId: "kbo-2026:kia",
      type: "activated",
      date: "2026-04-09",
      note: "복귀 후 선발 라인업 재합류",
    },
  ];
}

function createSeasonSummaries() {
  return [
    {
      seasonId: "kbo-2026",
      headline: "초반 상위권 압축, 5위권까지 혼전",
      championSeasonTeamId: "kbo-2026:lg",
      regularSeasonWinnerSeasonTeamId: "kbo-2026:lg",
      narrative: [
        "4월 중순 기준으로 팀당 약 18~19경기 수준의 샘플을 반영한 current-season seed입니다.",
        "상위권과 5위권 경계가 동시에 압축돼 있어 시리즈 단위 가정이 순위 확률을 크게 흔듭니다.",
        "우천 취소와 직접 맞대결이 남아 있어 홈/원정 밸런스보다 남은 대진의 질이 더 중요하게 읽히는 구간입니다.",
      ],
    },
    {
      seasonId: "kbo-2025",
      headline: "LG가 정규시즌과 한국시리즈를 모두 제패한 가정형 로컬 부트스트랩 시즌",
      championSeasonTeamId: "kbo-2025:lg",
      regularSeasonWinnerSeasonTeamId: "kbo-2025:lg",
      narrative: [
        "선발 안정감과 불펜 소모 관리가 시즌 내내 강점으로 작동했습니다.",
        "KT와 두산이 포스트시즌 경로를 길게 가져가며 2-4위 레이스를 만들었습니다.",
      ],
    },
    {
      seasonId: "kbo-2017",
      headline: "KIA의 통합 우승과 브랜드 변천이 함께 드러나는 역사 seed",
      championSeasonTeamId: "kbo-2017:kia",
      regularSeasonWinnerSeasonTeamId: "kbo-2017:kia",
      narrative: [
        "SK 와이번스, 넥센 히어로즈 브랜드가 아카이브에 남아 있습니다.",
        "결정전 규정이 남아 있던 시기라는 점을 ruleset에서 분리해 표현했습니다.",
      ],
    },
  ];
}

function createAwards() {
  return [
    {
      awardId: "2026-april-mvp",
      seasonId: "kbo-2026",
      label: "3-4월 MVP 흐름",
      playerId: "lg-h-1",
      seasonTeamId: "kbo-2026:lg",
      note: "초반 출루율과 장타 생산이 동시에 좋았다는 설정의 seed award입니다.",
    },
    {
      awardId: "2025-mvp",
      seasonId: "kbo-2025",
      label: "MVP",
      playerId: "lg-h-1",
      seasonTeamId: "kbo-2025:lg",
      note: "중심 타선과 출루 생산력을 상징하는 seed MVP",
    },
    {
      awardId: "2017-mvp",
      seasonId: "kbo-2017",
      label: "MVP",
      playerId: "kia-h-1",
      seasonTeamId: "kbo-2017:kia",
      note: "우승 시즌의 핵심 타자로 설정된 seed MVP",
    },
  ];
}

function createPostseasonResults() {
  return [
    {
      seasonId: "kbo-2025",
      round: "wildcard",
      winnerSeasonTeamId: "kbo-2025:doosan",
      loserSeasonTeamId: "kbo-2025:samsung",
      summary: "두산이 4위 어드밴티지를 살려 단기전 문턱을 넘었습니다.",
    },
    {
      seasonId: "kbo-2025",
      round: "semipo",
      winnerSeasonTeamId: "kbo-2025:kt",
      loserSeasonTeamId: "kbo-2025:doosan",
      summary: "KT가 선발 우위로 준플레이오프를 마감했습니다.",
    },
    {
      seasonId: "kbo-2025",
      round: "po",
      winnerSeasonTeamId: "kbo-2025:lg",
      loserSeasonTeamId: "kbo-2025:kt",
      summary: "LG가 휴식 이점을 살려 플레이오프를 가져갔습니다.",
    },
    {
      seasonId: "kbo-2025",
      round: "ks",
      winnerSeasonTeamId: "kbo-2025:lg",
      loserSeasonTeamId: "kbo-2025:kia",
      summary: "LG가 한국시리즈에서 투수층 우위를 증명했습니다.",
    },
    {
      seasonId: "kbo-2017",
      round: "wildcard",
      winnerSeasonTeamId: "kbo-2017:ssg",
      loserSeasonTeamId: "kbo-2017:lg",
      summary: "와일드카드에서 SK가 기세를 탔다는 seed 결과입니다.",
    },
    {
      seasonId: "kbo-2017",
      round: "semipo",
      winnerSeasonTeamId: "kbo-2017:nc",
      loserSeasonTeamId: "kbo-2017:ssg",
      summary: "NC가 짧은 시리즈에서 우세를 보였습니다.",
    },
    {
      seasonId: "kbo-2017",
      round: "po",
      winnerSeasonTeamId: "kbo-2017:doosan",
      loserSeasonTeamId: "kbo-2017:nc",
      summary: "두산이 플레이오프를 통해 한국시리즈에 진출했습니다.",
    },
    {
      seasonId: "kbo-2017",
      round: "ks",
      winnerSeasonTeamId: "kbo-2017:kia",
      loserSeasonTeamId: "kbo-2017:doosan",
      summary: "KIA가 통합 우승을 완성한 시즌으로 남습니다.",
    },
  ];
}

function expandHistoricSeasonTeamId(value) {
  if (value.includes(":sk")) {
    return value.replace(":sk", ":ssg");
  }
  if (value.includes(":nexen")) {
    return value.replace(":nexen", ":heroes");
  }
  return value;
}

async function main() {
  const seasonTeams = createSeasonTeams();
  const franchises = createFranchises();
  const players = createPlayers();

  const season2026 = seasons.find((season) => season.year === 2026);
  const currentSchedule = createRegularSeasonSchedule(season2026, 12, {
    roundSpacingDays: 4,
    startOffsetDays: 0,
  });

  const season2025 = seasons.find((season) => season.year === 2025);
  const completed2025Regular = createRegularSeasonSchedule(season2025, 10, {
    roundSpacingDays: 5,
  });
  const completed2025Post = createPostseasonSeries(season2025, ["lg", "kia", "kt", "doosan", "samsung"]);

  const season2017 = seasons.find((season) => season.year === 2017);
  const completed2017Regular = createRegularSeasonSchedule(season2017, 10, {
    roundSpacingDays: 5,
  });
  const completed2017Post = createPostseasonSeries(season2017, ["kia", "doosan", "lotte", "nc", "ssg"]);

  const series = [
    ...currentSchedule.series,
    ...completed2025Regular.series,
    ...completed2025Post.series,
    ...completed2017Regular.series.map((item) => ({
      ...item,
      homeSeasonTeamId: expandHistoricSeasonTeamId(item.homeSeasonTeamId),
      awaySeasonTeamId: expandHistoricSeasonTeamId(item.awaySeasonTeamId),
    })),
    ...completed2017Post.series.map((item) => ({
      ...item,
      homeSeasonTeamId: expandHistoricSeasonTeamId(item.homeSeasonTeamId),
      awaySeasonTeamId: expandHistoricSeasonTeamId(item.awaySeasonTeamId),
    })),
  ];

  const games = [
    ...currentSchedule.games,
    ...completed2025Regular.games,
    ...completed2025Post.games,
    ...completed2017Regular.games.map((item) => ({
      ...item,
      homeSeasonTeamId: expandHistoricSeasonTeamId(item.homeSeasonTeamId),
      awaySeasonTeamId: expandHistoricSeasonTeamId(item.awaySeasonTeamId),
    })),
    ...completed2017Post.games.map((item) => ({
      ...item,
      homeSeasonTeamId: expandHistoricSeasonTeamId(item.homeSeasonTeamId),
      awaySeasonTeamId: expandHistoricSeasonTeamId(item.awaySeasonTeamId),
    })),
  ];

  const currentTeamStats = computeTeamStatsFromGames(season2026, currentSchedule.games);
  const season2025TeamStats = createCompletedTeamStats(season2025);
  const season2017TeamStats = createCompletedTeamStats(season2017);

  const teamSeasonStats = [
    ...currentTeamStats,
    ...season2025TeamStats,
    ...season2017TeamStats,
  ];

  const teamSplitStats = createTeamSplitStats(teamSeasonStats);
  const playerSeasonStats = createPlayerSeasonStats(teamSeasonStats);
  const boxScores = createBoxScores(games);
  const playerGameStats = createPlayerGameStats(boxScores, games);
  const rosterEvents = createRosterEvents();
  const seasonSummaries = createSeasonSummaries();
  const awards = createAwards();
  const postseasonResults = createPostseasonResults();

  const bundle = {
    franchises,
    teamBrands,
    venues,
    seasons,
    rulesets,
    seasonTeams,
    series,
    games,
    gameBoxScores: boxScores,
    players,
    rosterEvents,
    playerSeasonStats,
    playerGameStats,
    teamSeasonStats,
    teamSplitStats,
    awards,
    seasonSummaries,
    postseasonResults,
  };

  const manualAdjustments = {
    updatedAt: "2026-04-15T09:00:00+09:00",
    patches: [
      {
        seasonTeamId: "kbo-2026:lg",
        offenseDelta: 1.5,
        starterDelta: 0.8,
        bullpenDelta: 0.2,
        confidenceDelta: 0.05,
        note: "상위 타선 컨디션 상승 수동 보정",
        updatedAt: "2026-04-15T09:00:00+09:00",
      },
      {
        seasonTeamId: "kbo-2026:hanwha",
        offenseDelta: -0.4,
        starterDelta: 1.2,
        bullpenDelta: -0.3,
        confidenceDelta: 0.02,
        note: "선발 로테이션 안정감 반영",
        updatedAt: "2026-04-15T09:00:00+09:00",
      },
    ],
  };

  const auditLog = {
    updatedAt: "2026-04-15T09:00:00+09:00",
    entries: [],
  };

  const rawImportPreview = {
    source: "manual-import-preview",
    extractedAt: "2026-04-15T08:45:00+09:00",
    scheduleRows: currentSchedule.games.slice(0, 6).map((game) => ({
      gameId: game.gameId,
      scheduledAt: game.scheduledAt,
      homeTeamId: game.homeSeasonTeamId,
      awayTeamId: game.awaySeasonTeamId,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      status: game.status,
    })),
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, "raw"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(dataDir, "manual-adjustments.json"),
    `${JSON.stringify(manualAdjustments, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(dataDir, "audit-log.json"),
    `${JSON.stringify(auditLog, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(dataDir, "raw", "manual-import-preview.json"),
    `${JSON.stringify(rawImportPreview, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
