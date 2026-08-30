// Google OAuth 的 state 參數：簽章 + 短效，綁定發起授權的那位學生。
// 不落地存（不需要另一張表）——callback 拿到 state 就能自己驗，過期或簽章不對一律拒絕。
import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { calendarConfig } from "@/config/calendar";

const STATE_TTL_MS = 10 * 60_000;

// 跟 CALENDAR_TOKEN_KEY 同一把主金鑰，但用途分離（sha256 派生），不直接拿加密金鑰做 HMAC。
function stateKey(): Buffer {
  return createHash("sha256")
    .update(Buffer.from(calendarConfig.tokenKeyBase64, "base64"))
    .update("oauth-state")
    .digest();
}

export function createState(studentId: string): string {
  const payload = JSON.stringify({
    studentId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(8).toString("hex"),
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", stateKey()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

/** 驗證 state 是簽給 expectStudentId 的、簽章正確、且尚未過期。 */
export function verifyState(state: string, expectStudentId: string): boolean {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return false;

  const expectSig = createHmac("sha256", stateKey()).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectBuf = Buffer.from(expectSig);
  if (sigBuf.length !== expectBuf.length || !timingSafeEqual(sigBuf, expectBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      studentId: string;
      exp: number;
    };
    return payload.studentId === expectStudentId && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}
