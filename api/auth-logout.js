import { sessionCookie } from "./_auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST만 지원합니다." });
  res.setHeader("Set-Cookie", sessionCookie("", req, 0));
  return res.status(200).json({ ok: true });
}
