"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  Bus,
  Home,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "./Modal";
import {
  DAY_NAMES,
  suggestHalfDays,
  dateLabelFor,
  type CourseEntry,
} from "@/lib/timetable";

type WeekKey = "this" | "next";

function suggestionVisual(s: string): {
  icon: LucideIcon;
  tone: string;
} {
  if (s === "校外參訪")
    return { icon: Bus, tone: "orange" };
  if (s.includes("基地"))
    return { icon: Building2, tone: "blue" };
  return { icon: Home, tone: "green" };
}

export function SuggestModal({
  open,
  onClose,
  courses,
  anchorMs,
  currentWeek,
}: {
  open: boolean;
  onClose: () => void;
  courses: CourseEntry[];
  anchorMs: number;
  currentWeek: number;
}) {
  const [weekKey, setWeekKey] = useState<WeekKey>("this");
  const anchor = useMemo(() => new Date(anchorMs), [anchorMs]);
  const week = weekKey === "this" ? currentWeek : currentWeek + 1;

  const rows = useMemo(
    () => suggestHalfDays(courses, week),
    [courses, week],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="週曆填寫建議"
      icon={<CalendarRange className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["this", `本週（第 ${currentWeek} 週）`],
              ["next", `下週（第 ${currentWeek + 1} 週）`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setWeekKey(key)}
              className={`rounded-xl border-2 border-foreground px-3 py-2 font-heading font-extrabold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)] ${
                weekKey === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border-2 border-foreground shadow-[4px_4px_0_0_var(--color-foreground)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-foreground bg-secondary">
                <th className="border-r-2 border-dashed border-foreground/30 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  DAY
                </th>
                <th className="px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  上午
                </th>
                <th className="border-l-2 border-dashed border-foreground/30 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  下午
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ day, am, pm }) => (
                <tr
                  key={day}
                  className={`border-collapse ${day % 2 === 1 ? "bg-card" : "bg-background"}`}
                >
                  <td className="border-t-2 border-dashed border-foreground/30 px-3 py-2.5 align-middle">
                    <div className="flex flex-col">
                      <span className="font-heading font-extrabold text-foreground">
                        週{DAY_NAMES[day - 1]}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        {dateLabelFor(courses, anchor, week, day)}
                      </span>
                    </div>
                  </td>
                  {[am, pm].map((v, i) => {
                    const { icon: Icon, tone } = suggestionVisual(v);
                    return (
                      <td
                        key={i}
                        className={`border-t-2 border-dashed border-foreground/30 px-3 py-2.5 align-middle ${
                          i === 1
                            ? "border-l-2"
                            : ""
                        }`}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border-2 border-foreground px-2 py-1 text-xs font-bold"
                          style={{
                            backgroundColor: `var(--tone-${tone}-badge)`,
                            color: `var(--tone-${tone}-text)`,
                          }}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {v}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded-xl border-2 border-dashed border-foreground/30 bg-secondary p-3 text-xs font-medium leading-relaxed text-muted-foreground">
          僅供參考，請依實際課程安排為準。
        </p>
      </div>
    </Modal>
  );
}
