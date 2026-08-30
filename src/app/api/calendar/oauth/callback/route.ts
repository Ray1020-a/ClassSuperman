import { NextResponse } from "next/server";
import { tpass, studentIdOf } from "@/config/auth";
import { calendarConfig } from "@/config/calendar";
import { verifyState } from "@/lib/oauth-state";
import { exchangeCode, fetchUserInfo } from "@/lib/google-calendar";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectHome(reason: string): NextResponse {
  const url = new URL("/", process.env.SCHEDULE_SELF_URL);
  url.searchParams.set("calendar", reason);
  return NextResponse.redirect(url, 303);
}

/**
 * Google 同意畫面回跳。驗 state → 換 token → 用 userinfo 核對「這是本人的學校帳號」→
 * 加密存 refresh token → 排入同步佇列 → 導回首頁（學生此時就能關分頁，之後不必再進站）。
 */
export async function GET(request: Request) {
  const session = await tpass.getSession();
  if (!session) return NextResponse.redirect(tpass.loginUrl("/"), 303);
  const studentId = studentIdOf(session);

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return redirectHome("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !verifyState(state, studentId)) {
    return redirectHome("invalid_state");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (err) {
    console.error("[calendar/oauth/callback] code 交換失敗：", err);
    return redirectHome("exchange_failed");
  }
  if (!tokens.refreshToken) {
    // 理論上不會發生（connect route 帶了 access_type=offline + prompt=consent），
    // 保底處理避免把使用者晾在一個「連了但寫不進日曆」的假連結狀態。
    return redirectHome("no_refresh_token");
  }

  let userInfo;
  try {
    userInfo = await fetchUserInfo(tokens.accessToken);
  } catch (err) {
    console.error("[calendar/oauth/callback] userinfo 失敗：", err);
    return redirectHome("userinfo_failed");
  }

  // 網域與學號必須跟 T-Pass session 一致——否則有人能把課表灌進別人（甚至校外）的帳號。
  const [emailPrefix, domain] = userInfo.email.split("@");
  if (domain !== calendarConfig.schoolEmailDomain || emailPrefix !== studentId) {
    return redirectHome("wrong_account");
  }

  try {
    await prisma.calendarGrant.upsert({
      where: { studentId },
      create: {
        studentId,
        googleSub: userInfo.sub,
        googleEmail: userInfo.email,
        refreshToken: encryptToken(tokens.refreshToken),
        pendingSince: new Date(),
      },
      update: {
        googleSub: userInfo.sub,
        googleEmail: userInfo.email,
        refreshToken: encryptToken(tokens.refreshToken),
        invalidatedAt: null,
        lastSyncError: null,
        pendingSince: new Date(),
      },
    });
  } catch (err) {
    // 目前唯一會撞到的情況：googleSub 已經連結在別的學號底下（@unique）。
    console.error("[calendar/oauth/callback] 寫入授權失敗：", err);
    return redirectHome("save_failed");
  }

  return redirectHome("connected");
}
