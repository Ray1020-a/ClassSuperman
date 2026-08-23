import { NextResponse } from "next/server";

export const runtime = "nodejs";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function POST() {
  const selfUrl = process.env.SERVICE_SELF_URL!;
  const authLogout = `${process.env.AUTH_LOGOUT_URL}?redirect_uri=${encodeURIComponent(selfUrl)}`;

  const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>登出中…</title></head>
<body onload="document.forms[0].submit()">
<form method="post" action="${escapeHtml(authLogout)}">
<noscript><button type="submit">完成登出</button></noscript>
</form>
</body></html>`;

  const response = new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

  // 清除本站 Cookie
  response.cookies.set("tpass_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: selfUrl.startsWith("https://"),
    path: "/",
    maxAge: 0,
  });

  return response;
}
