"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

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
            <h3 className="font-extrabold text-foreground">
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
