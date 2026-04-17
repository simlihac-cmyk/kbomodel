"use client";

import { useEffect, useMemo, useState } from "react";

import type { ManualAdjustmentPatch, TeamDisplay } from "@/lib/domain/kbo/types";

type ManualAdjustmentFormProps = {
  teamDisplays: TeamDisplay[];
  patches: ManualAdjustmentPatch[];
  action: (formData: FormData) => void | Promise<void>;
};

export function ManualAdjustmentForm({ teamDisplays, patches, action }: ManualAdjustmentFormProps) {
  const [seasonTeamId, setSeasonTeamId] = useState(teamDisplays[0]?.seasonTeamId ?? "");
  const patchById = useMemo(
    () => Object.fromEntries(patches.map((patch) => [patch.seasonTeamId, patch])),
    [patches],
  );
  const selectedTeam = useMemo(
    () => teamDisplays.find((team) => team.seasonTeamId === seasonTeamId) ?? teamDisplays[0] ?? null,
    [seasonTeamId, teamDisplays],
  );
  const currentPatch = seasonTeamId ? patchById[seasonTeamId] : null;
  const [offenseDelta, setOffenseDelta] = useState(currentPatch?.offenseDelta?.toString() ?? "0");
  const [starterDelta, setStarterDelta] = useState(currentPatch?.starterDelta?.toString() ?? "0");
  const [bullpenDelta, setBullpenDelta] = useState(currentPatch?.bullpenDelta?.toString() ?? "0");
  const [confidenceDelta, setConfidenceDelta] = useState(currentPatch?.confidenceDelta?.toString() ?? "0");
  const [note, setNote] = useState(currentPatch?.note ?? "");

  useEffect(() => {
    setOffenseDelta(currentPatch?.offenseDelta?.toString() ?? "0");
    setStarterDelta(currentPatch?.starterDelta?.toString() ?? "0");
    setBullpenDelta(currentPatch?.bullpenDelta?.toString() ?? "0");
    setConfidenceDelta(currentPatch?.confidenceDelta?.toString() ?? "0");
    setNote(currentPatch?.note ?? "");
  }, [currentPatch]);

  const resetToCurrentPatch = () => {
    setOffenseDelta(currentPatch?.offenseDelta?.toString() ?? "0");
    setStarterDelta(currentPatch?.starterDelta?.toString() ?? "0");
    setBullpenDelta(currentPatch?.bullpenDelta?.toString() ?? "0");
    setConfidenceDelta(currentPatch?.confidenceDelta?.toString() ?? "0");
    setNote(currentPatch?.note ?? "");
  };

  return (
    <form action={action} className="space-y-3">
      <select
        name="seasonTeamId"
        value={seasonTeamId}
        onChange={(event) => setSeasonTeamId(event.target.value)}
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      >
        {teamDisplays.map((team) => (
          <option key={team.seasonTeamId} value={team.seasonTeamId}>
            {team.displayNameKo}
          </option>
        ))}
      </select>

      <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
        <p className="font-medium text-ink">현재 보정값{selectedTeam ? ` · ${selectedTeam.displayNameKo}` : ""}</p>
        {currentPatch ? (
          <>
            <p className="mt-2">
              O {currentPatch.offenseDelta}, S {currentPatch.starterDelta}, B {currentPatch.bullpenDelta}, C {currentPatch.confidenceDelta}
            </p>
            <p className="mt-1">{currentPatch.note || "메모 없음"}</p>
          </>
        ) : (
          <p className="mt-2">아직 저장된 보정이 없습니다.</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input name="offenseDelta" type="number" step="0.1" placeholder="공격력 delta" value={offenseDelta} onChange={(event) => setOffenseDelta(event.target.value)} className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink" />
        <input name="starterDelta" type="number" step="0.1" placeholder="선발 delta" value={starterDelta} onChange={(event) => setStarterDelta(event.target.value)} className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink" />
        <input name="bullpenDelta" type="number" step="0.1" placeholder="불펜 delta" value={bullpenDelta} onChange={(event) => setBullpenDelta(event.target.value)} className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink" />
        <input name="confidenceDelta" type="number" step="0.01" placeholder="신뢰도 delta" value={confidenceDelta} onChange={(event) => setConfidenceDelta(event.target.value)} className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink" />
      </div>
      <input name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="메모" className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
          저장
        </button>
        <button
          type="button"
          onClick={resetToCurrentPatch}
          className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm text-muted"
        >
          현재 값으로 복원
        </button>
      </div>
    </form>
  );
}
