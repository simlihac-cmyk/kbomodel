"use client";

import { useEffect, useMemo, useState } from "react";

import type { KboDataBundle } from "@/lib/domain/kbo/types";

type SeasonPatchFormProps = {
  seasons: KboDataBundle["seasons"];
  rulesets: KboDataBundle["rulesets"];
  action: (formData: FormData) => void | Promise<void>;
};

export function SeasonPatchForm({ seasons, rulesets, action }: SeasonPatchFormProps) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.seasonId ?? "");
  const selectedSeason = useMemo(
    () => seasons.find((season) => season.seasonId === seasonId) ?? seasons[0] ?? null,
    [seasonId, seasons],
  );
  const [label, setLabel] = useState(selectedSeason?.label ?? "");
  const [status, setStatus] = useState(selectedSeason?.status ?? "ongoing");
  const [phase, setPhase] = useState(selectedSeason?.phase ?? "regular");
  const [rulesetId, setRulesetId] = useState(selectedSeason?.rulesetId ?? "");

  useEffect(() => {
    setLabel(selectedSeason?.label ?? "");
    setStatus(selectedSeason?.status ?? "ongoing");
    setPhase(selectedSeason?.phase ?? "regular");
    setRulesetId(selectedSeason?.rulesetId ?? "");
  }, [selectedSeason]);

  const resetToSelectedSeason = () => {
    setLabel(selectedSeason?.label ?? "");
    setStatus(selectedSeason?.status ?? "ongoing");
    setPhase(selectedSeason?.phase ?? "regular");
    setRulesetId(selectedSeason?.rulesetId ?? "");
  };

  return (
    <form action={action} className="space-y-3">
      <select
        name="seasonId"
        value={seasonId}
        onChange={(event) => setSeasonId(event.target.value)}
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      >
        {seasons.map((season) => (
          <option key={season.seasonId} value={season.seasonId}>
            {season.year} · {season.label}
          </option>
        ))}
      </select>

      {selectedSeason ? (
        <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
          <p className="font-medium text-ink">현재 값</p>
          <p className="mt-2">라벨 {selectedSeason.label}</p>
          <p className="mt-1">
            {selectedSeason.status} · {selectedSeason.phase} · {selectedSeason.rulesetId}
          </p>
        </div>
      ) : null}

      <input
        name="label"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="시즌 라벨"
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        >
          <option value="draft">draft</option>
          <option value="ongoing">ongoing</option>
          <option value="completed">completed</option>
        </select>
        <select
          name="phase"
          value={phase}
          onChange={(event) => setPhase(event.target.value as typeof phase)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        >
          <option value="preseason">preseason</option>
          <option value="regular">regular</option>
          <option value="postseason">postseason</option>
          <option value="completed">completed</option>
        </select>
        <select
          name="rulesetId"
          value={rulesetId}
          onChange={(event) => setRulesetId(event.target.value)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        >
          {rulesets.map((ruleset) => (
            <option key={ruleset.rulesetId} value={ruleset.rulesetId}>
              {ruleset.rulesetId}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
          시즌 patch 저장
        </button>
        <button
          type="button"
          onClick={resetToSelectedSeason}
          className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm text-muted"
        >
          현재 값으로 복원
        </button>
      </div>
    </form>
  );
}
