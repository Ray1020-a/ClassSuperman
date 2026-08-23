import { redirect } from "next/navigation";
import { getSession, studentIdOf } from "@/lib/tpass-auth";
import { loginUrlFor } from "@/lib/guard";
import { buildLeaderboard, getUserCourses } from "@/lib/data";
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

  const anchor = semesterAnchor(user.courses);
  const leaderboard = await buildLeaderboard();

  return (
    <TimetableApp
      name={user.name}
      courses={user.courses}
      leaderboard={leaderboard}
      anchorMs={anchor.getTime()}
    />
  );
}
