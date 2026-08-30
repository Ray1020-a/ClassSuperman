import { redirect } from "next/navigation";
import { tpass, studentIdOf, loginUrlFor, deniedUrlFor, authConfig } from "@/config/auth";
import {
  buildLeaderboard,
  getUserCourses,
  loadAllTimetables,
  loadGradeSchedule,
} from "@/lib/data";
import { GRADES, semesterAnchor } from "@/lib/timetable";
import { NoAccess } from "@/components/NoAccess";
import { TimetableApp } from "@/components/TimetableApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await tpass.getSession();
  if (!session) redirect(loginUrlFor("/"));

  const perm = tpass.permOf(session);
  if (!perm.read) redirect(deniedUrlFor());

  // 取 email @ 前的內容作為學號，比對 s1/s2/s3.json 以配對年級
  const studentId = studentIdOf(session);
  const user = await getUserCourses(studentId);
  if (!user) return <NoAccess portalUrl={authConfig.portalUrl} />;

  const [latest, timetables, leaderboardRows] = await Promise.all([
    loadGradeSchedule(user.grade),
    loadAllTimetables(),
    Promise.all(GRADES.map(async (g) => [g, await buildLeaderboard(g)] as const)),
  ]);
  const anchor = semesterAnchor(latest);
  const rowsByGrade = Object.fromEntries(leaderboardRows) as Record<
    (typeof GRADES)[number],
    Awaited<ReturnType<typeof buildLeaderboard>>
  >;

  return (
    <TimetableApp
      name={user.name}
      selfId={studentId}
      selfGrade={user.grade}
      courses={user.courses}
      timetables={timetables}
      rowsByGrade={rowsByGrade}
      anchorMs={anchor.getTime()}
    />
  );
}
