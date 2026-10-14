"use client";

import {
  type LeaderboardPeriod,
  type LeaderboardRow,
  type LeaderboardScope,
  downloadLeaderboard,
  useHallOfFame,
  useLeaderboard,
  useLeaderboardTeams,
  usePinLeaderboardBanner,
} from "@/hooks/use-leaderboard";
import { useSession } from "@/hooks/use-session";
import { formatINR } from "@propninja/types/money";
import { cn } from "@propninja/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "year", label: "This Year" },
  { id: "all", label: "All Time" },
];

const SCOPES: { id: LeaderboardScope; label: string }[] = [
  { id: "team", label: "My Team" },
  { id: "all", label: "All Teams" },
  { id: "branch", label: "My Branch" },
];

const BADGE_ICON: Record<string, string> = {
  first_deal: "🥇",
  five_deals: "🖐️",
  ten_deals: "🔟",
  target_hit: "🎯",
  overachiever: "🚀",
  top_gun: "🔫",
  streak_3: "🔥",
  streak_7: "⚡",
  nr_10l: "💰",
  nr_25l: "💎",
  nr_50l: "👑",
};

function ringClass(percent: number) {
  if (percent > 100) return "ring-emerald-500";
  if (percent >= 75) return "ring-amber-400";
  return "ring-red-500";
}

function barClass(percent: number) {
  if (percent > 100) return "bg-emerald-500";
  if (percent >= 75) return "bg-amber-400";
  return "bg-red-500";
}

function trendLabel(row: LeaderboardRow) {
  if (row.trend === "up") return `⬆️ +${row.trendDelta}`;
  if (row.trend === "down") return `⬇️ -${row.trendDelta}`;
  return "➡️";
}

function unitsLabel(units: number) {
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

function Avatar({ row, large = false }: { row: LeaderboardRow; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 ring-2 ring-offset-2",
        ringClass(row.targetAchievementPercent),
        large ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs",
      )}
    >
      {row.initials}
    </div>
  );
}

function Badges({ row }: { row: LeaderboardRow }) {
  const [open, setOpen] = useState<string | null>(null);
  if (row.badges.length === 0) return null;
  return (
    <span className="inline-flex gap-1">
      {row.badges.map((badge) => (
        <button
          key={badge.type}
          type="button"
          title={badge.tooltip}
          className="text-sm leading-none"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => (current === badge.type ? null : badge.type));
          }}
        >
          <span aria-hidden>{BADGE_ICON[badge.type] ?? "🏅"}</span>
          <span className="sr-only">{badge.tooltip}</span>
          {open === badge.type ? (
            <span className="absolute z-20 mt-6 max-w-xs rounded-md bg-slate-900 px-2 py-1 text-left text-xs text-white">
              {badge.tooltip}
            </span>
          ) : null}
        </button>
      ))}
    </span>
  );
}

function useCountdown(generatedAt: string | undefined, days: number, hours: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => {
    if (!generatedAt) return { days, hours };
    const elapsed = Math.floor((now - new Date(generatedAt).getTime()) / 3_600_000);
    const total = Math.max(0, days * 24 + hours - elapsed);
    return { days: Math.floor(total / 24), hours: total % 24 };
  }, [generatedAt, days, hours, now]);
}

function minutesAgo(iso: string | undefined, now: number) {
  if (!iso) return "just now";
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

export function LeaderboardView() {
  const { session } = useSession();
  const isAdmin = session?.role === "admin";
  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const [scope, setScope] = useState<LeaderboardScope>("team");
  const [tab, setTab] = useState<"ranks" | "hall" | "teams">("ranks");
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const [clock, setClock] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [challenge, setChallenge] = useState("");
  const seen = useRef(false);
  const prevRanks = useRef(new Map<string, number>());
  const board = useLeaderboard(period, scope);
  const hall = useHallOfFame(tab === "hall");
  const teams = useLeaderboardTeams(period, tab === "teams" && Boolean(board.data?.showTeamTab));
  const pin = usePinLeaderboardBanner();
  const countdown = useCountdown(
    board.data?.generatedAt,
    board.data?.countdown.days ?? 0,
    board.data?.countdown.hours ?? 0,
  );

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!board.data?.milestone?.message) return;
    setCheer(board.data.milestone.message);
    const timer = setTimeout(() => setCheer(null), 5000);
    return () => clearTimeout(timer);
  }, [board.data?.milestone?.message]);

  useEffect(() => {
    const entries = board.data?.entries ?? [];
    if (entries.length === 0) return;
    const next: Record<string, "up" | "down"> = {};
    if (!seen.current) {
      seen.current = true;
      for (const row of entries) {
        const key = row.userId ?? `${row.rank}-${row.agentName}`;
        if (row.trend === "up" || row.trend === "down") next[key] = row.trend;
        prevRanks.current.set(key, row.rank);
      }
      setFlashes(next);
      return;
    }
    for (const row of entries) {
      const key = row.userId ?? `${row.rank}-${row.agentName}`;
      const prev = prevRanks.current.get(key);
      if (prev != null && row.rank < prev) next[key] = "up";
      if (prev != null && row.rank > prev) next[key] = "down";
      prevRanks.current.set(key, row.rank);
    }
    setFlashes(next);
  }, [board.data?.entries]);

  useEffect(() => {
    const rank = board.data?.me.rank;
    if (!rank) return;
    localStorage.setItem("pn-leaderboard-last-rank", String(rank));
  }, [board.data?.me.rank]);

  const podium = board.data?.podium ?? [];
  const ordered = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardRow[];
  const me = board.data?.me;

  return (
    <div className="relative space-y-4 pb-28">
      <style>{`
        @keyframes lb-up { from { background-color: rgb(220 252 231); transform: translateY(12px); } to { background-color: transparent; transform: translateY(0); } }
        @keyframes lb-down { from { background-color: rgb(254 226 226); transform: translateY(-12px); } to { background-color: transparent; transform: translateY(0); } }
        .lb-flash-up { animation: lb-up 0.8s ease; }
        .lb-flash-down { animation: lb-down 0.8s ease; }
      `}</style>

      {cheer ? (
        <div className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950">
          {cheer}
        </div>
      ) : null}
      {board.data?.announcement ? (
        <div className="rounded-xl bg-[#204060] px-4 py-3 text-sm text-white">
          {board.data.announcement.body}
        </div>
      ) : null}
      {board.data?.challenge ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Challenge: {board.data.challenge.body}
        </div>
      ) : null}
      {board.data?.personalBest ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          🌟 Personal Best Month!
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🏆 Leaderboard</h1>
          <p className="text-sm text-slate-500">Rankings update live as deals close</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>
            Month ends in: {countdown.days} days {countdown.hours} hrs
          </span>
          <span>Last updated: {minutesAgo(board.data?.generatedAt, clock)}</span>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 font-medium text-slate-700"
            onClick={() => void board.refresh()}
          >
            Refresh
          </button>
          {isAdmin ? (
            <>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5"
                onClick={() => void downloadLeaderboard(period, scope, "xls")}
              >
                Excel
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5"
                onClick={() => void downloadLeaderboard(period, scope, "pdf")}
              >
                PDF
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 space-y-2 bg-white/95 py-2 backdrop-blur dark:bg-slate-950/95">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                period === item.id ? "bg-[#204060] text-white" : "bg-slate-100 text-slate-600",
              )}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                scope === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
              )}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              tab === "hall" ? "bg-amber-500 text-white" : "bg-slate-100",
            )}
            onClick={() => setTab(tab === "hall" ? "ranks" : "hall")}
          >
            Hall of Fame
          </button>
          {board.data?.showTeamTab ? (
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                tab === "teams" ? "bg-indigo-600 text-white" : "bg-slate-100",
              )}
              onClick={() => setTab(tab === "teams" ? "ranks" : "teams")}
            >
              Team vs Team
            </button>
          ) : null}
        </div>
      </div>

      {isAdmin ? (
        <form
          className="grid gap-2 rounded-xl border p-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="text-sm">
            Pin announcement
            <input
              className="mt-1 w-full rounded-lg border px-2 py-1.5"
              value={announcement}
              onChange={(event) => setAnnouncement(event.target.value)}
            />
            <button
              type="button"
              className="mt-2 rounded-lg bg-[#204060] px-3 py-1.5 text-white"
              onClick={() => {
                if (!announcement.trim()) return;
                pin.mutate({ kind: "announcement", body: announcement.trim() });
                setAnnouncement("");
              }}
            >
              Pin
            </button>
          </label>
          <label className="text-sm">
            Custom challenge
            <input
              className="mt-1 w-full rounded-lg border px-2 py-1.5"
              value={challenge}
              onChange={(event) => setChallenge(event.target.value)}
            />
            <button
              type="button"
              className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-white"
              onClick={() => {
                if (!challenge.trim()) return;
                pin.mutate({ kind: "challenge", body: challenge.trim() });
                setChallenge("");
              }}
            >
              Set challenge
            </button>
          </label>
        </form>
      ) : null}

      {board.isError ? (
        <p className="text-sm text-red-600">Could not load the leaderboard.</p>
      ) : null}
      {board.isLoading && !board.data ? (
        <p className="text-sm text-slate-500">Loading rankings…</p>
      ) : null}

      {tab === "hall" ? (
        <section className="grid gap-3 md:grid-cols-2">
          <FameCard
            title="Best month ever"
            body={
              hall.data?.bestMonth
                ? `${hall.data.bestMonth.agentName} · ${hall.data.bestMonth.month} · ${formatINR(hall.data.bestMonth.totalNr)}`
                : "No collected deals yet"
            }
          />
          <FameCard
            title="Most deals in a month"
            body={
              hall.data?.mostDeals
                ? `${hall.data.mostDeals.agentName} · ${hall.data.mostDeals.dealsClosed} deals · ${hall.data.mostDeals.month}`
                : "No collected deals yet"
            }
          />
          <FameCard
            title="Longest streak"
            body={
              hall.data?.longestStreak
                ? `${hall.data.longestStreak.agentName} · ${hall.data.longestStreak.days} days`
                : "No streak yet"
            }
          />
          <FameCard
            title="Most consistent"
            body={
              hall.data?.mostConsistent
                ? `${hall.data.mostConsistent.agentName} · target hit ${hall.data.mostConsistent.months} months`
                : "No months on target yet"
            }
          />
        </section>
      ) : null}

      {tab === "teams" && board.data?.showTeamTab ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {(teams.data?.teams ?? []).map((team) => (
              <article key={team.managerId} className="rounded-2xl border p-4">
                <h3 className="font-semibold">{team.managerName}</h3>
                <p className="mt-1 text-lg font-bold">{formatINR(team.totalNr)}</p>
                <p className="text-sm text-slate-500">Team target {formatINR(team.teamTarget)}</p>
                <p className="text-sm">{team.achievementPercent}% of target</p>
                <p className="text-sm">
                  Above target {team.membersAboveTarget}/{team.memberCount}
                </p>
                {team.topPerformerName ? (
                  <p className="text-sm">
                    Top {team.topPerformerName} · {formatINR(team.topPerformerNr ?? 0)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <h3 className="font-semibold">Your team</h3>
          <RankList rows={teams.data?.myTeam ?? []} flashes={{}} onSelect={setSelected} />
        </section>
      ) : null}

      {tab === "ranks" ? (
        <>
          <div className="grid grid-cols-3 items-end gap-3">
            {ordered.map((row) => {
              const place = row.rank === 1 ? "first" : row.rank === 2 ? "second" : "third";
              return (
                <button
                  key={`${row.rank}-${row.agentName}`}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border px-2 py-3 text-center",
                    place === "first" && "min-h-52 shadow-[0_0_24px_rgba(251,191,36,0.65)]",
                    place === "second" && "min-h-40",
                    place === "third" && "min-h-36",
                    flashes[row.userId ?? `${row.rank}-${row.agentName}`] === "up" && "lb-flash-up",
                    flashes[row.userId ?? `${row.rank}-${row.agentName}`] === "down" &&
                      "lb-flash-down",
                  )}
                >
                  <span className="text-2xl">
                    {row.rank === 1
                      ? "👑 🥇"
                      : row.rank === 2
                        ? "🥈"
                        : row.rank === 3
                          ? "🥉"
                          : `#${row.rank}`}
                  </span>
                  <Avatar row={row} large={row.rank === 1} />
                  <p className={cn("mt-2 font-semibold", row.rank === 1 && "text-lg")}>
                    {row.agentName}
                  </p>
                  <Badges row={row} />
                  <p className={cn("font-bold text-slate-900", row.rank === 1 && "text-xl")}>
                    {formatINR(row.totalNr)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.targetAchievementPercent}% of target
                  </p>
                  <p className="text-xs text-slate-500">{row.dealsClosed} deals closed</p>
                </button>
              );
            })}
          </div>
          <RankList rows={board.data?.rows ?? []} flashes={flashes} onSelect={setSelected} />
        </>
      ) : null}

      {me ? (
        <aside className="sticky bottom-2 z-20 rounded-2xl border bg-white p-4 shadow-lg dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-400">My Position</p>
          <p className="text-lg font-bold">Your Rank #{me.rank}</p>
          <p>
            {formatINR(me.totalNr)} · {me.targetAchievementPercent}%
          </p>
          {me.nameAbove && me.gapToNext > 0 ? (
            <p className="text-sm">
              {formatINR(me.gapToNext)} more to overtake {me.nameAbove}
            </p>
          ) : null}
          {me.rank > 3 && me.gapToTop3 > 0 ? (
            <p className="text-sm">{formatINR(me.gapToTop3)} more to reach Top 3</p>
          ) : null}
        </aside>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-semibold">{selected.agentName}</p>
            <p className="mt-2 text-sm">
              {selected.gapToNext > 0 && selected.jumpToRank
                ? `Close 1 more deal of ${formatINR(selected.gapToNext)}+ to jump to #${selected.jumpToRank}`
                : "This rank is already at the top of the list."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatINR(selected.gapToNext)} to overtake {selected.nameAbove ?? "the rank above"}
            </p>
            <button
              type="button"
              className="mt-4 rounded-lg border px-3 py-1.5"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FameCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border p-4">
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      <p className="mt-2 font-medium">{body}</p>
    </article>
  );
}

function RankList({
  rows,
  flashes,
  onSelect,
}: {
  rows: LeaderboardRow[];
  flashes: Record<string, "up" | "down">;
  onSelect: (row: LeaderboardRow) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const key = row.userId ?? `${row.rank}-${row.agentName}`;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(row)}
            className={cn(
              "grid w-full grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left",
              flashes[key] === "up" && "lb-flash-up",
              flashes[key] === "down" && "lb-flash-down",
            )}
          >
            <span className="w-8 font-semibold">#{row.rank}</span>
            <Avatar row={row} />
            <span>
              <span className="font-medium">{row.agentName}</span> <Badges row={row} />
              {row.designation ? (
                <span className="mt-0.5 block text-xs text-slate-500">{row.designation}</span>
              ) : null}
              <span className="mt-1 block text-sm font-semibold">{formatINR(row.totalNr)}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className={cn("block h-full", barClass(row.targetAchievementPercent))}
                  style={{ width: `${Math.min(100, row.targetAchievementPercent)}%` }}
                />
              </span>
              {row.nameAbove ? (
                <span className="mt-1 block text-xs text-slate-500">
                  {formatINR(row.gapToNext)} to overtake {row.nameAbove}
                </span>
              ) : null}
            </span>
            <span className="text-right text-xs text-slate-500">
              <span className="block">{row.targetAchievementPercent}%</span>
              <span className="block">
                {row.dealsClosed} deals | {unitsLabel(row.unitsClosed)} units
              </span>
              <span className="block">{trendLabel(row)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
