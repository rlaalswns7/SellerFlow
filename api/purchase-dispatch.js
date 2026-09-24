const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST만 지원합니다." });
  const { batchId, supplierName, recipientId, channel, fileName, fileBase64, message, orderCount } = req.body || {};
  if (!batchId || !supplierName || !recipientId || !fileName || !fileBase64) {
    return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", message: "필수 전송 정보가 없습니다." });
  }
  if (String(fileBase64).length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ ok: false, code: "FILE_TOO_LARGE", message: "발주서 파일이 너무 큽니다." });
  }
  const webhookUrl = process.env.SELLERFLOW_PURCHASE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ ok: false, code: "NOT_CONFIGURED", message: "자동전송 서버 환경변수가 아직 설정되지 않았습니다." });
  }
  const headers = { "Content-Type": "application/json" };
  if (process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN}`;
  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ batchId, supplierName, recipientId, channel: channel || "webhook", fileName, fileBase64, message: message || "", orderCount: Number(orderCount || 0) }),
    });
    const raw = await upstream.text();
    let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0, 300) }; }
    if (!upstream.ok) return res.status(502).json({ ok: false, code: "UPSTREAM_FAILED", message: data?.message || `외부 전송 실패 (${upstream.status})` });
    return res.status(200).json({ ok: true, message: data?.message || "발주서 자동전송 완료", upstream: data });
  } catch (error) {
    return res.status(502).json({ ok: false, code: "UPSTREAM_ERROR", message: error?.message || "외부 전송 서버 연결 실패" });
  }
}
