import { redirect } from "next/navigation";
import { getSession, studentIdOf } from "@/lib/tpass-auth";
import { loginUrlFor } from "@/lib/guard";
import {
  buildLeaderboard,
  getUserCourses,
  loadAllTimetables,
  loadLatestSchedule,
} from "@/lib/data";
import { semesterAnchor } from "@/lib/timetable";
import { NoAccess } from "@/components/NoAccess";
import { TimetableApp } from "@/components/TimetableApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect(loginUrlFor("/"));

  // 取 email @ 前的內容作為學號，比對 data/student.json
  const studentId = studentIdOf(session);
  const user = await getUserCourses(studentId);
  if (!user) return <NoAccess />;

  const [latest, timetables, leaderboard] = await Promise.all([
    loadLatestSchedule(),
    loadAllTimetables(),
    buildLeaderboard(),
  ]);
  const anchor = semesterAnchor(latest);

  return (
    <TimetableApp
      name={user.name}
      selfId={studentId}
      courses={user.courses}
      timetables={timetables}
      leaderboard={leaderboard}
      anchorMs={anchor.getTime()}
    />
  );
}
