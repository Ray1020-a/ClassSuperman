"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Unlink,
  XCircle,
} from "lucide-react";
import { Modal } from "./Modal";

interface CalendarStatus {
  connected: boolean;
  googleEmail?: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  pending?: boolean;
  invalidated?: boolean;
}

// 不用 next/link 或 <a href="/api/...">——這不是站內頁面，是要整頁跳去 Google
// 同意畫面的 API route（會 302 出站）。用 URL 物件組出來，跟 feedUrl 同一個理由：
// 避免字串常值被 eslint-plugin-next 的頁面導覽規則誤判成站內導覽。
function goToGoogleCalendarConnect(): void {
  window.location.href = new URL("/api/calendar/connect", window.location.origin).toString();
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "尚未同步過";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

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

  // 以 URL 物件明確組出訂閱連結，避免字串取代產生錯誤格式
  const feedUrl = useMemo(() => {
    if (!uuid || typeof window === "undefined") return null;
    return new URL(`/${uuid}`, window.location.origin).toString();
  }, [uuid]);

  const webcalUrl = useMemo(() => {
    if (!feedUrl) return null;
    const u = new URL(feedUrl);
    return `webcal://${u.host}${u.pathname}`;
  }, [feedUrl]);

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

  // ── Google Calendar 雙向同步 ─────────────────────────────────────
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const calRequestedRef = useRef(false);

  const fetchCalStatus = async () => {
    setCalLoading(true);
    setCalError(null);
    try {
      const res = await fetch("/api/calendar/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCalStatus((await res.json()) as CalendarStatus);
    } catch {
      setCalError("取得同步狀態失敗，請稍後再試");
    } finally {
      setCalLoading(false);
    }
  };

  useEffect(() => {
    if (!open || calRequestedRef.current) return;
    calRequestedRef.current = true;
    void fetchCalStatus();
  }, [open]);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/calendar/disconnect", { method: "POST" });
    } finally {
      setDisconnecting(false);
      await fetchCalStatus();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="設定"
      icon={<Link2 className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-6">
        {/* Google Calendar 雙向同步 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border-2 border-foreground bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
              SYNC
            </span>
            <h3 className="font-extrabold text-foreground">Google Calendar 同步</h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            把課表直接寫進你的 Google 主日曆，同學才能在「尋找時間」看到你的空堂
            （下面的訂閱連結做不到這件事）。同意後就能關掉這一頁，之後每天課表更新
            會自動幫你同步，不必再進站。
          </p>

          {calLoading && !calStatus ? (
            <div className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-muted p-4 text-sm font-bold text-muted-foreground shadow-[3px_3px_0_0_var(--color-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              查詢同步狀態中…
            </div>
          ) : calError ? (
            <div className="rounded-xl border-2 border-foreground bg-[var(--color-tone-rose-bg)] p-4 text-sm font-bold text-[var(--color-tone-rose-text)] shadow-[3px_3px_0_0_var(--color-foreground)]">
              {calError}
            </div>
          ) : calStatus?.connected ? (
            <div className="flex flex-col gap-2.5">
              <div
                className={`flex items-center gap-2.5 rounded-xl border-2 border-foreground p-3 shadow-[3px_3px_0_0_var(--color-foreground)] ${
                  calStatus.invalidated
                    ? "bg-[var(--color-tone-rose-bg)]"
                    : "bg-[var(--color-tone-green-bg)]"
                }`}
              >
                {calStatus.invalidated ? (
                  <XCircle className="h-5 w-5 shrink-0 text-[var(--color-tone-rose-text)]" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-tone-green-text)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold text-foreground">
                    {calStatus.googleEmail}
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground">
                    {calStatus.invalidated
                      ? "授權已失效，需要重新連結"
                      : calStatus.pending
                        ? "同步中…"
                        : `上次同步：${fmtDateTime(calStatus.lastSyncAt)}`}
                  </div>
                </div>
              </div>

              {calStatus.lastSyncError && !calStatus.invalidated && (
                <p className="text-xs font-bold text-[var(--color-tone-rose-text)]">
                  上次同步發生問題（會自動重試）：{calStatus.lastSyncError}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {calStatus.invalidated && (
                  <button
                    onClick={goToGoogleCalendarConnect}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    重新連結
                  </button>
                )}
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-3 py-2 text-sm font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  中斷連結
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={goToGoogleCalendarConnect}
              className="inline-flex w-fit items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
            >
              <CalendarPlus className="h-4 w-4" />
              連結 Google Calendar
            </button>
          )}
        </section>

        <div className="border-b-2 border-dashed border-foreground/30" />

        {/* 訂閱日曆 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border-2 border-foreground bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
              CALENDAR
            </span>
            <h3 className="font-extrabold text-foreground">
              訂閱日曆
            </h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            將此連結加入 Google Calendar 或其他行事曆 App，課程異動將自動同步。
            ⚠️ 這種訂閱式日曆無法被「尋找時間」查到，只適合自己看——想讓同學看到你的空堂，
            請用上面的 Google Calendar 同步。
          </p>

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-muted p-4 text-sm font-bold text-muted-foreground shadow-[3px_3px_0_0_var(--color-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              連結產生中…
            </div>
          ) : error ? (
            <div className="rounded-xl border-2 border-foreground bg-[var(--color-tone-rose-bg)] p-4 text-sm font-bold text-[var(--color-tone-rose-text)] shadow-[3px_3px_0_0_var(--color-foreground)]">
              {error}
            </div>
          ) : feedUrl && webcalUrl ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl border-2 border-foreground bg-muted px-3 py-2.5 font-mono text-xs font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)]">
                  {feedUrl}
                </code>
                <button
                  onClick={() => copy(feedUrl)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "已複製" : "複製"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copy(webcalUrl)}
                  title={webcalUrl}
                  className="inline-flex w-fit items-center gap-1.5 rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  複製 webcal:// 連結
                </button>
              </div>
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
      </div>
    </Modal>
  );
}
