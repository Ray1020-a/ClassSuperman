// AES-256-GCM 加解密 refresh token 落地前的密文。金鑰來自 CALENDAR_TOKEN_KEY
// （32 bytes base64，openssl rand -base64 32），只在這個檔案裡讀。
import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { calendarConfig } from "@/config/calendar";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM 建議 96-bit nonce

function key(): Buffer {
  const buf = Buffer.from(calendarConfig.tokenKeyBase64, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `[lib/crypto] CALENDAR_TOKEN_KEY 必須是 32 bytes（base64 解碼後），實際 ${buf.length} bytes`,
    );
  }
  return buf;
}

/** 密文格式：base64(iv) . base64(authTag) . base64(ciphertext) */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(encoded: string): string {
  const [ivB64, tagB64, ctB64] = encoded.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("[lib/crypto] 密文格式不正確");
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
