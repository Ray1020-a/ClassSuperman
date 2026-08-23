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

/** 全體學生課程數（修課表 ∪ 必修，且存在於最新課表中）排行榜 */
export async function buildLeaderboard(): Promise<LeaderboardRow[]> {
  const students = await loadStudents();
  const latest = await loadLatestSchedule();
  const known = new Set(latest.map((c) => c.course_name));
  return Object.entries(students)
    .map(([id, s]) => ({
      id,
      name: s.name,
      count: [...wantedCourseNames(s.class)].filter((c) =>
        known.has(c),
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
