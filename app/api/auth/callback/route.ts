import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/tpass-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get("token");
  const next = String(form.get("next") ?? "/");

  if (typeof token !== "string" || !token) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const claims = await verifySession(token);
  if (!claims) return new NextResponse("Invalid token", { status: 401 });

  // 防止 Open Redirect 攻擊
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const response = NextResponse.redirect(
    new URL(safeNext, process.env.SERVICE_SELF_URL),
    303,
  );

  // 寫入站內專屬 Cookie（Host-only，不設 Domain）
  response.cookies.set("tpass_token", token, {
    httpOnly: true, // 防範 XSS 竊取
    sameSite: "lax",
    secure: process.env.SERVICE_SELF_URL!.startsWith("https://"),
    path: "/",
    maxAge: Math.max(0, claims.exp - Math.floor(Date.now() / 1000)),
  });

  return response;
}
