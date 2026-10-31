import crypto from "node:crypto";
import { requireAuth, sameOrigin } from "./_auth.js";

const COUPANG_BASE_URL = "https://api-gateway.coupang.com";
const DEFAULT_MAX_PER_PAGE = 50;
const MAX_PER_PAGE = 100;
const TIMEOUT_MS = 15000;
const RETRIES = 2;

function config() {
  return {
    vendorId: String(process.env.COUPANG_VENDOR_ID || "").trim(),
    accessKey: String(process.env.COUPANG_ACCESS_KEY || "").trim(),
    secretKey: String(process.env.COUPANG_SECRET_KEY || "").trim(),
  };
}

function signedDate() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function createAuthorization(method, path, query, accessKey, secretKey) {
  const date = signedDate();
  const normalizedMethod = String(method || "GET").toUpperCase();
  const normalizedQuery = String(query || "").replace(/^\?/, "");
  const message = `${date}${normalizedMethod}${path}${normalizedQuery}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;
}

function buildQuery(params) {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.set(key, String(value));
  }
  return url.toString();
}

async function requestCoupang(path, query, credentials) {
  const queryString = query ? `?${query}` : "";
  const authorization = createAuthorization("GET", path, query, credentials.accessKey, credentials.secretKey);
  const target = `${COUPANG_BASE_URL}${path}${queryString}`;

  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(target, {
        method: "GET",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json;charset=UTF-8",
        },
        signal: controller.signal,
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

      if (response.ok) return { status: response.status, data };

      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`쿠팡 API 오류 (${response.status})`);
      lastError.status = response.status;
      lastError.upstreamCode = data?.code || data?.rCode || data?.errorCode || "";
      if (!retryable || attempt === RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    } catch (error) {
      lastError = error;
      const retryableNetwork = error?.name === "AbortError" || /fetch|network|ECONN|ETIMEDOUT/i.test(String(error?.message || ""));
      if (!retryableNetwork || attempt === RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("쿠팡 API 호출 실패");
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstValue(obj, paths, fallback = "") {
  for (const path of paths) {
    const parts = path.split(".");
    let cur = obj;
    for (const part of parts) cur = cur?.[part];
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return fallback;
}

function normalizeOrderRow(item, parent = {}, itemIndex = 0) {
  const orderId = String(firstValue(item, ["orderId", "orderSheetId"], firstValue(parent, ["orderId", "orderSheetId"], "")) || "").trim();
  const vendorItemId = String(firstValue(item, ["vendorItemId", "vendorItemId"], "") || "").trim();
  const shipmentBoxId = String(firstValue(item, ["shipmentBoxId", "shipmentBoxId"], firstValue(parent, ["shipmentBoxId"], "")) || "").trim();
  const product = String(firstValue(item, ["sellerProductName", "vendorItemName", "productName", "product.name"], "") || "").trim();
  const option = String(firstValue(item, ["vendorItemOptionName", "optionName", "option"], "") || "").trim();
  const customer = String(firstValue(item, ["receiver.name", "orderer.name", "ordererName"], "") || "").trim();
  const phone = String(firstValue(item, ["receiver.safeNumber", "receiver.phone", "receiver.receiverNumber", "orderer.phone"], "") || "").trim();
  const address1 = String(firstValue(item, ["receiver.addr1", "receiver.address1", "receiver.address"], "") || "").trim();
  const address2 = String(firstValue(item, ["receiver.addr2", "receiver.address2"], "") || "").trim();
  const address = [address1, address2].filter(Boolean).join(" ").trim();
  const qty = Math.max(1, finiteNumber(firstValue(item, ["shippingCount", "quantity", "qty"], 1), 1));
  const saleAmount = finiteNumber(firstValue(item, ["orderPrice", "salesPrice", "price", "amount"], 0), 0);
  const createdAt = String(firstValue(item, ["orderedAt", "createdAt", "orderDate"], firstValue(parent, ["orderedAt", "createdAt", "orderDate"], "")) || "");
  const status = String(firstValue(item, ["status", "orderStatus"], firstValue(parent, ["status", "orderStatus"], "")) || "").trim();
  const customerNote = String(firstValue(item, ["parcelPrintMessage", "shippingMessage", "deliveryMessage"], "") || "").trim();

  if (!orderId && !shipmentBoxId) return null;
  // Keep IDs deterministic across repeated syncs. Random IDs made the same
  // upstream line look new every time vendorItemId was absent.
  const fallbackParts = [orderId || shipmentBoxId, shipmentBoxId, product, option].map((part) => String(part || "").trim());
  const fallbackKey = crypto.createHash("sha256").update(fallbackParts.join("|")).digest("hex").slice(0, 16);
  const stableId = vendorItemId
    ? `${orderId || shipmentBoxId}-${vendorItemId}`
    : `${orderId || shipmentBoxId}-fallback-${fallbackKey}`;

  return {
    id: stableId,
    coupangOrderId: orderId,
    shipmentBoxId,
    coupangVendorItemId: vendorItemId,
    date: createdAt ? new Date(createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\.\s?/g, "/").replace(/\/$/, "") : new Date().toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\.\s?/g, "/").replace(/\/$/, ""),
    createdAt: createdAt || new Date().toISOString(),
    customer,
    phone,
    address,
    product,
    option,
    qty,
    saleAmount,
    supplier: "미연결",
    purchaseStatus: "도매처 연결 필요",
    invoiceStatus: "송장대기",
    marketing: false,
    channelStatus: status || "쿠팡 주문",
    customerNote,
    source: "coupang",
    importedAt: new Date().toISOString(),
  };
}

function normalizeOrders(data) {
  const rows = [];
  const root = Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.content) ? data.data.content : Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
  for (const box of root) {
    const items = Array.isArray(box?.orderItems) ? box.orderItems : Array.isArray(box?.items) ? box.items : null;
    if (items?.length) {
      for (const item of items) {
        const normalized = normalizeOrderRow(item, box, rows.length);
        if (normalized) rows.push(normalized);
      }
    } else {
      const normalized = normalizeOrderRow(box);
      if (normalized) rows.push(normalized);
    }
  }
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "GET만 지원합니다." });
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, code: "BAD_ORIGIN", message: "허용되지 않은 요청 출처입니다." });
  if (!requireAuth(req, res)) return;

  const credentials = config();
  if (!credentials.vendorId || !credentials.accessKey || !credentials.secretKey) {
    return res.status(503).json({
      ok: false,
      code: "COUPANG_NOT_CONFIGURED",
      message: "쿠팡 Open API 환경변수 3개(Vendor ID / Access Key / Secret Key)를 서버에 설정해야 합니다.",
    });
  }

  const query = req.query || {};
  const createdAtFrom = String(query.createdAtFrom || "").slice(0, 10);
  const createdAtTo = String(query.createdAtTo || "").slice(0, 10);
  const status = String(query.status || "").trim().slice(0, 40);
  const requestedPageSize = Number(query.maxPerPage || DEFAULT_MAX_PER_PAGE);
  const maxPerPage = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(requestedPageSize)))
    : DEFAULT_MAX_PER_PAGE;

  const params = {
    createdAtFrom,
    createdAtTo,
    status,
    maxPerPage,
  };
  const path = `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(credentials.vendorId)}/ordersheets`;
  const queryString = buildQuery(params);

  try {
    const result = await requestCoupang(path, queryString, credentials);
    const orders = normalizeOrders(result.data);
    return res.status(200).json({
      ok: true,
      orders,
      sourceCount: orders.length,
      fetchedAt: new Date().toISOString(),
      upstreamStatus: result.status,
    });
  } catch (error) {
    console.error("Coupang order sync failed", { status: error?.status || 0, code: error?.upstreamCode || "", message: error?.message || "" });
    return res.status(Number(error?.status) >= 400 && Number(error?.status) < 600 ? 502 : 502).json({
      ok: false,
      code: error?.name === "AbortError" ? "COUPANG_TIMEOUT" : "COUPANG_REQUEST_FAILED",
      message: "쿠팡 주문 조회에 실패했습니다. 환경변수·Vendor ID·API 키 권한·IP 허용 설정을 확인하세요.",
    });
  }
}
