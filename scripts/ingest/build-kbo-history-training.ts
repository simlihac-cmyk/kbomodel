import { promises as fs } from "node:fs";
import path from "node:path";

import { kboDataBundleSchema } from "@/lib/domain/kbo/schemas";
import { parseOfficialEnScoreboard } from "@/lib/data-sources/kbo/adapters/official-en/scoreboard";
import { parseOfficialKoSchedule } from "@/lib/data-sources/kbo/adapters/official-ko/schedule";
import { buildHistoryTrainingSeason } from "@/lib/data-sources/kbo/derive/build-history-training";
import type { ParsedScoreboardRow, ParsedScheduleRow } from "@/lib/data-sources/kbo/dataset-types";
import { FileNormalizedKboRepository } from "@/lib/repositories/kbo/normalized-repository";
import { FileRawSourceRepository } from "@/lib/repositories/kbo/raw-source-repository";

const DEFAULT_START_YEAR = 2021;
const DEFAULT_END_YEAR = 2025;
const SEASON_WINDOW_START = [3, 1] as const;
const SEASON_WINDOW_END = [11, 30] as const;
const OUTPUT_ROOT = path.join(process.cwd(), "data", "normalized", "kbo", "history-training");

type BuildArgs = {
  years: number[];
};

type ParsedSnapshot<TRow> = {
  snapshotKey: string;
  rows: TRow[];
};

function parseArgs(argv: string[]): BuildArgs {
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
  };
}

function formatDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

async function loadBundle() {
  const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "kbo", "bundle.json"), "utf8")) as unknown;
  return kboDataBundleSchema.parse(raw);
}

async function loadHistoricalRecords() {
  const repository = new FileNormalizedKboRepository();
  const keys = await repository.listDatasetKeys("historical-team-records");
  const latestKey = keys.at(-1);
  if (!latestKey) {
    throw new Error("No normalized historical-team-records dataset found. Run `pnpm ingest:kbo:history` first.");
  }

  const payload = await repository.getDatasetOutput("historical-team-records", latestKey);
  if (!payload) {
    throw new Error(`Unable to load historical-team-records dataset ${latestKey}.`);
  }

  return {
    snapshotKey: latestKey,
    payload,
  };
}

async function loadParsedSnapshots<TRow>(args: {
  sourceId: "official-kbo-en" | "official-kbo-ko";
  year: number;
  datasetId: "scoreboard" | "schedule-calendar";
  parse: (html: string) => TRow[];
  snapshotKeyPrefix?: string;
}): Promise<ParsedSnapshot<TRow>[]> {
  const repository = new FileRawSourceRepository();
  const prefix = args.snapshotKeyPrefix ?? `${args.year}-`;
  const metadata = (await repository.listSnapshotMetadata(args.sourceId, args.datasetId)).filter((item) =>
    item.snapshotKey.startsWith(prefix),
  );

  const snapshots = await Promise.all(
    metadata.map(async (item) => {
      const snapshot = await repository.getSnapshot(args.sourceId, args.datasetId, item.snapshotKey);
      if (!snapshot) {
        return null;
      }
      return {
        snapshotKey: item.snapshotKey,
        rows: args.parse(snapshot.html),
      };
    }),
  );

  return snapshots
    .filter((item): item is ParsedSnapshot<TRow> => item !== null)
    .sort((left, right) => left.snapshotKey.localeCompare(right.snapshotKey));
}

async function writeSeasonFile(year: number, payload: unknown) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const filePath = path.join(OUTPUT_ROOT, `${year}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function writeManifest(manifest: unknown) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const filePath = path.join(OUTPUT_ROOT, "manifest.json");
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.years.length === 0) {
    throw new Error("No years selected for history training build.");
  }

  const [bundle, historical] = await Promise.all([loadBundle(), loadHistoricalRecords()]);
  const manifestYears: Array<{
    year: number;
    output: string;
    scheduleSnapshots: number;
    scoreboardSnapshots: number;
    scheduledGames: number;
    completedGames: number;
    snapshotCount: number;
  }> = [];

  for (const year of args.years) {
    console.log(`[history-training] building ${year}`);
    const [scheduleSnapshots, scoreboardSnapshots] = await Promise.all([
      loadParsedSnapshots<ParsedScheduleRow>({
        sourceId: "official-kbo-ko",
        year,
        datasetId: "schedule-calendar",
        parse: parseOfficialKoSchedule,
        snapshotKeyPrefix: `${year}`,
      }),
      loadParsedSnapshots<ParsedScoreboardRow>({
        sourceId: "official-kbo-en",
        year,
        datasetId: "scoreboard",
        parse: parseOfficialEnScoreboard,
      }),
    ]);

    if (scheduleSnapshots.length === 0) {
      throw new Error(`No official schedule snapshots found for ${year}. Run history backfill first.`);
    }

    const payload = buildHistoryTrainingSeason({
      year,
      historicalSnapshotKey: historical.snapshotKey,
      historicalRows: historical.payload.rows,
      bundle,
      snapshotDates: buildSeasonDateKeys(year),
      scheduleSnapshots,
      scoreboardSnapshots,
    });

    const output = await writeSeasonFile(year, payload);
    manifestYears.push({
      year,
      output,
      scheduleSnapshots: scheduleSnapshots.length,
      scoreboardSnapshots: scoreboardSnapshots.length,
      scheduledGames: payload.scheduledGameCount,
      completedGames: payload.completedGameCount,
      snapshotCount: payload.snapshots.length,
    });
    console.log(
      `[history-training] ${year} snapshots=${payload.snapshots.length} games=${payload.completedGameCount}/${payload.scheduledGameCount}`,
    );
  }

  const manifestPath = await writeManifest({
    generatedAt: new Date().toISOString(),
    years: manifestYears,
    historicalRecordSnapshotKey: historical.snapshotKey,
  });
  console.log(`[history-training] manifest -> ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
