// 把一位學生的目標課表同步進他自己的 Google 主日曆：算出目標事件集合、跟上次同步的
// 快照（SyncedEvent）比對、只送真正變動的 insert/patch/delete。穩定狀態下 diff 是空的，
// 零 API request——這是「學生無感」的來源，不是靠夜間排程，是靠沒事可做。
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { decryptToken } from "./crypto";
import { getUserCourses } from "./data";
import { courseEvents } from "./ics";
import { PERIOD_TIMES, type CourseEntry } from "./timetable";
import {
  InvalidGrantError,
  deleteEvent,
  insertEvent,
  patchEvent,
  refreshAccessToken,
  type SyncEvent,
} from "./google-calendar";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 課表 -> 目標事件集合。跟 lib/ics.ts 的 ICS 輸出共用同一套「合併連續節次」邏輯。 */
export function buildTargetEvents(courses: CourseEntry[]): SyncEvent[] {
  const out: SyncEvent[] = [];
  for (const { course, events } of courseEvents(courses)) {
    for (const ev of events) {
      const y = ev.date.getFullYear();
      const mo = pad(ev.date.getMonth() + 1);
      const dd = pad(ev.date.getDate());
      out.push({
        key: `${course.course_name}|${mo}/${dd}|${ev.startPeriod}`,
        summary: course.course_name,
        location: course.location,
        start: `${y}-${mo}-${dd}T${PERIOD_TIMES[ev.startPeriod].start}:00`,
        end: `${y}-${mo}-${dd}T${PERIOD_TIMES[ev.endPeriod].end}:00`,
      });
    }
  }
  return out;
}

function fingerprintOf(ev: SyncEvent): string {
  return createHash("sha1")
    .update(`${ev.summary}|${ev.location ?? ""}|${ev.start}|${ev.end}`)
    .digest("hex");
}

export type SyncThrottle = () => Promise<void>;
const noThrottle: SyncThrottle = async () => {};

/**
 * 同步一位學生。呼叫端（佇列 worker）負責節流與重試排程；這裡只管單一學生的完整 diff+apply，
 * 失敗就 throw，由呼叫端決定要不要重排。
 */
export async function syncStudentCalendar(
  studentId: string,
  throttle: SyncThrottle = noThrottle,
): Promise<void> {
  const grant = await prisma.calendarGrant.findUnique({ where: { studentId } });
  if (!grant || grant.invalidatedAt) return;

  let accessToken: string;
  try {
    await throttle();
    accessToken = await refreshAccessToken(decryptToken(grant.refreshToken));
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await prisma.calendarGrant.update({
        where: { studentId },
        data: {
          invalidatedAt: new Date(),
          pendingSince: null,
          lastSyncError: "Google 授權已失效（可能已在 Google 帳號頁撤銷），需要重新連結",
        },
      });
      return;
    }
    await prisma.calendarGrant.update({
      where: { studentId },
      data: { lastSyncError: `取得 access token 失敗：${(err as Error).message}` },
    });
    throw err;
  }

  const user = await getUserCourses(studentId);
  const target = buildTargetEvents(user?.courses ?? []);
  const targetByKey = new Map(target.map((e) => [e.key, e]));
  const existing = await prisma.syncedEvent.findMany({ where: { studentId } });

  try {
    for (const ev of target) {
      const prev = existing.find((e) => e.key === ev.key);
      const fingerprint = fingerprintOf(ev);
      if (!prev) {
        await throttle();
        await insertEvent(accessToken, studentId, ev);
        await prisma.syncedEvent.upsert({
          where: { studentId_key: { studentId, key: ev.key } },
          create: { studentId, key: ev.key, fingerprint },
          update: { fingerprint },
        });
      } else if (prev.fingerprint !== fingerprint) {
        await throttle();
        await patchEvent(accessToken, studentId, ev);
        await prisma.syncedEvent.update({
          where: { studentId_key: { studentId, key: ev.key } },
          data: { fingerprint },
        });
      }
    }

    for (const prev of existing) {
      if (targetByKey.has(prev.key)) continue;
      await throttle();
      await deleteEvent(accessToken, studentId, prev.key);
      await prisma.syncedEvent.delete({
        where: { studentId_key: { studentId, key: prev.key } },
      });
    }

    await prisma.calendarGrant.update({
      where: { studentId },
      data: { lastSyncAt: new Date(), lastSyncError: null, pendingSince: null },
    });
  } catch (err) {
    await prisma.calendarGrant.update({
      where: { studentId },
      data: { lastSyncError: (err as Error).message },
    });
    throw err;
  }
}
