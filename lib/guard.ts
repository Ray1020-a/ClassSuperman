import "server-only";
import { redirect } from "next/navigation";
import { getSession, type TPassClaims } from "./tpass-auth";

export function loginUrlFor(returnPath = "/"): string {
  const u = new URL(process.env.AUTH_AUTHORIZE_URL!);
  u.searchParams.set("service", process.env.TPASS_SERVICE_ID!);
  u.searchParams.set(
    "redirect_uri",
    `${process.env.SERVICE_SELF_URL}/api/auth/callback`,
  );
  u.searchParams.set("next", returnPath);
  return u.toString();
}

export async function requireSession(returnPath = "/"): Promise<TPassClaims> {
  const session = await getSession();
  if (!session) redirect(loginUrlFor(returnPath));
  return session;
}
