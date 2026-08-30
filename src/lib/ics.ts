import {
  PERIOD_TIMES,
  parseSchoolDate,
  type CourseEntry,
} from "./timetable";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return chunks.join("\r\n");
}

interface SessionEvent {
  date: Date; // 僅取年月日
  startPeriod: number;
  endPeriod: number;
}

/** 將課程場次整理為連續節次的事件 */
export function courseEvents(courses: CourseEntry[]): {
  course: CourseEntry;
  events: SessionEvent[];
}[] {
  return courses.map((course) => {
    const byDate = new Map<string, { date: Date; periods: number[] }>();
    for (const s of course.schedules) {
      const d = parseSchoolDate(s.date);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const entry = byDate.get(key) ?? { date: d, periods: [] };
      for (const p of s.period
        .split(",")
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => Number.isInteger(p) && p >= 1 && p <= 8)) {
        if (!entry.periods.includes(p)) entry.periods.push(p);
      }
      byDate.set(key, entry);
    }

    const events: SessionEvent[] = [];
    for (const { date, periods } of byDate.values()) {
      periods.sort((a, b) => a - b);
      let runStart = periods[0];
      let prev = periods[0];
      for (let i = 1; i <= periods.length; i++) {
        const p = periods[i];
        if (p === prev + 1) {
          prev = p;
          continue;
        }
        events.push({ date, startPeriod: runStart, endPeriod: prev });
        runStart = p;
        prev = p;
      }
    }
    return { course, events };
  });
}

export function buildICS(
  courses: CourseEntry[],
  displayName: string,
  uidBase: string,
  now = new Date(),
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//classsuperman//timetable//ZH-HANT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEscape(`${displayName}的課表`),
    "X-WR-TIMEZONE:Asia/Taipei",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  for (const { course, events } of courseEvents(courses)) {
    for (const ev of events) {
      const y = ev.date.getFullYear();
      const mo = pad(ev.date.getMonth() + 1);
      const dd = pad(ev.date.getDate());
      const st = PERIOD_TIMES[ev.startPeriod].start.replace(":", "");
      const en = PERIOD_TIMES[ev.endPeriod].end.replace(":", "");
      lines.push("BEGIN:VEVENT");
      lines.push(
        `UID:${uidBase}-${y}${mo}${dd}-${ev.startPeriod}${
          ev.endPeriod !== ev.startPeriod ? `-${ev.endPeriod}` : ""
        }@classsuperman`,
      );
      lines.push(`DTSTAMP;TZID=Asia/Taipei:${stamp}`);
      lines.push(`DTSTART;TZID=Asia/Taipei:${y}${mo}${dd}T${st}00`);
      lines.push(`DTEND;TZID=Asia/Taipei:${y}${mo}${dd}T${en}00`);
      lines.push(`SUMMARY:${icsEscape(course.course_name)}`);
      if (course.location)
        lines.push(`LOCATION:${icsEscape(course.location)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
