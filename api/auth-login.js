import { authConfigured, createSessionValue, sessionCookie, validPassword } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST만 지원합니다." });
  if (!authConfigured()) return res.status(503).json({ ok: false, code: "AUTH_NOT_CONFIGURED", message: "관리자 비밀번호 환경변수를 먼저 설정해주세요." });
  const password = String(req.body?.password || "");
  if (!validPassword(password)) return res.status(401).json({ ok: false, code: "BAD_PASSWORD", message: "비밀번호가 올바르지 않습니다." });
  res.setHeader("Set-Cookie", sessionCookie(createSessionValue(), req));
  return res.status(200).json({ ok: true, expiresInHours: 12 });
}
