"use client";

import { Check, Pin, Users } from "lucide-react";
import { Modal } from "./Modal";
import type { TimetableOption } from "@/lib/data";
import {
  GRADES,
  GRADE_LABELS,
  type Grade,
} from "@/lib/timetable";

export function SwitchModal({
  open,
  onClose,
  options,
  grade,
  onGradeChange,
  current,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  options: TimetableOption[];
  grade: Grade;
  onGradeChange: (g: Grade) => void;
  current: string;
  onSelect: (key: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="切換課表"
      icon={<Users className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        {/* 年級選擇 */}
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => onGradeChange(g)}
              className={`rounded-xl border-2 border-foreground px-3 py-2 font-extrabold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)] ${
                grade === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {GRADE_LABELS[g]}
            </button>
          ))}
        </div>

        <p className="text-sm font-medium text-muted-foreground">
          選擇要檢視的課表：置頂為{GRADE_LABELS[grade]}
          總表（同一時間可能有多門課程），其餘為個人課表。
        </p>
        <ol className="flex flex-col gap-2">
          {options.map((opt) => {
            const active = opt.key === current;
            const isMaster = opt.key === `master-${grade}`;
            return (
              <li key={opt.key}>
                <button
                  onClick={() => {
                    onSelect(opt.key);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 border-foreground p-3 text-left shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)] ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-foreground shadow-[1px_1px_0_0_var(--color-foreground)] ${
                      isMaster
                        ? "bg-[var(--color-tone-orange-badge)] text-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {isMaster ? (
                      <Pin className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-extrabold">
                        {opt.name.slice(0, 1)}
                      </span>
                    )}
                  </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-extrabold">
                          {opt.name}
                        </span>
                        {isMaster && (
                          <span
                            className={`rounded-md border-2 border-foreground px-1.5 py-px font-mono text-[9px] font-bold ${
                              active
                                ? "bg-white/20"
                                : "bg-[var(--color-tone-orange-badge)]"
                            }`}
                          >
                            置頂總表
                          </span>
                        )}
                      </span>
                    </span>
                    {active && <Check className="h-5 w-5 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
