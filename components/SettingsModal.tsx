"use client";

import { useEffect, useRef, useState } from "react";
import {
  Apple,
  CalendarPlus,
  Check,
  Copy,
  Link2,
  Loader2,
  Play,
} from "lucide-react";
import { Modal } from "./Modal";

const ANDROID_APP_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.calendar";
const IOS_APP_URL = "https://apps.apple.com/app/google-calendar/id909319221";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [uuid, setUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const requestedRef = useRef(false);

  useEffect(() => {
    if (!open || requestedRef.current) return;
    let cancelled = false;
    requestedRef.current = true;
    (async () => {
      // 讓 setState 不在 effect 同步階段執行
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch("/api/getuuid");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { uuid: string };
        if (!cancelled) setUuid(data.uuid);
      } catch {
        if (!cancelled)
          setError("取得連結失敗，請稍後再試");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const httpsUrl = uuid ? `${window.location.origin}/${uuid}` : null;
  const webcalUrl = uuid
    ? `${window.location.origin.replace(/^https?:/, "webcal")}/${uuid}`
    : null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪貼簿不可用時退回選取方式
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="設定"
      icon={<Link2 className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-6">
        {/* 訂閱日曆 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border-2 border-foreground bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
              CALENDAR
            </span>
            <h3 className="font-heading font-extrabold text-foreground">
              訂閱日曆
            </h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            將此連結加入 Google Calendar 或其他行事曆 App，課程異動將自動同步。
          </p>

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-muted p-4 text-sm font-bold text-muted-foreground shadow-[3px_3px_0_0_var(--color-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              連結產生中…
            </div>
          ) : error ? (
            <div className="rounded-xl border-2 border-foreground bg-[var(--tone-rose-card)] p-4 text-sm font-bold text-[var(--tone-rose-text)] shadow-[3px_3px_0_0_var(--color-foreground)]">
              {error}
            </div>
          ) : httpsUrl && webcalUrl ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl border-2 border-foreground bg-muted px-3 py-2.5 font-mono text-xs font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)]">
                  {httpsUrl}
                </code>
                <button
                  onClick={() => copy(httpsUrl)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-3 py-2.5 font-heading text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "已複製" : "複製"}
                </button>
              </div>
              <a
                href={webcalUrl}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-accent transition-all duration-200 hover:-translate-y-0.5"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                以 webcal 開啟並新增至日曆
              </a>
              <details className="rounded-xl border-2 border-dashed border-foreground/30 bg-secondary p-3">
                <summary className="cursor-pointer text-xs font-extrabold text-foreground">
                  如何加到 Google Calendar？
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs font-medium text-muted-foreground">
                  <li>在電腦開啟 Google Calendar。</li>
                  <li>
                    左側「其他日曆」→「+」→「透過網址訂閱」。
                  </li>
                  <li>貼上上方連結後按「取得日曆」即可。</li>
                </ol>
              </details>
            </div>
          ) : null}
        </section>

        <div className="border-b-2 border-dashed border-foreground/30" />

        {/* 下載 APP */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border-2 border-foreground bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
              MOBILE
            </span>
            <h3 className="font-heading font-extrabold text-foreground">
              下載 APP
            </h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            將課表融入手機：安裝行事曆 App 並完成訂閱，隨時掌握每週行程。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href={ANDROID_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[7px_7px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[3px_3px_0_0_var(--color-foreground)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-[var(--tone-green-badge)] text-foreground shadow-[2px_2px_0_0_var(--color-foreground)] transition-transform duration-200 group-hover:-rotate-6">
                <Play className="h-5 w-5 fill-current" />
              </span>
              <span className="flex flex-col">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Android
                </span>
                <span className="font-heading font-extrabold text-foreground">
                  Google 日曆
                </span>
              </span>
            </a>
            <a
              href={IOS_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[7px_7px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[3px_3px_0_0_var(--color-foreground)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-foreground text-white shadow-[2px_2px_0_0_var(--color-primary)] transition-transform duration-200 group-hover:-rotate-6">
                <Apple className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  iOS
                </span>
                <span className="font-heading font-extrabold text-foreground">
                  App Store
                </span>
              </span>
            </a>
          </div>
        </section>
      </div>
    </Modal>
  );
}
