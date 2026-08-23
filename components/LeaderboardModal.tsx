"use client";

import { useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { Modal } from "./Modal";
import type { LeaderboardRow } from "@/lib/data";
import { toneOf } from "@/lib/timetable";

type Tab = "most" | "least";

export function LeaderboardModal({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: LeaderboardRow[];
}) {
  const [tab, setTab] = useState<Tab>("most");

  const sorted =
    tab === "most"
      ? rows
      : [...rows].sort(
          (a, b) => a.count - b.count || a.id.localeCompare(b.id),
        );

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="h-4 w-4 text-[oklch(0.5_0.15_45)]" />;
    if (i === 1 || i === 2)
      return <Medal className="h-4 w-4 text-muted-foreground" />;
    return (
      <span className="font-mono text-xs font-bold text-muted-foreground">
        {i + 1}
      </span>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="課程排行榜"
      icon={<Trophy className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["most", "最多課程"],
              ["least", "最少課程"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl border-2 border-foreground px-3 py-2 font-heading font-extrabold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)] ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ol className="flex flex-col gap-2">
          {sorted.map((row, i) => {
            const tone = toneOf(row.name);
            return (
              <li
                key={row.id}
                className={`flex items-center gap-3 rounded-xl border-2 border-foreground bg-card p-3 shadow-[3px_3px_0_0_var(--color-foreground)]`}
                style={{ backgroundColor: `var(--tone-${tone}-card)` }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-card shadow-[1px_1px_0_0_var(--color-foreground)]">
                  {rankIcon(i)}
                </span>
                <span className="min-w-0 flex-1 truncate font-heading font-extrabold text-foreground">
                  {row.name}
                </span>
                <span
                  className="shrink-0 rounded-md border-2 border-foreground px-2 py-0.5 font-mono text-[11px] font-bold"
                  style={{
                    backgroundColor: `var(--tone-${tone}-badge)`,
                    color: `var(--tone-${tone}-text)`,
                  }}
                >
                  {row.count} 門實體課程
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
