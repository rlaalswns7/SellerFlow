import crypto from "node:crypto";
import { carrierName, normalizeText } from "../src/reliability.js";

export class AutomationError extends Error {
  constructor(code, message, ambiguous = false) { super(message); this.code = code; this.ambiguous = ambiguous; }
}
export function parseLosslessJson(text) {
  // Preserve 18-digit shipment IDs while leaving string literals untouched.
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token[0] === '"' || !/^-?\d+$/.test(token)) return token;
    return Number.isSafeInteger(Number(token)) ? token : JSON.stringify(token);
  }));
}
export function wingInteger(value, label = "ID") {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new AutomationError("UNSAFE_ID", `${label} 정밀도 손실`);
  const id = String(value ?? "");
  if (!/^[1-9]\d{0,24}$/.test(id)) throw new AutomationError("INVALID_ID", `${label} 형식 오류`);
  return id;
}
export function wingJson(value) {
  // Only these API fields are numeric IDs. Values are checked digits, never arbitrary JSON.
  return JSON.stringify(value).replace(/"(shipmentBoxId|orderId|vendorItemId|receiptId)":"([1-9]\d{0,24})"/g, '"$1":$2')
    .replace(/"shipmentBoxIds":\[([^\]]*)\]/g, (_, ids) => '"shipmentBoxIds":[' + ids.replace(/"([1-9]\d{0,24})"/g, "$1") + "]");
}
const COURIERS = {
  "CJ대한통운": ["CJGLS", [10, 12]], "한진택배": ["HANJIN", [10, 12]],
  "롯데택배": ["HYUNDAI", [10, 12, 13]], "로젠택배": ["KGB", [10, 11]],
  "우체국택배": ["EPOST", [13]], "경동택배": ["KDEXP", [8,9,10,11,12,13,14,15,16]],
  "대신택배": ["DAESIN", [13]], "일양로지스": ["ILYANG", [8,9,10,11,12,13,14,15,16]],
  "합동택배": ["HDEXP", [8,9,10,11,12,13,14,15,16]], "건영택배": ["KUNYOUNG", [10]],
  "천일택배": ["CHUNIL", [11]], "FEDEX": ["FEDEX", [12,15]]
};
export function wingCourier(carrier, number) {
  const result = COURIERS[carrierName(carrier)];
  if (!result || !/^\d+$/.test(normalizeText(number)) || !result[1].includes(normalizeText(number).length)) throw new AutomationError("INVALID_TRACKING", "쿠팡 택배사별 송장 규격에 맞지 않습니다");
  return result[0];
}
export function kstDate(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
export function normalizeBox(box) {
  const boxId = wingInteger(box.shipmentBoxId, "shipmentBoxId"), orderId = wingInteger(box.orderId, "orderId");
  if (!Array.isArray(box.orderItems) || !box.orderItems.length) throw new AutomationError("BAD_ORDER", "상품 목록 누락");
  if (new Set(box.orderItems.map(i => String(i.vendorItemId))).size !== box.orderItems.length) throw new AutomationError("DUPLICATE_ITEM", "배송번호 안에 옵션 ID가 겹쳐 수동 확인이 필요합니다");
  return box.orderItems.map(item => {
    const itemId = wingInteger(item.vendorItemId, "vendorItemId");
    const qty = Number(item.shippingCount);
    const amount = item.salesPrice ?? item.orderPrice;
    const rawPrice = typeof amount === "object" && amount !== null ? Number(amount.units) + Number(amount.nanos || 0) / 1e9 : Number(amount);
    const price = item.salesPrice === undefined ? rawPrice / qty : rawPrice;
    if (!Number.isSafeInteger(qty) || qty < 1 || !Number.isFinite(price) || price < 0) throw new AutomationError("BAD_ORDER", "수량·금액 오류");
    return {
      id: `CP-${orderId}-${boxId}-${itemId}`, source: "coupang", coupangOrderId: orderId,
      shipmentBoxId: boxId, coupangVendorItemId: itemId, sequenceNo: String(item.sequenceNo || ""),
      product: String(item.sellerProductName || ""), option: String(item.sellerProductItemName || item.vendorItemName || ""),
      vendorProductName: String(item.vendorItemName || ""), qty, saleAmount: price,
      customer: String(box.receiver?.name || ""), phone: String(box.receiver?.safeNumber || box.receiver?.receiverNumber || ""),
      address: [box.receiver?.addr1, box.receiver?.addr2].filter(Boolean).join(" "), postCode: String(box.receiver?.postCode || ""),
      customerNote: String(box.parcelPrintMessage || ""), createdAt: String(box.orderedAt || ""), date: String(box.orderedAt || "").slice(5, 10).replace("-", "/"),
      channelStatus: box.status, remoteInvoice: String(box.invoiceNumber || ""), remoteCarrier: String(box.deliveryCompanyCode || ""),
      cancelHold: item.canceled === true || Number(item.holdCountForCancel || 0) > 0 || Number(item.cancelCount || 0) > 0,
      splitShipping: box.splitShipping === true, supplier: "미연결", purchaseStatus: "도매처 연결 필요", invoiceStatus: "송장대기", marketing: false
    };
  });
}
export function createWing({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const vendor = String(env.COUPANG_VENDOR_ID || "");
  function path(version, suffix) { return `/v2/providers/openapi/apis/api/${version}/vendors/${encodeURIComponent(vendor)}/${suffix}`; }
  async function request(method, resource, params = {}, body) {
    if (!vendor || !env.COUPANG_ACCESS_KEY || !env.COUPANG_SECRET_KEY) throw new AutomationError("NOT_CONFIGURED", "쿠팡 서버 환경변수 미설정");
    const query = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== "")).toString();
    const date = now().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(2);
    const signature = crypto.createHmac("sha256", env.COUPANG_SECRET_KEY).update(date + method + resource + query).digest("hex");
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(`https://api-gateway.coupang.com${resource}${query ? "?" + query : ""}`, {
        method, signal: controller.signal, headers: { "Content-Type": "application/json;charset=UTF-8", Authorization: `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${date}, signature=${signature}` },
        ...(body ? { body: wingJson(body) } : {})
      });
      let data;
      try { data = parseLosslessJson(await response.text()); } catch { throw new AutomationError("BAD_RESPONSE", "쿠팡 응답 형식 오류", method !== "GET"); }
      if (!response.ok || String(data.code) !== "200") throw new AutomationError(`WING_${response.status}`, "쿠팡 API 실패: " + String(data.message || response.status).slice(0, 200), method !== "GET" && response.status >= 500);
      return data;
    } catch (error) {
      if (error instanceof AutomationError) throw error;
      throw new AutomationError("CONNECTION_FAILED", "쿠팡 응답을 확인하지 못했습니다", method !== "GET");
    } finally { clearTimeout(timer); }
  }
  function resultFor(data, id) {
    const rows = data?.data?.responseList;
    const row = Array.isArray(rows) ? rows.find(r => String(r.shipmentBoxId) === String(id)) : null;
    if (!row || row.succeed !== true || row.resultCode !== "OK") throw new AutomationError(row?.resultCode || "UNCONFIRMED", "쿠팡 개별 처리 성공을 확인하지 못했습니다", !row);
    return row;
  }
  return {
    async listOrders({ from, to, status = "ACCEPT" }) {
      let token = ""; const seen = new Set(), boxes = [];
      for (let page = 0; page < 100; page++) {
        const data = await request("GET", path("v5", "ordersheets"), { createdAtFrom: from + "+09:00", createdAtTo: to + "+09:00", status, maxPerPage: 50, nextToken: token });
        if (!Array.isArray(data.data)) throw new AutomationError("BAD_RESPONSE", "주문 목록 형식 오류");
        boxes.push(...data.data);
        token = data.nextToken || "";
        if (!token) return boxes;
        if (seen.has(token)) throw new AutomationError("PAGING_LOOP", "쿠팡 페이지 토큰 반복");
        seen.add(token);
      }
      throw new AutomationError("PAGE_LIMIT", "조회 페이지 한도 초과, 기간을 줄여주세요");
    },
    async getBox(id) { return (await request("GET", path("v5", `ordersheets/${wingInteger(id)}`))).data; },
    async acknowledge(id) { const data = await request("PATCH", path("v4", "ordersheets/acknowledgement"), {}, { vendorId: vendor, shipmentBoxIds: [wingInteger(id)] }); return resultFor(data, id); },
    async registerInvoice(order, invoice) {
      const id = wingInteger(order.shipmentBoxId);
      const data = await request("POST", path("v4", "orders/invoices"), {}, { vendorId: vendor, orderSheetInvoiceApplyDtos: [{ shipmentBoxId: id, orderId: wingInteger(order.coupangOrderId), vendorItemId: wingInteger(order.coupangVendorItemId), deliveryCompanyCode: wingCourier(invoice.carrier, invoice.invoice), invoiceNumber: normalizeText(invoice.invoice), splitShipping: false, preSplitShipped: false, estimatedShippingDate: "" }] });
      return resultFor(data, id);
    },
    async listInquiries({ from, to }) {
      const result = [];
      for (let page = 1; page <= 100; page++) {
        const d = (await request("GET", path("v5", "onlineInquiries"), { inquiryStartAt: from, inquiryEndAt: to, vendorId: vendor, answeredType: "ALL", pageSize: 50, pageNum: page })).data;
        if (!Array.isArray(d?.content) || !Number.isInteger(d.pagination?.totalPages)) throw new AutomationError("BAD_RESPONSE", "문의 목록 형식 오류");
        result.push(...d.content);
        if (page >= d.pagination.totalPages) return result;
      }
      throw new AutomationError("PAGE_LIMIT", "문의 페이지 한도 초과");
    },
    async reply(inquiryId, content) {
      if (!env.COUPANG_REPLY_BY || typeof content !== "string" || !content.trim() || content.length > 4000) throw new AutomationError("INVALID_REPLY", "WING 응답자·답변 내용 확인 필요");
      return request("POST", path("v4", `onlineInquiries/${wingInteger(inquiryId)}/replies`), {}, { vendorId: vendor, replyBy: env.COUPANG_REPLY_BY, content });
    },
    async listReturns({from,to}) {
      const all = [];
      for (const query of [{cancelType:"RETURN",status:"RU"},{cancelType:"RETURN",status:"UC"},{cancelType:"RETURN",status:"CC"},{cancelType:"RETURN",status:"PR"},{cancelType:"CANCEL"}]) {
        const data = await request("GET", path("v6","returnRequests"), { searchType:"timeFrame",createdAtFrom:from+"T00:00",createdAtTo:to+"T23:59",...query });
        if (!Array.isArray(data.data) || data.data.length > 10000) throw new AutomationError("BAD_RESPONSE","반품 목록 형식·크기 확인 필요");
        all.push(...data.data);
      }
      return [...new Map(all.map(r=>[String(r.receiptId),r])).values()];
    },
    async getReturn(id) {
      const rows = (await request("GET", path("v6", `returnRequests/${wingInteger(id)}`))).data;
      return Array.isArray(rows) ? rows[0] : rows;
    },
    async approveReturn(item) {
      if (item.receiptStatus !== "VENDOR_WAREHOUSE_CONFIRM" || !Number.isSafeInteger(item.cancelCount) || item.cancelCount < 1) throw new AutomationError("RETURN_NOT_READY", "반품 승인 상태·수량이 맞지 않습니다");
      return request("PATCH", path("v4", `returnRequests/${wingInteger(item.receiptId)}/approval`), {}, { vendorId: vendor, receiptId: wingInteger(item.receiptId), cancelCount: item.cancelCount });
    }
  };
}
