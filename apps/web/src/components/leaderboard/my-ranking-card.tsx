"use client";

import {
  useLeaderboard,
  useLeaderboardAvatar,
  useSetLeaderboardAvatar,
} from "@/hooks/use-leaderboard";
import { formatINR } from "@propninja/types/money";
import Link from "next/link";

export function MyRankingCard() {
  const board = useLeaderboard("month", "team");
  const me = board.data?.me;
  return (
    <section className="rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">My Ranking</h2>
        <Link href="/leaderboard" className="text-sm font-medium text-[#204060] hover:underline">
          View Leaderboard
        </Link>
      </div>
      {board.isLoading && !me ? <p className="mt-2 text-sm text-slate-500">Loading rank…</p> : null}
      {me ? (
        <p className="mt-2 text-sm">
          Rank #{me.rank} · {formatINR(me.totalNr)} · {me.targetAchievementPercent}% of target ·{" "}
          {me.dealsClosed} deals
        </p>
      ) : null}
    </section>
  );
}

export function ViewLeaderboardCard() {
  return (
    <Link
      href="/leaderboard"
      className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 font-medium shadow-sm hover:bg-slate-50"
    >
      <span>View Leaderboard</span>
      <span aria-hidden>🏆</span>
    </Link>
  );
}

export function LeaderboardAvatarToggle() {
  const me = useLeaderboardAvatar();
  const save = useSetLeaderboardAvatar();
  const show = me.data?.showLeaderboardAvatar === true;
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        Show my photo on the leaderboard
        <span className="mt-1 block text-xs text-slate-500">
          Off by default. Initials are shown until you turn this on.
        </span>
      </span>
      <input
        type="checkbox"
        checked={show}
        disabled={save.isPending}
        onChange={(event) => save.mutate(event.target.checked)}
      />
    </label>
  );
}
