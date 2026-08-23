import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  matchUserCourses,
  wantedCourseNames,
  type CourseEntry,
  type StudentMap,
} from "./timetable";

const DATA_DIR = path.join(process.cwd(), "data");
const CLASS_DIR = path.join(DATA_DIR, "class");
const STUDENT_FILE = path.join(DATA_DIR, "student.json");
const LATEST_FILE = path.join(CLASS_DIR, "latest.json");

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function loadStudents(): Promise<StudentMap> {
  const data = await readJson<StudentMap>(STUDENT_FILE);
  return data ?? {};
}

/**
 * 讀取最新課表。latest.json 因輪替可能瞬間不存在，
 * 依序退回 1~3.json 備份，確保系統持續可用。
 */
export async function loadLatestSchedule(): Promise<CourseEntry[]> {
  for (const f of [
    LATEST_FILE,
    ...[1, 2, 3].map((n) => path.join(CLASS_DIR, `${n}.json`)),
  ]) {
    const data = await readJson<CourseEntry[]>(f);
    if (Array.isArray(data)) return data;
  }
  return [];
}

export async function getUserCourses(studentId: string): Promise<{
  name: string;
  classes: string[];
  courses: CourseEntry[];
} | null> {
  const students = await loadStudents();
  const student = students[studentId];
  if (!student) return null;
  const latest = await loadLatestSchedule();
  return {
    name: student.name,
    classes: student.class,
    courses: matchUserCourses(student.class, latest),
  };
}

export interface LeaderboardRow {
  id: string;
  name: string;
  count: number;
}

/** 實體課程：有地點且非線上教室 */
function isPhysicalCourse(c: CourseEntry): boolean {
  return Boolean(c.location) && !c.location.includes("線上");
}

function semesterPeriodsOf(c: CourseEntry): number {
  return c.schedules.reduce(
    (sum, s) =>
      sum +
      s.period.split(",").map((p) => p.trim()).filter(Boolean).length,
    0,
  );
}

/**
 * 全體學生「實體課程節次」排行榜：
 * 統計整學期實體課程（排除線上教室）的總節次。
 * 同名課程可能因地點不同有多筆，僅計一門。
 */
export async function buildLeaderboard(): Promise<LeaderboardRow[]> {
  const students = await loadStudents();
  const latest = await loadLatestSchedule();

  const seen = new Set<string>();
  const periodsByName = new Map<string, number>();
  for (const c of latest) {
    if (!isPhysicalCourse(c) || seen.has(c.course_name)) continue;
    seen.add(c.course_name);
    periodsByName.set(c.course_name, semesterPeriodsOf(c));
  }

  return Object.entries(students)
    .map(([id, s]) => {
      const wanted = wantedCourseNames(s.class);
      let count = 0;
      for (const [name, n] of periodsByName)
        if (wanted.has(name)) count += n;
      return { id, name: s.name, count };
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
