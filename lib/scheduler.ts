import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CourseEntry } from "./timetable";

const CLASS_DIR = path.join(process.cwd(), "data", "class");
const LATEST = path.join(CLASS_DIR, "latest.json");
const TMP = path.join(CLASS_DIR, "latest.new.json");

interface RawCell {
  value?: string;
  day?: number;
  period?: number | string;
  rowSpan?: number;
}
interface RawRow {
  isHeader?: boolean;
  weekNum?: number | string;
  cells?: RawCell[];
}

/**
 * 移植自 Model/api.py 的 parse_and_merge_schedule：
 * 解析課表 API 原始資料，合併為 { course_name, location, total_sessions, schedules } 陣列。
 */
export function parseAndMergeSchedule(rawData: unknown): CourseEntry[] {
  const data = (
    Array.isArray(rawData) ? rawData[0] : rawData
  ) as { tableData?: RawRow[] };
  const tableData = data?.tableData ?? [];

  const dateMap = new Map<string, string>(); // "week,day" -> "9/2"
  const coursesMap = new Map<string, CourseEntry>();

  // 1. 解析 Header 提取每週各天的日期
  for (const row of tableData) {
    if (!row.isHeader) continue;
    const weekNum = Number(row.weekNum ?? 0);
    row.cells?.forEach((cell, idx) => {
      if (2 <= idx && idx <= 8) {
        const day = idx - 1;
        const match = /\((.*?)\)/.exec(cell.value ?? "");
        if (match) dateMap.set(`${weekNum},${day}`, match[1]);
      }
    });
  }

  // 2. 解析課表內容
  for (const row of tableData) {
    if (row.isHeader) continue;
    const weekNum = Number(row.weekNum ?? 0);

    for (const cell of row.cells ?? []) {
      const rawVal = (cell.value ?? "").trim();
      const day = cell.day;
      const periodRaw = cell.period;
      if (!rawVal || day == null || periodRaw == null) continue;

      // 過濾「備註」欄位
      const periodStr = String(periodRaw).trim();
      if (periodStr === "備註") continue;

      // 節次格式轉換（rowSpan: 3, period: 1 -> "1,2,3"）
      if (!/^\d+$/.test(periodStr)) continue;
      const startP = parseInt(periodStr, 10);
      const rowSpan = Number(cell.rowSpan ?? 1);
      const periodFormatted = Array.from(
        { length: rowSpan },
        (_, i) => String(startP + i),
      ).join(",");

      // 依分隔線（─）拆分同時間的多門選修課
      const subCourseStrings = rawVal
        .split(/\s*─+\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

      const dateStr = dateMap.get(`${weekNum},${Number(day)}`) ?? "";

      for (const courseStr of subCourseStrings) {
        const m = /^(.*?)(?:\s*\[(.*?)\])?$/.exec(courseStr);
        let courseName = courseStr;
        let location = "";
        if (m) {
          courseName = m[1].trim();
          location = m[2] || "";
        }

        // 過濾名稱含「假」的課程
        if (courseName.includes("假")) continue;

        // 地點為空時預設「吉林基地」
        if (!location) location = "吉林基地";

        const key = `${course_name_key(courseName)}|${location}`;
        let entry = coursesMap.get(key);
        if (!entry) {
          entry = {
            course_name: courseName,
            location,
            total_sessions: 0,
            schedules: [],
          };
          coursesMap.set(key, entry);
        }
        entry.schedules.push({
          week: weekNum,
          day: Number(day),
          date: dateStr,
          period: periodFormatted,
        });
        entry.total_sessions++;
      }
    }
  }

  return [...coursesMap.values()];
}

function course_name_key(s: string): string {
  return s;
}

async function exists(f: string): Promise<boolean> {
  try {
    await fs.access(f);
    return true;
  } catch {
    return false;
  }
}

/** 輪替備份：latest -> 1 -> 2 -> 3（超過三個刪除），僅保留最新抓取 */
async function rotateBackups(): Promise<void> {
  const f3 = path.join(CLASS_DIR, "3.json");
  const f2 = path.join(CLASS_DIR, "2.json");
  const f1 = path.join(CLASS_DIR, "1.json");

  await fs.rm(f3, { force: true });
  if (await exists(f2)) await fs.rename(f2, f3);
  if (await exists(f1)) await fs.rename(f1, f2);
  if (await exists(LATEST)) await fs.copyFile(LATEST, f1);
}

/** 抓取最新課表；過程中盡力保留 latest.json 使系統持續運作 */
export async function fetchLatestSchedule(): Promise<boolean> {
  const url = process.env.SCHEDULE_API_URL;
  if (!url) {
    console.warn("[scheduler] 未設定 SCHEDULE_API_URL，略過抓取");
    return false;
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseAndMergeSchedule(await res.json());

    // 新資料已在記憶體就緒，才開始輪替舊檔
    await fs.mkdir(CLASS_DIR, { recursive: true });
    await fs.writeFile(TMP, JSON.stringify(parsed, null, 2), "utf8");
    await rotateBackups();
    await fs.rm(LATEST, { force: true });
    await fs.rename(TMP, LATEST);
    console.log(
      `[scheduler] 課表已更新：共 ${parsed.length} 門課程`,
    );
    return true;
  } catch (err) {
    console.error("[scheduler] 抓取失敗，保留現有 latest.json：", err);
    return false;
  }
}

function msUntilNext1800Taipei(now = new Date()): number {
  // 18:00 UTC+8 == 10:00 UTC
  const target = new Date(now);
  target.setUTCHours(10, 0, 0, 0);
  if (target.getTime() <= now.getTime())
    target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

/** 啟動排程：每次啟動/重啟立即抓取一次；之後每天 18:00（UTC+8）抓取 */
export function startScheduler(): void {
  void (async () => {
    await fetchLatestSchedule();
    if (!(await exists(LATEST))) {
      console.warn("[scheduler] 啟動抓取後仍無 latest.json");
    }
    const scheduleNext = () => {
      const delay = msUntilNext1800Taipei();
      console.log(
        `[scheduler] next fetch in ${Math.round(delay / 60000)} min (18:00 UTC+8)`,
      );
      setTimeout(() => {
        void fetchLatestSchedule().finally(scheduleNext);
      }, delay);
    };
    scheduleNext();
  })();
}
