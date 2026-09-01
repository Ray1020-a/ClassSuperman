import { NextResponse } from "next/server";
import { tpass, studentIdOf } from "@/config/auth";
import { calendarConfig } from "@/config/calendar";
import { createState } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 導去 Google 同意畫面，要求把課表寫進使用者主日曆的授權。 */
export async function GET() {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const studentId = studentIdOf(session);

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", calendarConfig.clientId);
  u.searchParams.set("redirect_uri", calendarConfig.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", calendarConfig.scope);
  // offline + consent：每次都強制走同意畫面，才保證拿得到 refresh_token
  // （沒帶 prompt=consent 的話，使用者之前同意過就不會重發）。
  // select_account：瀏覽器同時登入多個 Google 帳號時（例如個人 + 學校），
  // 只帶 consent 會直接沿用目前預設帳號、完全跳過選擇畫面——導致連錯帳號、
  // 撞上 oauth/callback 的網域檢查才發現連錯，體驗很差。強制跳選擇畫面。
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "select_account consent");
  u.searchParams.set("include_granted_scopes", "false");
  // hd 只是 UX 提示（讓 Google 帳號選擇器優先顯示學校帳號），不是安全邊界——
  // 真正的網域與學號檢查在 oauth/callback 那邊靠 userinfo 做。
  u.searchParams.set("hd", calendarConfig.schoolEmailDomain);
  u.searchParams.set("state", createState(studentId));

  return NextResponse.redirect(u.toString());
}
