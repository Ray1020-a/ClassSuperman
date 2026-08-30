// 同步佇列的 worker：佇列狀態就是 CalendarGrant.pendingSince 這個欄位本身（持久化在
// Postgres，重啟不掉，不需要另外的 job 表）。單一 in-process worker（ecosystem.config.js
// 是 instances:1 fork），跑一個限速的無窮迴圈：有事做就快速接著下一個，沒事做就降頻輪詢。
import "server-only";
import { prisma } from "./db";
import { calendarConfig } from "@/config/calendar";
import { syncStudentCalendar } from "./calendar-sync";

const RETRY_BACKOFF_MS = 5 * 60_000; // 失敗後 5 分鐘再重排，避免對同一個壞掉的 grant 忙迴圈

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Google Calendar API 的簡單 token bucket 限速（每分鐘 CALENDAR_SYNC_RATE_PER_MIN 個）。 */
class TokenBucket {
  private readonly capacity: number;
  private readonly intervalMs: number;
  private tokens: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private waiters: Array<() => void> = [];

  constructor(ratePerMin: number) {
    this.capacity = Math.max(1, Math.floor(ratePerMin));
    this.intervalMs = 60_000 / this.capacity;
    this.tokens = this.capacity;
  }

  private ensureStarted(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tokens = Math.min(this.capacity, this.tokens + 1);
      while (this.tokens > 0 && this.waiters.length > 0) {
        this.tokens--;
        this.waiters.shift()!();
      }
    }, this.intervalMs);
    this.timer.unref?.();
  }

  acquire(): Promise<void> {
    this.ensureStarted();
    if (this.tokens > 0) {
      this.tokens--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

const bucket = new TokenBucket(calendarConfig.syncRatePerMin);
const throttle = () => bucket.acquire();

/** 處理佇列裡最舊的一筆；回傳是否真的有事做（供呼叫端決定輪詢間隔）。 */
async function processOne(): Promise<boolean> {
  const grant = await prisma.calendarGrant.findFirst({
    where: { pendingSince: { not: null, lte: new Date() }, invalidatedAt: null },
    orderBy: { pendingSince: "asc" },
  });
  if (!grant) return false;

  try {
    await syncStudentCalendar(grant.studentId, throttle);
  } catch (err) {
    console.error(`[calendar-queue] ${grant.studentId} 同步失敗，5 分鐘後重試：`, err);
    // syncStudentCalendar 已經把 lastSyncError 寫進去了；這裡只負責把它排到未來重試，
    // 不然 pendingSince 停在過去，下一輪會立刻又撿到同一筆，變成對著同一個壞 grant 忙迴圈。
    await prisma.calendarGrant
      .update({
        where: { studentId: grant.studentId },
        data: { pendingSince: new Date(Date.now() + RETRY_BACKOFF_MS) },
      })
      .catch(() => {}); // grant 可能剛好被 disconnect 刪掉，忽略
  }
  return true;
}

/** 啟動同步佇列 worker。跟 startScheduler() 一樣，在 instrumentation.ts 裡呼叫一次。 */
export function startCalendarSyncWorker(): void {
  void (async () => {
    for (;;) {
      const didWork = await processOne().catch((err) => {
        console.error("[calendar-queue] worker 迴圈發生未預期錯誤：", err);
        return false;
      });
      await sleep(didWork ? 200 : 5000);
    }
  })();
}
