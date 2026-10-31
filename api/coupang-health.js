import { requireAuth, sameOrigin } from "./_auth.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "GET만 지원합니다." });
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, code: "BAD_ORIGIN", message: "허용되지 않은 요청 출처입니다." });
  if (!requireAuth(req, res)) return;

  const configured = Boolean(
    process.env.COUPANG_VENDOR_ID &&
    process.env.COUPANG_ACCESS_KEY &&
    process.env.COUPANG_SECRET_KEY
  );
  return res.status(200).json({
    ok: true,
    configured,
    mode: "read-only-orders",
    credentialsStoredServerSide: true,
  });
}
