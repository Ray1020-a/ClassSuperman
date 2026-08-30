"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6">
      <button
        aria-label="關閉"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-2 border-foreground bg-card shadow-[4px_4px_0_0_var(--color-foreground)] sm:max-h-[85vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-foreground/30 p-4">
          <div className="flex items-center gap-3">
            {icon ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-primary text-primary-foreground shadow-[2px_2px_0_0_var(--color-foreground)]">
                {icon}
              </span>
            ) : null}
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-foreground bg-card text-foreground shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[1px_1px_0_0_var(--color-foreground)]"
            aria-label="關閉彈窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
