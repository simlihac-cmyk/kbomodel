import { promises as fs } from "node:fs";
import path from "node:path";

import { parseOfficialEnScoreboard } from "@/lib/data-sources/kbo/adapters/official-en/scoreboard";
import { parseOfficialKoSchedule } from "@/lib/data-sources/kbo/adapters/official-ko/schedule";
import { parseOfficialKoTeamHitter } from "@/lib/data-sources/kbo/adapters/official-ko/team-hitter";
import { parseOfficialKoTeamPitcher } from "@/lib/data-sources/kbo/adapters/official-ko/team-pitcher";
import { fetchAspNetSeasonSelectionPage } from "@/lib/data-sources/kbo/fetch/aspnet-webforms";
import { fetchHtml } from "@/lib/data-sources/kbo/fetch/fetch-html";
import { checksumHtml } from "@/lib/data-sources/kbo/fetch/fetch-cache";
import { kboSourceRegistry } from "@/lib/data-sources/kbo/source-registry";
import { fetchOfficialKoSeasonScheduleService } from "@/lib/data-sources/kbo/fetch/fetch-korean-schedule-service";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";
import type { DatasetId, RawSourceSnapshot, SourceId } from "@/lib/data-sources/kbo/dataset-types";

const TEAM_STATS_SEASON_FIELD = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ddlSeason$ddlSeason";
const DEFAULT_START_YEAR = 2021;
const DEFAULT_END_YEAR = 2025;
const SEASON_WINDOW_START = [3, 1] as const;
const SEASON_WINDOW_END = [11, 30] as const;

type BackfillArgs = {
  years: number[];
  refresh: boolean;
  dailyOnly: boolean;
  annualOnly: boolean;
  scheduleOnly: boolean;
};

type DailyDatasetConfig = {
  datasetId: DatasetId;
  sourceId: SourceId;
  buildUrl: (dateKey: string) => string;
  parse: (html: string) => Array<unknown>;
  allowEmptySnapshots?: boolean;
};

type AnnualDatasetConfig = {
  datasetId: DatasetId;
  sourceId: SourceId;
  url: string;
  parse: (html: string) => Array<unknown>;
  validate?: (rows: Array<unknown>, year: number) => boolean;
};

type YearlyCount = {
  saved: number;
  skippedExisting: number;
  empty: number;
  failed: number;
};

function parseArgs(argv: string[]): BackfillArgs {
  const yearsFlag = argv.find((arg) => arg.startsWith("--years="));
  const startYear = Number.parseInt(
    argv.find((arg) => arg.startsWith("--start-year="))?.split("=")[1] ?? `${DEFAULT_START_YEAR}`,
    10,
  );
  const endYear = Number.parseInt(
    argv.find((arg) => arg.startsWith("--end-year="))?.split("=")[1] ?? `${DEFAULT_END_YEAR}`,
    10,
  );

  const years = yearsFlag
    ? yearsFlag
        .split("=")[1]
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value))
    : Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);

  return {
    years: Array.from(new Set(years)).sort((left, right) => left - right),
    refresh: argv.includes("--refresh"),
    dailyOnly: argv.includes("--daily-only"),
    annualOnly: argv.includes("--annual-only"),
    scheduleOnly: argv.includes("--schedule-only"),
  };
}

function formatDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompactDate(dateKey: string) {
  return dateKey.replace(/-/g, "");
}

function formatDottedDate(dateKey: string) {
  return dateKey.replace(/-/g, ".");
}

function buildSeasonDateKeys(year: number) {
  const start = new Date(Date.UTC(year, SEASON_WINDOW_START[0] - 1, SEASON_WINDOW_START[1]));
  const end = new Date(Date.UTC(year, SEASON_WINDOW_END[0] - 1, SEASON_WINDOW_END[1]));
  const values: string[] = [];

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    values.push(formatDateKey(cursor));
  }

  return values;
}

function getParserVersion(sourceId: SourceId, datasetId: DatasetId) {
  const entry = kboSourceRegistry.find((item) => item.sourceId === sourceId && item.datasetId === datasetId);
  if (!entry) {
    throw new Error(`No parserVersion found for ${sourceId}/${datasetId}`);
  }
  return entry.parserVersion;
}

async function saveRawSnapshotIfNeeded(args: {
  repository: FileRawSourceRepository;
  refresh: boolean;
  snapshot: RawSourceSnapshot;
}) {
  if (!args.refresh) {
    const existing = await args.repository.getSnapshot(
      args.snapshot.sourceId,
      args.snapshot.datasetId,
      args.snapshot.snapshotKey,
    );
    if (existing) {
      return false;
    }
  }

  await args.repository.saveSnapshot(args.snapshot);
  return true;
}

function emptyYearlyCount(): YearlyCount {
  return {
    saved: 0,
    skippedExisting: 0,
    empty: 0,
    failed: 0,
  };
}

async function backfillDailyDataset(args: {
  years: number[];
  repository: FileRawSourceRepository;
  refresh: boolean;
  config: DailyDatasetConfig;
}) {
  const parserVersion = getParserVersion(args.config.sourceId, args.config.datasetId);
  const byYear: Record<string, YearlyCount> = {};

  for (const year of args.years) {
    byYear[year] = emptyYearlyCount();
    const dateKeys = buildSeasonDateKeys(year);
    console.log(`[${args.config.datasetId}] ${year} ${dateKeys[0]} -> ${dateKeys.at(-1)}`);

    for (const dateKey of dateKeys) {
      const snapshotKey = dateKey;
      if (!args.refresh) {
        const existing = await args.repository.getSnapshot(
          args.config.sourceId,
          args.config.datasetId,
          snapshotKey,
        );
        if (existing) {
          byYear[year].skippedExisting += 1;
          continue;
        }
      }

      try {
        const result = await fetchHtml(args.config.buildUrl(dateKey));
        const rows = args.config.parse(result.html);
        if (rows.length === 0 && !args.config.allowEmptySnapshots) {
          byYear[year].empty += 1;
          continue;
        }

        const saved = await saveRawSnapshotIfNeeded({
          repository: args.repository,
          refresh: args.refresh,
          snapshot: {
            sourceId: args.config.sourceId,
            datasetId: args.config.datasetId,
            snapshotKey,
            fetchedAt: result.fetchedAt,
            sourceUrl: result.sourceUrl,
            httpStatus: result.httpStatus,
            checksum: result.checksum,
            parserVersion,
            fixtureBacked: false,
            html: result.html,
          },
        });

        if (saved) {
          byYear[year].saved += 1;
        } else {
          byYear[year].skippedExisting += 1;
        }
      } catch (error) {
        byYear[year].failed += 1;
        console.warn(`[${args.config.datasetId}] failed ${dateKey}`, error);
      }
    }
  }

  return byYear;
}

async function backfillSeasonScheduleDataset(args: {
  years: number[];
  repository: FileRawSourceRepository;
  refresh: boolean;
}) {
  const datasetId = "schedule-calendar" as const;
  const sourceId = "official-kbo-ko" as const;
  const parserVersion = getParserVersion(sourceId, datasetId);
  const byYear: Record<string, YearlyCount> = {};

  for (const year of args.years) {
    byYear[year] = emptyYearlyCount();
    const snapshotKey = `${year}`;

    if (!args.refresh) {
      const existing = await args.repository.getSnapshot(sourceId, datasetId, snapshotKey);
      if (existing) {
        byYear[year].skippedExisting += 1;
        continue;
      }
    }

    try {
      const schedule = await fetchOfficialKoSeasonScheduleService(year);
      const html = JSON.stringify(schedule, null, 2);
      const rows = parseOfficialKoSchedule(html);
      if (rows.length === 0) {
        byYear[year].empty += 1;
        continue;
      }

      const saved = await saveRawSnapshotIfNeeded({
        repository: args.repository,
        refresh: args.refresh,
        snapshot: {
          sourceId,
          datasetId,
          snapshotKey,
          fetchedAt: new Date().toISOString(),
          sourceUrl: "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList",
          httpStatus: 200,
          checksum: checksumHtml(html),
          parserVersion,
          fixtureBacked: false,
          html,
        },
      });

      if (saved) {
        byYear[year].saved += 1;
      } else {
        byYear[year].skippedExisting += 1;
      }
    } catch (error) {
      byYear[year].failed += 1;
      console.warn(`[${datasetId}] failed ${year}`, error);
    }
  }

  return byYear;
}

async function backfillAnnualDataset(args: {
  years: number[];
  repository: FileRawSourceRepository;
  refresh: boolean;
  config: AnnualDatasetConfig;
}) {
  const parserVersion = getParserVersion(args.config.sourceId, args.config.datasetId);
  const byYear: Record<string, YearlyCount> = {};

  for (const year of args.years) {
    byYear[year] = emptyYearlyCount();
    const snapshotKey = `${year}`;

    if (!args.refresh) {
      const existing = await args.repository.getSnapshot(
        args.config.sourceId,
        args.config.datasetId,
        snapshotKey,
      );
      if (existing) {
        byYear[year].skippedExisting += 1;
        continue;
      }
    }

    try {
      const result = await fetchAspNetSeasonSelectionPage({
        url: args.config.url,
        seasonYear: year,
        seasonFieldName: TEAM_STATS_SEASON_FIELD,
      });
      const rows = args.config.parse(result.html);
      if (rows.length === 0) {
        byYear[year].empty += 1;
        continue;
      }
      if (args.config.validate && !args.config.validate(rows, year)) {
        throw new Error(`Validation failed for ${args.config.datasetId} ${year}`);
      }

      const saved = await saveRawSnapshotIfNeeded({
        repository: args.repository,
        refresh: args.refresh,
        snapshot: {
          sourceId: args.config.sourceId,
          datasetId: args.config.datasetId,
          snapshotKey,
          fetchedAt: result.fetchedAt,
          sourceUrl: result.sourceUrl,
          httpStatus: result.httpStatus,
          checksum: result.checksum,
          parserVersion,
          fixtureBacked: false,
          html: result.html,
        },
      });

      if (saved) {
        byYear[year].saved += 1;
      } else {
        byYear[year].skippedExisting += 1;
      }
    } catch (error) {
      byYear[year].failed += 1;
      console.warn(`[${args.config.datasetId}] failed ${year}`, error);
    }
  }

  return byYear;
}

async function writeManifest(manifest: unknown, years: number[]) {
  const directory = path.join(process.cwd(), "data", "raw", "kbo", "history-backfill");
  await fs.mkdir(directory, { recursive: true });
  const label = `${years[0]}-${years.at(-1)}`;
  const filePath = path.join(directory, `${label}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.years.length === 0) {
    throw new Error("No years selected for backfill.");
  }

  const repository = new FileRawSourceRepository();
  const dailyConfigs: DailyDatasetConfig[] = [
    {
      datasetId: "scoreboard",
      sourceId: "official-kbo-en",
      buildUrl: (dateKey) =>
        `https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${formatDottedDate(dateKey)}`,
      parse: parseOfficialEnScoreboard,
      allowEmptySnapshots: true,
    },
  ];
  const annualConfigs: AnnualDatasetConfig[] = [
    {
      datasetId: "team-hitter",
      sourceId: "official-kbo-ko",
      url: "https://www.koreabaseball.com/Record/Team/Hitter/Basic1.aspx",
      parse: parseOfficialKoTeamHitter,
      validate: (rows) =>
        rows.some(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            "games" in row &&
            typeof row.games === "number" &&
            row.games >= 100,
        ),
    },
    {
      datasetId: "team-pitcher",
      sourceId: "official-kbo-ko",
      url: "https://www.koreabaseball.com/Record/Team/Pitcher/Basic1.aspx",
      parse: parseOfficialKoTeamPitcher,
      validate: (rows) =>
        rows.some(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            "games" in row &&
            typeof row.games === "number" &&
            row.games >= 100,
        ),
    },
  ];

  const manifest: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    years: args.years,
    refresh: args.refresh,
  };

  if (!args.annualOnly) {
    manifest["schedule-calendar"] = await backfillSeasonScheduleDataset({
      years: args.years,
      repository,
      refresh: args.refresh,
    });
    if (!args.scheduleOnly) {
      for (const config of dailyConfigs) {
        manifest[config.datasetId] = await backfillDailyDataset({
          years: args.years,
          repository,
          refresh: args.refresh,
          config,
        });
      }
    }
  }

  if (!args.dailyOnly) {
    for (const config of annualConfigs) {
      manifest[config.datasetId] = await backfillAnnualDataset({
        years: args.years,
        repository,
        refresh: args.refresh,
        config,
      });
    }
  }

  const manifestPath = await writeManifest(manifest, args.years);
  console.log(`Saved historical backfill manifest -> ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
