export interface ScheduleItem {
  week: number;
  day: number;
  date: string;
  period: string;
}

export interface CourseEntry {
  course_name: string;
  location: string;
  total_sessions: number;
  schedules: ScheduleItem[];
}

export type StudentMap = Record<
  string,
  { name: string; class: string[] }
>;

export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:25", end: "09:15" },
  2: { start: "09:15", end: "10:05" },
  3: { start: "10:15", end: "11:05" },
  4: { start: "11:05", end: "11:55" },
  5: { start: "13:25", end: "14:15" },
  6: { start: "14:15", end: "15:05" },
  7: { start: "15:15", end: "16:05" },
  8: { start: "16:05", end: "16:55" },
};

export const PERIOD_COUNT = 8;
export const MORNING_PERIODS = [1, 2, 3, 4];
export const AFTERNOON_PERIODS = [5, 6, 7, 8];
export const DAY_NAMES = ["一", "二", "三", "四", "五"] as const;

export const GRADES = ["1", "2", "3"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_LABELS: Record<Grade, string> = {
  "1": "高一",
  "2": "高二",
  "3": "高三",
};

function splitCourses(value: string): string[] {
  return value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * 必修課程：全體共同（REQUIRED_COURSES）+ 各年級專屬
 * （REQUIRED_COURSES_S1/S2/S3）。未指定年級時僅回傳共同課程。
 */
export function requiredCourses(grade?: Grade): string[] {
  const common = splitCourses(process.env.REQUIRED_COURSES ?? "");
  if (!grade) return common;
  const specific = splitCourses(
    process.env[`REQUIRED_COURSES_S${grade}`] ?? "",
  );
  return [...common, ...specific];
}

/** 使用者應修課程名稱集合：student.json 的 class + 必修課程（含年級專屬） */
export function wantedCourseNames(
  studentClasses: string[],
  grade: Grade,
): Set<string> {
  return new Set([...studentClasses, ...requiredCourses(grade)]);
}

/**
 * 比對修課表，取得使用者課程（該年級總表中 course_name 符合者）。
 * 同名課程可能因不同地點有多筆，全部保留。
 */
export function matchUserCourses(
  studentClasses: string[],
  grade: Grade,
  latest: CourseEntry[],
): CourseEntry[] {
  const wanted = wantedCourseNames(studentClasses, grade);
  return latest.filter((e) => wanted.has(e.course_name));
}

function parsePeriods(period: string): number[] {
  return period
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => Number.isInteger(p) && p >= 1 && p <= PERIOD_COUNT);
}

export interface CellItem {
  name: string;
  location: string;
}

/** day(1~5) -> period(1~8) -> 課程列表 */
export type WeekGrid = Record<number, Record<number, CellItem[]>>;

export function buildWeekGrid(
  courses: CourseEntry[],
  week: number,
): WeekGrid {
  const grid: WeekGrid = {};
  for (const course of courses) {
    for (const s of course.schedules) {
      if (s.week !== week) continue;
      const day = s.day;
      if (day < 1 || day > 5) continue;
      grid[day] ??= {};
      for (const p of parsePeriods(s.period)) {
        (grid[day][p] ??= []).push({
          name: course.course_name,
          location: course.location,
        });
      }
    }
  }
  // 同格內同名課程去重（不同地點的同名課）
  for (const day of Object.keys(grid)) {
    const d = Number(day);
    for (const p of Object.keys(grid[d])) {
      const seen = new Set<string>();
      grid[d][Number(p)] = grid[d][Number(p)].filter((item) => {
        if (seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
      });
    }
  }
  return grid;
}

/** 解析 "M/D"，以學年度推估年份（8 月起為學年度之始） */
export function parseSchoolDate(md: string, now = new Date()): Date | null {
  const m = md.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 8 ? y : y - 1;
  return new Date(startYear + (month < 8 ? 1 : 0), month - 1, day);
}

function mondayOfWeek(d: Date): Date {
  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (nd.getDay() + 6) % 7; // 一=0
  nd.setDate(nd.getDate() - dow);
  return nd;
}

/** 由資料推估第 1 週週一日期（所有場次中最早日期所在週的週一） */
export function semesterAnchor(courses: CourseEntry[], now = new Date()): Date {
  let min: Date | null = null;
  for (const c of courses) {
    for (const s of c.schedules) {
      const d = parseSchoolDate(s.date, now);
      if (d && (!min || d < min)) min = d;
    }
  }
  if (!min) {
    // 無可用日期時退回今天所在週
    return mondayOfWeek(now);
  }
  return mondayOfWeek(min);
}

export function currentSemesterWeek(
  anchor: Date,
  now = new Date(),
): number {
  const ms = mondayOfWeek(now).getTime() - anchor.getTime();
  const wk = Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, wk);
}

export function maxSemesterWeek(courses: CourseEntry[]): number {
  let mx = 1;
  for (const c of courses)
    for (const s of c.schedules) mx = Math.max(mx, s.week);
  return mx;
}

/** 第 week 週、第 day 天（一~五）的日期字串 M/D；優先使用資料內建日期 */
export function dateLabelFor(
  courses: CourseEntry[],
  anchor: Date,
  week: number,
  day: number,
): string {
  for (const c of courses)
    for (const s of c.schedules)
      if (s.week === week && s.day === day && s.date) return s.date;
  const d = new Date(anchor.getTime());
  d.setDate(d.getDate() + (week - 1) * 7 + (day - 1));
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export type HalfDay =
  | "校外參訪"
  | string /* oo基地 */
  | "在家中";

/** 週曆填寫建議：一天分上午/下午兩次，共一到五 */
export function suggestHalfDays(
  courses: CourseEntry[],
  week: number,
): { day: number; am: string; pm: string }[] {
  const result: { day: number; am: string; pm: string }[] = [];
  for (let day = 1; day <= 5; day++) {
    result.push({
      day,
      am: halfDaySuggestion(courses, week, day, MORNING_PERIODS),
      pm: halfDaySuggestion(courses, week, day, AFTERNOON_PERIODS),
    });
  }
  return result;
}

function halfDaySuggestion(
  courses: CourseEntry[],
  week: number,
  day: number,
  periods: number[],
): string {
  const items: CellItem[] = [];
  for (const course of courses) {
    for (const s of course.schedules) {
      if (s.week !== week || s.day !== day) continue;
      const ps = parsePeriods(s.period);
      if (!ps.some((p) => periods.includes(p))) continue;
      if (!items.some((i) => i.name === course.course_name))
        items.push({ name: course.course_name, location: course.location });
    }
  }
  if (items.length === 0) return "在家中";
  // 優先序：校外參訪 > oo基地 > 線上教室或沒課
  if (
    items.some(
      (i) => i.name.includes("校外參訪") || i.location.includes("校外參訪"),
    )
  )
    return "校外參訪";
  const base = items.find((i) => i.location.includes("基地"));
  if (base) return base.location;
  return "在家中";
}

export type Tone = "green" | "blue" | "orange" | "violet" | "rose";
const TONES: Tone[] = ["green", "blue", "orange", "violet", "rose"];

export function toneOf(name: string): Tone {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
