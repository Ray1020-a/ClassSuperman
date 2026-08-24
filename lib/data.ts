import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  matchUserCourses,
  wantedCourseNames,
  GRADES,
  GRADE_LABELS,
  type CourseEntry,
  type Grade,
} from "./timetable";

const DATA_DIR = path.join(process.cwd(), "data");
const CLASS_DIR = path.join(DATA_DIR, "class");

export interface StudentInfo {
  name: string;
  class: string[];
  grade: Grade;
}
export type StudentMap = Record<string, StudentInfo>;

function studentFile(grade: Grade): string {
  return path.join(DATA_DIR, `s${grade}.json`);
}
function gradeClassDir(grade: Grade): string {
  return path.join(CLASS_DIR, `s${grade}`);
}
function gradeLatest(grade: Grade): string {
  return path.join(gradeClassDir(grade), "latest.json");
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** 讀取全部學生（s1/s2/s3.json），並標記所屬年級 */
export async function loadStudents(): Promise<StudentMap> {
  const out: StudentMap = {};
  for (const grade of GRADES) {
    const data = await readJson<
      Record<string, { name: string; class: string[] }>
    >(studentFile(grade));
    if (!data) continue;
    for (const [id, s] of Object.entries(data))
      out[id] = { name: s.name, class: s.class ?? [], grade };
  }
  return out;
}

/**
 * 讀取該年級最新課表。latest.json 因輪替可能瞬間不存在，
 * 依序退回 1~3.json 備份，確保系統持續可用。
 */
export async function loadGradeSchedule(grade: Grade): Promise<CourseEntry[]> {
  for (const f of [
    gradeLatest(grade),
    ...[1, 2, 3].map((n) => path.join(gradeClassDir(grade), `${n}.json`)),
  ]) {
    const data = await readJson<CourseEntry[]>(f);
    if (Array.isArray(data)) return data;
  }
  return [];
}

export async function getUserCourses(studentId: string): Promise<{
  name: string;
  classes: string[];
  grade: Grade;
  courses: CourseEntry[];
} | null> {
  const students = await loadStudents();
  const student = students[studentId];
  if (!student) return null;
  const latest = await loadGradeSchedule(student.grade);
  return {
    name: student.name,
    classes: student.class,
    grade: student.grade,
    courses: matchUserCourses(student.class, student.grade, latest),
  };
}

/** 可切換檢視的課表選項 */
export interface TimetableOption {
  key: string; // "master-{grade}"（年級總表）或學號
  name: string;
  grade: Grade;
  courseCount: number;
  courses: CourseEntry[];
}

/** 載入可切換的課表：各年級置頂總表 + 每位學生的個人課表 */
export async function loadAllTimetables(): Promise<TimetableOption[]> {
  const students = await loadStudents();
  const out: TimetableOption[] = [];
  for (const grade of GRADES) {
    const latest = await loadGradeSchedule(grade);
    out.push({
      key: `master-${grade}`,
      name: `${GRADE_LABELS[grade]}總表`,
      grade,
      courseCount: latest.length,
      courses: latest,
    });
  }
  for (const [id, s] of Object.entries(students)) {
    const courses = matchUserCourses(
      s.class,
      s.grade,
      await loadGradeSchedule(s.grade),
    );
    out.push({
      key: id,
      name: s.name,
      grade: s.grade,
      courseCount: courses.length,
      courses,
    });
  }
  return out;
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
 * 該年級學生「實體課程節次」排行榜（各年級獨立統計）：
 * 統計整學期該年級總表實體課程（排除線上教室）的總節次。
 * 同名課程可能因地點不同有多筆，僅計一門。
 */
export async function buildLeaderboard(grade: Grade): Promise<LeaderboardRow[]> {
  const students = await loadStudents();
  const latest = await loadGradeSchedule(grade);

  const seen = new Set<string>();
  const periodsByName = new Map<string, number>();
  for (const c of latest) {
    if (!isPhysicalCourse(c) || seen.has(c.course_name)) continue;
    seen.add(c.course_name);
    periodsByName.set(c.course_name, semesterPeriodsOf(c));
  }

  return Object.entries(students)
    .filter(([, s]) => s.grade === grade)
    .map(([id, s]) => {
      const wanted = wantedCourseNames(s.class, s.grade);
      let count = 0;
      for (const [name, n] of periodsByName)
        if (wanted.has(name)) count += n;
      return { id, name: s.name, count };
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
