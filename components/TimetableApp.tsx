"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  Settings,
  Trophy,
} from "lucide-react";
import {
  DAY_NAMES,
  PERIOD_COUNT,
  PERIOD_TIMES,
  buildWeekGrid,
  currentSemesterWeek,
  dateLabelFor,
  maxSemesterWeek,
  toneOf,
  type CourseEntry,
} from "@/lib/timetable";
import type { LeaderboardRow } from "@/lib/data";
import { SettingsModal } from "./SettingsModal";
import { LeaderboardModal } from "./LeaderboardModal";
import { SuggestModal } from "./SuggestModal";

export function TimetableApp({
  name,
  courses,
  leaderboard,
  anchorMs,
}: {
  name: string;
  courses: CourseEntry[];
  leaderboard: LeaderboardRow[];
  anchorMs: number;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const anchor = useMemo(() => new Date(anchorMs), [anchorMs]);
  const currentWeek = useMemo(
    () => currentSemesterWeek(anchor, now),
    [anchor, now],
  );
  const maxWeek = Math.max(maxSemesterWeek(courses), currentWeek) + 1;

  const week = currentWeek + weekOffset;
  const grid = useMemo(
    () => buildWeekGrid(courses, week),
    [courses, week],
  );
  const isCurrentWeek = weekOffset === 0;

  // 今天為星期幾（一=0 … 五=4），供當日欄位高亮
  const todayIdx = ((now.getDay() + 6) % 7) as number;
  const showToday = isCurrentWeek && todayIdx <= 4;

  const weekStart = new Date(anchor.getTime());
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekEnd.getDate() + 4);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b-2 border-foreground bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <span className="font-mono text-lg font-extrabold tracking-tight text-foreground">
            Class<span className="text-primary">S</span>uperman
          </span>

          <div className="flex items-center gap-2">
            {/* 排行榜 */}
            <IconButton
              title="課程排行榜"
              onClick={() => setBoardOpen(true)}
              tone="orange"
            >
              <Trophy className="h-5 w-5" />
            </IconButton>
            {/* 週曆填寫建議 */}
            <IconButton
              title="週曆填寫建議"
              onClick={() => setSuggestOpen(true)}
              tone="violet"
            >
              <CalendarRange className="h-5 w-5" />
            </IconButton>
            {/* 設定 */}
            <IconButton
              title="設定"
              onClick={() => setSettingsOpen(true)}
              tone="blue"
            >
              <Settings className="h-5 w-5" />
            </IconButton>

            <span className="ml-1 hidden flex-col leading-tight sm:flex">
              <span className="font-heading text-sm font-extrabold text-foreground">
                {name}
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                STUDENT
              </span>
            </span>

            <form action="/api/auth/logout" method="post" className="m-0">
              <IconButton title="登出" submit tone="rose">
                <LogOut className="h-5 w-5" />
              </IconButton>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="hero-dots" aria-hidden />

        {/* 週導覽 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton
              title="上一週"
              onClick={() => setWeekOffset((w) => Math.max(w - 1, 1 - week))}
            >
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <div className="rounded-xl border-2 border-foreground bg-card px-4 py-1.5 shadow-[3px_3px_0_0_var(--color-foreground)]">
              <span className="font-heading font-extrabold text-foreground">
                第 {week} 週
              </span>
              <span className="ml-2 font-mono text-xs font-bold text-muted-foreground">
                {fmtMD(weekStart)} – {fmtMD(weekEnd)}
              </span>
            </div>
            <IconButton
              title="下一週"
              onClick={() => setWeekOffset((w) => Math.min(w + 1, maxWeek - week))}
            >
              <ChevronRight className="h-5 w-5" />
            </IconButton>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary"
              >
                回本週
              </button>
            )}
          </div>
          <span className="hidden rounded-md border-2 border-foreground bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground sm:block">
            {name} 的個人課表
          </span>
        </div>

        {/* 課表格 */}
        <div className="overflow-x-auto rounded-2xl border-2 border-foreground bg-card pb-2 shadow-[4px_4px_0_0_var(--color-foreground)] [-webkit-overflow-scrolling:touch]">
          <div className="min-w-[720px] p-3">
            {/* 表頭 */}
            <div className="grid grid-cols-[86px_repeat(5,minmax(0,1fr))] gap-1.5">
              <div />
              {DAY_NAMES.map((d, i) => (
                <div
                  key={d}
                  className={`rounded-xl border-2 px-2 py-1.5 text-center ${
                    showToday && i === todayIdx
                      ? "border-foreground bg-foreground text-[oklch(0.99_0_0)]"
                      : "border-dashed border-transparent"
                  }`}
                >
                  <div className="font-heading font-extrabold">週{d}</div>
                  <div
                    className={`font-mono text-[10px] font-bold ${
                      showToday && i === todayIdx
                        ? "text-[oklch(0.99_0_0)]/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dateLabelFor(courses, anchor, week, i + 1)}
                  </div>
                </div>
              ))}
            </div>

            {/* 節次列 */}
            {Array.from({ length: PERIOD_COUNT }, (_, idx) => idx + 1).map(
              (p) => (
                <div
                  key={p}
                  className="mt-1.5 grid grid-cols-[86px_repeat(5,minmax(0,1fr))] gap-1.5"
                >
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/30 bg-secondary px-1 py-1.5">
                    <span className="font-heading text-xs font-extrabold text-foreground">
                      第{p}節
                    </span>
                    <span className="font-mono text-[9px] font-bold text-muted-foreground">
                      {PERIOD_TIMES[p].start}
                    </span>
                    <span className="font-mono text-[9px] font-bold text-muted-foreground">
                      {PERIOD_TIMES[p].end}
                    </span>
                  </div>
                  {DAY_NAMES.map((_, dayIdx) => {
                    const items = grid[dayIdx + 1]?.[p] ?? [];
                    return (
                      <div
                        key={dayIdx}
                        className={`min-h-[52px] rounded-xl border-2 p-1 ${
                          showToday && dayIdx === todayIdx
                            ? "border-solid border-foreground/60"
                            : "border-dashed border-foreground/20"
                        }`}
                      >
                        {items.map((item) => {
                          const tone = toneOf(item.name);
                          return (
                            <div
                              key={item.name}
                              className={`course-chip mb-1 rounded-lg border-2 border-foreground px-1.5 py-1 last:mb-0 tone-${tone}`}
                              style={{
                                backgroundColor: `var(--tone-${tone}-card)`,
                                borderLeftWidth: 4,
                              }}
                              title={`${item.name} @ ${item.location}`}
                            >
                              <div className="course-name truncate text-xs font-extrabold">
                                {item.name}
                              </div>
                              <div className="flex items-center gap-0.5 truncate font-mono text-[9px] font-bold text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                {item.location}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] font-bold text-muted-foreground">
          共 {courses.length} 門課 · 資料每日 18:00 自動更新
        </p>
      </main>

      {/* Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LeaderboardModal
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        rows={leaderboard}
      />
      <SuggestModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        courses={courses}
        anchorMs={anchorMs}
        currentWeek={currentWeek}
      />
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  submit,
  tone = "green",
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  submit?: boolean;
  tone?: "green" | "blue" | "orange" | "violet" | "rose";
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground text-foreground shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[1px_1px_0_0_var(--color-foreground)]`}
      style={{ backgroundColor: `var(--tone-${tone}-badge)` }}
    >
      {children}
    </button>
  );
}

function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
