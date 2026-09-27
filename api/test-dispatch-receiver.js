import crypto from "node:crypto";

function sameText(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "POST만 지원합니다." });

  const expected = process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN || "";
  const supplied = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected) return res.status(503).json({ ok: false, code: "TEST_RECEIVER_LOCKED", message: "테스트 수신기 보안 토큰이 설정되지 않았습니다." });
  if (!sameText(expected, supplied)) return res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "테스트 수신기 인증 실패" });

  const { batchId, supplierName, recipientId, channel, fileName, message, orderCount } = req.body || {};
  if (!batchId || !supplierName || !fileName) return res.status(400).json({ ok: false, message: "필수 정보가 없습니다." });

  return res.status(200).json({
    ok: true,
    message: "테스트 발주서 수신 성공",
    received: {
      batchId: String(batchId).slice(0, 200),
      supplierName: String(supplierName).slice(0, 200),
      recipientId: String(recipientId || "").slice(0, 200),
      channel: String(channel || "").slice(0, 50),
      fileName: String(fileName).slice(0, 240),
      orderCount: Number(orderCount || 0),
      hasMessage: Boolean(message),
    }
  });
}
