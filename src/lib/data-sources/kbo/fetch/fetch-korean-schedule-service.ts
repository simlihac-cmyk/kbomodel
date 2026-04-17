export type KoreanScheduleServiceMonthSnapshot = {
  seasonYear: number;
  month: string;
  fetchedAt: string;
  sourceUrl: string;
  rows: unknown[];
};

export type KoreanScheduleServiceCombinedSnapshot = {
  seasonYear: number;
  months: KoreanScheduleServiceMonthSnapshot[];
};

const SCHEDULE_SERVICE_URL = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList";

async function fetchMonthSchedule(seasonYear: number, month: string): Promise<KoreanScheduleServiceMonthSnapshot> {
  const params = new URLSearchParams({
    leId: "1",
    srIdList: "0,9,6",
    seasonId: String(seasonYear),
    gameMonth: month,
    teamId: "",
  });

  const response = await fetch(SCHEDULE_SERVICE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      "user-agent": "kbo-race-lab/0.1 (+ingest)",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const payload = (await response.json()) as { rows?: unknown[] };
  return {
    seasonYear,
    month,
    fetchedAt: new Date().toISOString(),
    sourceUrl: SCHEDULE_SERVICE_URL,
    rows: payload.rows ?? [],
  };
}

export async function fetchOfficialKoSeasonScheduleService(
  seasonYear: number,
  months: string[] = ["03", "04", "05", "06", "07", "08", "09", "10"],
): Promise<KoreanScheduleServiceCombinedSnapshot> {
  const snapshots = await Promise.all(months.map((month) => fetchMonthSchedule(seasonYear, month)));
  return {
    seasonYear,
    months: snapshots,
  };
}
