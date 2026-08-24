import { redirect } from "next/navigation";
import { getSession, studentIdOf } from "@/lib/tpass-auth";
import { loginUrlFor } from "@/lib/guard";
import {
  buildLeaderboard,
  getUserCourses,
  loadAllTimetables,
  loadGradeSchedule,
} from "@/lib/data";
import { semesterAnchor } from "@/lib/timetable";
import { NoAccess } from "@/components/NoAccess";
import { TimetableApp } from "@/components/TimetableApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect(loginUrlFor("/"));

  // 取 email @ 前的內容作為學號，比對 s1/s2/s3.json 以配對年級
  const studentId = studentIdOf(session);
  const user = await getUserCourses(studentId);
  if (!user) return <NoAccess />;

  const [latest, timetables, leaderboard] = await Promise.all([
    loadGradeSchedule(user.grade),
    loadAllTimetables(),
    buildLeaderboard(user.grade),
  ]);
  const anchor = semesterAnchor(latest);

  return (
    <TimetableApp
      name={user.name}
      selfId={studentId}
      selfGrade={user.grade}
      courses={user.courses}
      timetables={timetables}
      leaderboard={leaderboard}
      anchorMs={anchor.getTime()}
    />
  );
}
