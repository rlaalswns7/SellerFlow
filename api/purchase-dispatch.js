import crypto from "node:crypto";
import { requireAuth, sameOrigin } from "./_auth.js";

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;
const MAX_TEXT = 4000;

function cleanText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST만 지원합니다." });
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, code: "BAD_ORIGIN", message: "허용되지 않은 요청 출처입니다." });
  if (!requireAuth(req, res)) return;
  if (process.env.SELLERFLOW_RUNTIME_ENABLED === "true") return res.status(409).json({ ok: false, code: "USE_RUNTIME", message: "서버 자동화 모드에서는 최신 화면과 런타임 API를 사용하세요." });

  const { batchId, supplierName, recipientId, channel, fileName, fileBase64, message, orderCount } = req.body || {};
  if (![batchId, supplierName, recipientId, fileName, fileBase64].every(x => typeof x === "string" && x.trim()) || !Number.isSafeInteger(orderCount) || orderCount < 1 || orderCount > 10000) {
    return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", message: "필수 전송 정보가 없습니다." });
  }
  if (String(fileBase64).length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ ok: false, code: "FILE_TOO_LARGE", message: "발주서 파일이 너무 큽니다." });
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fileBase64) || Buffer.from(fileBase64, "base64").toString("base64") !== fileBase64 || !Buffer.from(fileBase64, "base64").subarray(0, 2).equals(Buffer.from("PK")) || !/\.xlsx$/i.test(fileName) || /[\\/]/.test(fileName)) {
    return res.status(400).json({ ok: false, code: "INVALID_FILE", message: "발주서 파일 형식이 올바르지 않습니다." });
  }

  const webhookUrl = process.env.SELLERFLOW_PURCHASE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ ok: false, code: "NOT_CONFIGURED", message: "자동전송 서버 환경변수가 아직 설정되지 않았습니다." });
  }

  const headers = { "Content-Type": "application/json" };
  if (process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN}`;

  const payload = {
    batchId: cleanText(batchId),
    supplierName: cleanText(supplierName),
    recipientId: cleanText(recipientId),
    channel: cleanText(channel || "webhook", 50),
    fileName: cleanText(fileName, 240),
    fileBase64: String(fileBase64),
    message: cleanText(message, MAX_TEXT),
    orderCount: Math.max(0, Math.min(10000, Number(orderCount || 0))),
  };

  const idempotencyKey = crypto.createHash("sha256").update(`${batchId}:${supplierName}`).digest("hex");
  headers["Idempotency-Key"] = idempotencyKey;
  payload.idempotencyKey = idempotencyKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    const raw = await upstream.text();
    let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = null; }
    if (!upstream.ok) return res.status(502).json({ ok: false, code: "UPSTREAM_FAILED", message: data?.message || `외부 전송 실패 (${upstream.status})` });
    if (data?.ok !== true) return res.status(502).json({ ok: false, code: "UPSTREAM_UNCONFIRMED", message: "외부 서버가 전달 성공을 명시하지 않았습니다. 실제 전달 여부를 확인하세요." });
    return res.status(200).json({ ok: true, message: data?.message || "발주서 자동전송 완료", upstream: data });
  } catch (error) {
    return res.status(502).json({ ok: false, code: "DELIVERY_UNKNOWN", message: "전송 응답이 없거나 시간이 초과됐습니다. 실제 도매처 전달 여부를 확인한 뒤 처리하세요." });
  } finally { clearTimeout(timer); }
}

