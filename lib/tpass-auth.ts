import "server-only";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type Role = "admin" | "moderator" | "default";
export type Restriction = "none" | "warning" | "ban";

export interface PermissionEntry {
  read: boolean;
  role: Role;
  restriction?: Restriction;
  reason?: string;
  until?: number;
}

export interface TPassClaims {
  sub: string; // 使用者唯一 ID (跨服務一致)
  email: string; // 學校信箱
  name: string; // 顯示名稱
  permissions: Record<string, PermissionEntry>;
  exp: number;
}

// 自動快取與輪替 JWKS 公鑰
const JWKS = createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL!));

export async function verifySession(
  token: string,
): Promise<TPassClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA"], // 鐵則 1：鎖死 EdDSA 演算法
      issuer: process.env.JWT_ISSUER!, // 鐵則 2：核對簽發者
      audience: `tpass:${process.env.TPASS_SERVICE_ID}`, // 鐵則 3：核對受眾 (Audience)
    });

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      permissions:
        (payload.permissions as TPassClaims["permissions"] | undefined) ?? {},
      exp: payload.exp as number,
    };
  } catch {
    return null; // 驗證失敗一律視為未登入，不回傳詳細錯誤
  }
}

export async function getSession(): Promise<TPassClaims | null> {
  // 本機開發測試後門（僅非 production 且明確設定 DEV_BYPASS_EMAIL 時生效）
  if (
    process.env.DEV_BYPASS_EMAIL &&
    process.env.NODE_ENV !== "production"
  ) {
    const email = process.env.DEV_BYPASS_EMAIL;
    return {
      sub: email,
      email,
      name: process.env.DEV_BYPASS_NAME ?? "測試同學",
      permissions: {},
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  const token = (await cookies()).get("tpass_token")?.value;
  if (!token) return null;
  return verifySession(token);
}

/** 由學校信箱取得學號（@ 前的內容） */
export function studentIdOf(session: TPassClaims): string {
  return session.email.split("@")[0];
}
