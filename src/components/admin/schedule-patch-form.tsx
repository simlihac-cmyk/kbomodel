"use client";

import { useEffect, useMemo, useState } from "react";

import type { Game, GameStatus, TeamDisplay } from "@/lib/domain/kbo/types";
import { formatDateTimeInputValue, formatDateTimeLabel } from "@/lib/utils/format";

type SchedulePatchFormProps = {
  games: Game[];
  teamDisplays: TeamDisplay[];
  initialGameId?: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function SchedulePatchForm({
  games,
  teamDisplays,
  initialGameId,
  action,
}: SchedulePatchFormProps) {
  const [gameId, setGameId] = useState(initialGameId ?? games[0]?.gameId ?? "");
  const displayById = useMemo(
    () => Object.fromEntries(teamDisplays.map((team) => [team.seasonTeamId, team])),
    [teamDisplays],
  );
  const selectedGame = useMemo(
    () => games.find((game) => game.gameId === gameId) ?? games.find((game) => game.gameId === initialGameId) ?? games[0] ?? null,
    [gameId, games, initialGameId],
  );

  const selectedStatus = selectedGame?.status ?? "scheduled";
  const selectedHome = selectedGame ? displayById[selectedGame.homeSeasonTeamId] : null;
  const selectedAway = selectedGame ? displayById[selectedGame.awaySeasonTeamId] : null;
  const [status, setStatus] = useState(selectedStatus);
  const [scheduledAt, setScheduledAt] = useState(
    selectedGame?.scheduledAt ? formatDateTimeInputValue(selectedGame.scheduledAt) : "",
  );
  const [awayScore, setAwayScore] = useState(selectedGame?.awayScore?.toString() ?? "");
  const [homeScore, setHomeScore] = useState(selectedGame?.homeScore?.toString() ?? "");
  const [note, setNote] = useState(selectedGame?.note ?? "");

  useEffect(() => {
    if (initialGameId) {
      setGameId(initialGameId);
    }
  }, [initialGameId]);

  useEffect(() => {
    setStatus(selectedGame?.status ?? "scheduled");
    setScheduledAt(selectedGame?.scheduledAt ? formatDateTimeInputValue(selectedGame.scheduledAt) : "");
    setAwayScore(selectedGame?.awayScore?.toString() ?? "");
    setHomeScore(selectedGame?.homeScore?.toString() ?? "");
    setNote(selectedGame?.note ?? "");
  }, [selectedGame]);

  const resetToSelectedGame = () => {
    setStatus(selectedGame?.status ?? "scheduled");
    setScheduledAt(selectedGame?.scheduledAt ? formatDateTimeInputValue(selectedGame.scheduledAt) : "");
    setAwayScore(selectedGame?.awayScore?.toString() ?? "");
    setHomeScore(selectedGame?.homeScore?.toString() ?? "");
    setNote(selectedGame?.note ?? "");
  };

  return (
    <form action={action} className="space-y-3">
      <select
        name="gameId"
        value={gameId}
        onChange={(event) => setGameId(event.target.value)}
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      >
        {games.map((game) => (
          <option key={game.gameId} value={game.gameId}>
            {displayById[game.awaySeasonTeamId]?.shortNameKo} @ {displayById[game.homeSeasonTeamId]?.shortNameKo} · {formatDateTimeLabel(game.scheduledAt)}
          </option>
        ))}
      </select>

      {selectedGame ? (
        <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
          <p className="font-medium text-ink">
            현재 값 · {selectedAway?.shortNameKo} @ {selectedHome?.shortNameKo}
          </p>
          <p className="mt-2">
            상태 {selectedGame.status} · {formatDateTimeLabel(selectedGame.scheduledAt)}
          </p>
          <p className="mt-1">
            점수 {selectedGame.awayScore ?? "-"}:{selectedGame.homeScore ?? "-"} · {selectedGame.note ?? "메모 없음"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        >
          {(["scheduled", "final", "postponed", "suspended", "tbd"] satisfies GameStatus[]).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          name="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="awayScore"
          type="number"
          placeholder="원정 점수"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="homeScore"
          type="number"
          placeholder="홈 점수"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
      </div>

      <input
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="메모"
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
          경기 patch 저장
        </button>
        <button
          type="button"
          onClick={resetToSelectedGame}
          className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm text-muted"
        >
          현재 값으로 복원
        </button>
      </div>
    </form>
  );
}
