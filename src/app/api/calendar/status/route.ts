import { NextResponse } from "next/server";
import { tpass, studentIdOf } from "@/config/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const studentId = studentIdOf(session);

  const grant = await prisma.calendarGrant.findUnique({
    where: { studentId },
    select: {
      googleEmail: true,
      connectedAt: true,
      lastSyncAt: true,
      lastSyncError: true,
      pendingSince: true,
      invalidatedAt: true,
    },
  });

  if (!grant) {
    return NextResponse.json(
      { connected: false },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      connected: true,
      googleEmail: grant.googleEmail,
      connectedAt: grant.connectedAt,
      lastSyncAt: grant.lastSyncAt,
      lastSyncError: grant.lastSyncError,
      pending: grant.pendingSince !== null,
      invalidated: grant.invalidatedAt !== null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
