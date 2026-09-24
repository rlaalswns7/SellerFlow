import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import "./style.css";

const STORAGE_PREFIX = "sellerflow_v2_";
const DATA_VERSION = 6;
const nowIso = () => new Date().toISOString();
const money = (value) => `₩${Number(value || 0).toLocaleString("ko-KR")}`;
const uid = (prefix = "ID") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const menus = [
  ["대시보드", "⌂"],
  ["운영 센터", "☷"],
  ["주문내역", "▣"],
  ["도매처 관리", "⌂"],
  ["상품 연결", "◫"],
  ["발주 관리", "▤"],
  ["운송장 관리", "◇"],
  ["마케팅 주문", "◎"],
  ["CS 관리", "◌"],
  ["정산 분석", "▥"],
  ["성과 분석", "◈"],
  ["마진 계산기", "₩"],
  ["설정", "⚙"],
];

const defaultOrders = [
  {
    id: "C10001",
    date: "09/23",
    createdAt: "2026-09-23T08:30:00+09:00",
    customer: "홍길동",
    phone: "010-1234-1111",
    address: "경남 창원시 의창구 데모로 10",
    product: "사과 5kg",
    option: "5kg / 특품",
    qty: 1,
    saleAmount: 32900,
    supplier: "A농장",
    purchaseStatus: "발주대기",
    invoiceStatus: "송장대기",
    marketing: false,
    channelStatus: "결제완료",
  },
  {
    id: "C10002",
    date: "09/23",
    createdAt: "2026-09-23T09:10:00+09:00",
    customer: "김민준",
    phone: "010-2345-2222",
    address: "경남 창원시 성산구 샘플로 20",
    product: "토마토 2kg",
    option: "2kg",
    qty: 1,
    saleAmount: 21900,
    supplier: "미연결",
    purchaseStatus: "도매처 연결 필요",
    invoiceStatus: "송장대기",
    marketing: false,
    channelStatus: "결제완료",
  },
  {
    id: "C10003",
    date: "09/22",
    createdAt: "2026-09-22T14:40:00+09:00",
    customer: "이서준",
    phone: "010-3456-3333",
    address: "부산광역시 강서구 예시로 30",
    product: "복숭아 3kg",
    option: "3kg / 특",
    qty: 1,
    saleAmount: 27900,
    supplier: "C농장",
    purchaseStatus: "발주완료",
    invoiceStatus: "쿠팡 등록 가능",
    marketing: false,
    channelStatus: "결제완료",
  },
  {
    id: "C10004",
    date: "09/23",
    createdAt: "2026-09-23T11:20:00+09:00",
    customer: "박서연",
    phone: "010-4567-4444",
    address: "서울특별시 강남구 테스트로 40",
    product: "사과 5kg",
    option: "5kg / 특품",
    qty: 1,
    saleAmount: 32900,
    supplier: "A농장",
    purchaseStatus: "마케팅 처리",
    invoiceStatus: "마케팅 송장 대기",
    marketing: true,
    channelStatus: "결제완료",
  },
];

const defaultProducts = [
  { id: 1, name: "사과 5kg", option: "5kg / 특품", price: 32900, cost: 21000, shippingCost: 3000, feeRate: 10, supplier: "A농장", vendorProductName: "부사 사과 특품 5kg", active: true },
  { id: 2, name: "토마토 2kg", option: "2kg", price: 21900, cost: 13500, shippingCost: 3000, feeRate: 10, supplier: "", vendorProductName: "", active: true },
  { id: 3, name: "복숭아 3kg", option: "3kg / 특", price: 27900, cost: 17500, shippingCost: 3000, feeRate: 10, supplier: "C농장", vendorProductName: "백도 복숭아 3kg", active: true },
];

const defaultSuppliers = [
  {
    id: 1,
    name: "A농장",
    contact: "010-1234-5678",
    method: "카카오톡",
    shareTarget: "A농장 오픈채팅",
    orderShareMessage: "{도매처} 발주서입니다. 발주번호 {발주번호}, 총 {주문수}건입니다. 출고 후 송장 파일 회신 부탁드립니다.",
    orderDeadline: "17:00",
    invoiceDeadline: "19:00",
    orderColumns: "주문번호,주문일,수취인,상품명,옵션,수량,보내는사람,연락처,주소",
    invoiceColumns: "주문번호,택배사,운송장번호",
    defectAction: "환불",
    wrongAction: "재배송",
    damageAction: "재배송",
    returnShippingPayer: "도매처",
    responseDeadlineHours: 24,
    active: true,
  },
  {
    id: 2,
    name: "C농장",
    contact: "010-5678-1234",
    method: "카카오톡",
    shareTarget: "C농장 오픈채팅",
    orderShareMessage: "{도매처} 발주서입니다. 발주번호 {발주번호}, 총 {주문수}건입니다. 출고 후 송장 파일 회신 부탁드립니다.",
    orderDeadline: "16:30",
    invoiceDeadline: "18:30",
    orderColumns: "주문번호,수취인,상품명,옵션,수량,주소",
    invoiceColumns: "주문번호,택배사,운송장번호",
    defectAction: "재배송",
    wrongAction: "재배송",
    damageAction: "환불",
    returnShippingPayer: "도매처",
    responseDeadlineHours: 24,
    active: true,
  },
];

const defaultInvoices = [
  { id: "C10003", product: "복숭아 3kg", supplier: "C농장", carrier: "CJ대한통운", invoice: "589123456789", status: "등록대기", source: "도매처", updatedAt: "2026-09-23T10:00:00+09:00" },
];

const defaultInquiries = [
  { id: "Q10001", orderId: "C10001", product: "사과 5kg", customer: "홍길동", content: "상품은 언제 출고되나요?", deadline: "오늘", createdAt: "2026-09-23T10:00:00+09:00", status: "답변대기", answer: "" },
  { id: "Q10002", orderId: "C10003", product: "복숭아 3kg", customer: "이서준", content: "배송지를 변경하고 싶어요.", deadline: "1일 남음", createdAt: "2026-09-22T15:00:00+09:00", status: "확인필요", answer: "" },
];

const defaultReturnCases = [
  {
    id: "R10001",
    orderId: "C10001",
    caseType: "반품",
    product: "사과 5kg",
    customer: "홍길동",
    reason: "단순변심",
    shipped: false,
    createdAt: "2026-09-23T11:00:00+09:00",
    status: "처리대기",
    processed: false,
    evidence: "",
    evidenceImages: [],
    supplierReply: "",
    reviewNote: "",
    resolution: "",
    supplier: "A농장",
  },
  {
    id: "R10002",
    orderId: "C10003",
    caseType: "반품",
    product: "복숭아 3kg",
    customer: "이서준",
    reason: "품질문제",
    shipped: true,
    createdAt: "2026-09-22T17:20:00+09:00",
    status: "수동검토",
    processed: false,
    evidence: "상품 상태 확인 필요",
    evidenceImages: [],
    supplierReply: "",
    reviewNote: "",
    resolution: "",
    supplier: "C농장",
  },
];

const defaultSettings = {
  sellerId: "", vendorId: "", wingStatus: "미연결", apiLastSyncAt: "", apiSuccessRate: 100, apiOutage: false,
  senderName: "", senderPhone: "", senderAddress: "",
  browserNotifications: false, notifyOrderImport: true, notifyInvoiceDeadline: true, notifyCsRisk: true, notifyPurchaseDelay: true, notifyInvoiceMatchFail: true, notifyRegisterDone: true,
  currentRole: "관리자", systemMode: "테스트", theme: "system", retryLimit: 3, highValueThreshold: 100000, bulkQtyThreshold: 5,
  privacyMasking: true, dataRetentionDays: 180, autoRetentionCleanup: false, autoBackupMinutes: 15,
  dashboardCards: ["연결 필요","발주 대기","운송장 대기","쿠팡 등록 가능","CS 마감 임박","운영 위험"],
  dataVersion: DATA_VERSION,
};

const sales30 = [
  ["08/25", 5, 161000], ["08/26", 3, 98000], ["08/27", 7, 244000], ["08/28", 6, 202000],
  ["08/29", 8, 276000], ["08/30", 4, 139000], ["08/31", 5, 174000], ["09/01", 9, 318000],
  ["09/02", 6, 207000], ["09/03", 7, 248000], ["09/04", 11, 391000], ["09/05", 8, 286000],
  ["09/06", 6, 215000], ["09/07", 10, 352000], ["09/08", 12, 428000], ["09/09", 9, 321000],
  ["09/10", 7, 249000], ["09/11", 8, 293000], ["09/12", 13, 471000], ["09/13", 10, 365000],
  ["09/14", 12, 439000], ["09/15", 9, 337000], ["09/16", 14, 512000], ["09/17", 11, 406000],
  ["09/18", 15, 548000], ["09/19", 12, 442000], ["09/20", 16, 596000], ["09/21", 14, 527000],
  ["09/22", 18, 684000], ["09/23", 13, 486000],
].map(([date, orderCount, revenue]) => ({ date, orderCount, revenue }));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStored(key, fallback) {
  const saved = localStorage.getItem(STORAGE_PREFIX + key);
  if (!saved) return clone(fallback);
  try {
    return JSON.parse(saved);
  } catch {
    return clone(fallback);
  }
}

function usePersistentState(key, fallback) {
  const [state, setState] = useState(() => loadStored(key, fallback));
  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function sheetRowsFromArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const first = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(first, { defval: "" });
}

function findCell(row, candidates, fallbackIndex = 0) {
  const keys = Object.keys(row || {});
  const normalized = new Map(keys.map((key) => [normalizeHeader(key), key]));
  for (const candidate of candidates) {
    const key = normalized.get(normalizeHeader(candidate));
    if (key) return row[key];
  }
  return row?.[keys[fallbackIndex]] ?? "";
}

function daysAgo(iso) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return 999;
  return Math.floor((Date.now() - time) / 86400000);
}

function minutesUntilToday(timeString) {
  if (!timeString) return null;
  const [hour, minute] = String(timeString).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const now = new Date();
  const deadline = new Date(now);
  deadline.setHours(hour, minute, 0, 0);
  return Math.round((deadline.getTime() - now.getTime()) / 60000);
}

function formatCountdown(minutes) {
  if (minutes === null || !Number.isFinite(minutes)) return "-";
  if (minutes < 0) {
    const overdue = Math.abs(minutes);
    if (overdue < 60) return `${overdue}분 초과`;
    return `${Math.floor(overdue / 60)}시간 ${overdue % 60}분 초과`;
  }
  if (minutes < 60) return `${minutes}분 남음`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 남음`;
}


function roleCanAccess(role, name) {
  if (role === "관리자") return true;
  if (name === "설정") return true;
  if (role === "발주 담당") return name !== "CS 관리";
  if (role === "CS 담당") return !["발주 관리","운송장 관리","도매처 관리"].includes(name);
  if (role === "조회 전용") return ["대시보드","운영 센터","주문내역","정산 분석","성과 분석"].includes(name);
  return true;
}

function maskPhone(value) {
  const v = String(value || "");
  if (!v) return "-";
  return v.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, (_, a, b, c) => `${a}-${"*".repeat(b.length)}-${c}`);
}
function maskAddress(value) {
  const v = String(value || "").trim();
  if (!v) return "-";
  const parts = v.split(/\s+/);
  return parts.length <= 2 ? v : `${parts.slice(0,2).join(" ")} ***`;
}
function plusDays(iso, days) {
  const d = new Date(iso || Date.now());
  if (!Number.isFinite(d.getTime())) return "-";
  d.setDate(d.getDate() + Number(days || 0));
  return d.toLocaleDateString("ko-KR", { month:"2-digit", day:"2-digit" }).replace(/\.\s?/g,"/").replace(/\/$/,"");
}
function plusSupplierDays(iso, days, holidays = "") {
  const d = new Date(iso || Date.now());
  if (!Number.isFinite(d.getTime())) return "-";
  const holidaySet = new Set(String(holidays||"").split(",").map(x=>x.trim()).filter(Boolean));
  let remain = Number(days||0);
  while (remain > 0) {
    d.setDate(d.getDate()+1);
    const key=d.toISOString().slice(0,10);
    const weekend=d.getDay()===0||d.getDay()===6;
    if (!weekend && !holidaySet.has(key)) remain--;
  }
  return d.toLocaleDateString("ko-KR", {month:"2-digit",day:"2-digit"}).replace(/\.\s?/g,"/").replace(/\/$/,"");
}
function customerRiskLabel(order, inquiries, returnCases, orders = []) {
  const cs = inquiries.filter(q => q.customer === order?.customer).length + returnCases.filter(c => c.customer === order?.customer).length;
  const count = orders.filter(o => o.customer === order?.customer).length;
  if (cs >= 3) return "주의";
  if (count >= 3 && cs === 0) return "VIP";
  if (cs >= 1) return "확인";
  return "일반";
}
function addressLooksInvalid(address) {
  const v = String(address || "").trim();
  return v.length < 8 || !/[가-힣A-Za-z0-9]/.test(v);
}
function productProfit(order, product) {
  const revenue = Number(order?.saleAmount || 0) * Number(order?.qty || 1);
  const cost = Number(product?.cost || 0) * Number(order?.qty || 1);
  const shipping = Number(product?.shippingCost || 0);
  const fee = revenue * Number(product?.feeRate ?? 10) / 100;
  return revenue - cost - shipping - fee;
}
function compactSnapshot(data) {
  return { ...data, returnCases: (data.returnCases || []).map(c => ({...c, evidenceImages: []})) };
}

function orderRiskReasons(order, products, suppliers, invoices) {
  const reasons = [];
  const product = products.find((p) => p.name === order.product);
  const supplier = suppliers.find((s) => s.name === order.supplier);
  if (!product) reasons.push("상품 데이터 없음");
  else {
    if (product.active === false) reasons.push("자동화 중지 상품");
    const baseCost = Number(product.cost || 0) + Number(product.shippingCost || 0);
    if (baseCost > 0 && Number(order.saleAmount || 0) <= baseCost) reasons.push("판매가가 원가+배송비 이하");
  }
  if (!order.marketing && order.supplier === "미연결") reasons.push("도매처 미연결");
  if (!order.marketing && order.supplier !== "미연결" && !supplier) reasons.push("등록되지 않은 도매처");
  if (supplier && supplier.active === false) reasons.push("중지된 도매처");
  if (order.hold) reasons.push(`보류 주문${order.holdReason ? `: ${order.holdReason}` : ""}`);
  if (Number(order.qty || 0) >= 5) reasons.push("대량수량 확인");
  if (order.address && addressLooksInvalid(order.address)) reasons.push("배송지 확인 필요");
  if (product?.automationMode === "수동검토" && !order.manualApproved) reasons.push("상품 자동화 규칙: 수동검토");
  if (product?.stockout) reasons.push("품절 표시 상품");
  if (product && productProfit(order, product) < 0) reasons.push("예상 손실 주문");
  const history = product?.costHistory || [];
  if (history.length >= 2 && Number(history[0]?.cost || 0) > Number(history[1]?.cost || 0)) reasons.push("최근 원가 상승");
  const row = invoices.find((r) => r.id === order.id);
  if (row?.invoice) {
    const duplicate = invoices.filter((r) => r.invoice && String(r.invoice).trim() === String(row.invoice).trim());
    if (duplicate.length > 1) reasons.push("중복 송장번호");
  }
  return reasons;
}

function buildOperationsIssues(orders, products, suppliers, invoices, inquiries, returnCases) {
  const issues = [];
  orders.forEach((order) => {
    const reasons = orderRiskReasons(order, products, suppliers, invoices);
    reasons.forEach((reason) => issues.push({
      id: `${order.id}-${reason}`,
      level: reason.includes("중복") || reason.includes("원가") || reason.includes("등록되지") ? "danger" : "warning",
      type: "주문 점검",
      target: order.id,
      message: reason,
      page: reason.includes("도매처") || reason.includes("상품") || reason.includes("자동화") ? "상품 연결" : "주문내역",
    }));
    if (!order.address) issues.push({ id:`${order.id}-address-missing`, level:"warning", type:"주소 확인", target:order.id, message:"배송지 정보가 아직 연동되지 않음", page:"주문내역" });
    if (!order.marketing && order.purchaseStatus === "발주대기" && daysAgo(order.createdAt) >= 1) {
      issues.push({ id: `${order.id}-purchase-delay`, level: "danger", type: "발주 지연", target: order.id, message: "주문 접수 후 1일 이상 발주대기", page: "발주 관리" });
    }
  });

  invoices.forEach((row) => {
    if (row.status === "송장대기" && daysAgo(row.updatedAt) >= 1) issues.push({ id:`${row.id}-invoice-delay`, level:"danger", type:"송장 미회신", target:row.id, message:"발주 후 1일 이상 송장 미수신", page:"운송장 관리" });
    if (row.invoice && !row.carrier) issues.push({ id: `${row.id}-carrier`, level: "danger", type: "송장 오류", target: row.id, message: "송장번호는 있지만 택배사가 비어 있음", page: "운송장 관리" });
    if (row.invoice) {
      const duplicate = invoices.filter((r) => r.invoice && String(r.invoice).trim() === String(row.invoice).trim());
      if (duplicate.length > 1) issues.push({ id: `${row.id}-duplicate-invoice`, level: "danger", type: "중복 송장", target: row.id, message: `${row.invoice} 번호가 여러 주문에 사용됨`, page: "운송장 관리" });
    }
  });

  inquiries.filter((q) => q.deadline === "오늘" && q.status !== "답변완료").forEach((q) => {
    issues.push({ id: `${q.id}-cs-deadline`, level: "danger", type: "CS 마감", target: q.id, message: "오늘 고객 답변 필요", page: "CS 관리" });
  });

  returnCases.filter((c) => !c.processed && ["품질문제", "오배송", "파손", "사기의심"].includes(c.reason)).forEach((c) => {
    issues.push({ id: `${c.id}-manual`, level: "danger", type: "CS 수동검토", target: c.id, message: `${c.reason} 건 수동 확인 필요`, page: "CS 관리" });
  });

  return issues.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
}

function App() {
  const [page, setPage] = useState("대시보드");
  const [orderFilter, setOrderFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [globalSearch, setGlobalSearch] = useState("");

  const [orders, setOrders] = usePersistentState("orders", defaultOrders);
  const [products, setProducts] = usePersistentState("products", defaultProducts);
  const [suppliers, setSuppliers] = usePersistentState("suppliers", defaultSuppliers);
  const [invoices, setInvoices] = usePersistentState("invoices", defaultInvoices);
  const [purchaseBatches, setPurchaseBatches] = usePersistentState("purchase_batches", []);
  const [inquiries, setInquiries] = usePersistentState("cs_inquiries", defaultInquiries);
  const [returnCases, setReturnCases] = usePersistentState("cs_returns", defaultReturnCases);
  const [csLogs, setCsLogs] = usePersistentState("cs_logs", []);
  const [invoiceLogs, setInvoiceLogs] = usePersistentState("invoice_logs", []);
  const [activityLogs, setActivityLogs] = usePersistentState("activity_logs", []);
  const [notifications, setNotifications] = usePersistentState("notifications", []);
  const [settings, setSettings] = usePersistentState("settings", defaultSettings);
  const [marketingLogs, setMarketingLogs] = usePersistentState("marketing_logs", []);
  const [undoStack, setUndoStack] = usePersistentState("undo_stack", []);
  const [autoBackups, setAutoBackups] = usePersistentState("auto_backups", []);

  const snapshotNow = (label = "수동 스냅샷") => {
    const snap = { id: uid("SNAP"), time: nowIso(), label, data: compactSnapshot({ orders, products, suppliers, invoices, purchaseBatches, inquiries, returnCases, csLogs, invoiceLogs, activityLogs, notifications, marketingLogs, settings }) };
    setUndoStack(prev => [snap, ...prev].slice(0, 8));
    return snap;
  };

  const undoLast = () => {
    const snap = undoStack[0];
    if (!snap) return alert("되돌릴 최근 작업이 없습니다.");
    if (!window.confirm(`${snap.label} 이전 상태로 되돌릴까요?`)) return;
    const d = snap.data;
    setOrders(d.orders || []); setProducts(d.products || []); setSuppliers(d.suppliers || []); setInvoices(d.invoices || []); setPurchaseBatches(d.purchaseBatches || []);
    setInquiries(d.inquiries || []); setReturnCases(d.returnCases || []); setCsLogs(d.csLogs || []); setInvoiceLogs(d.invoiceLogs || []); setActivityLogs(d.activityLogs || []); setNotifications(d.notifications || []); setMarketingLogs(d.marketingLogs || []); setSettings({ ...defaultSettings, ...(d.settings || {}) });
    setUndoStack(prev => prev.slice(1));
    alert("최근 스냅샷으로 복구했습니다.");
  };

  const pushActivity = (type, message, meta = {}) => {
    snapshotNow(type);
    setActivityLogs((prev) => [
      { id: uid("ACT"), time: nowIso(), type, message, actor: settings.currentRole || "관리자", ...meta },
      ...prev,
    ].slice(0, 250));
  };

  const pushNotification = (type, message, targetPage = "대시보드", level = "info") => {
    const item = { id: uid("NTF"), time: nowIso(), type, message, targetPage, level, read: false };
    setNotifications((prev) => [item, ...prev].slice(0, 100));

    if (settings.browserNotifications && "Notification" in window && Notification.permission === "granted") {
      new Notification(`SellerFlow · ${type}`, { body: message });
    }
  };

  useEffect(() => {
    setOrders((prev) => {
      let changed = false;
      const next = prev.map((order) => {
        const product = products.find((p) => p.name === order.product);
        const nextSupplier = order.supplierOverride || product?.supplier || "미연결";
        let nextPurchase = order.purchaseStatus;

        if (!order.marketing && order.purchaseStatus !== "발주완료") {
          if (order.hold) nextPurchase = "보류";
          else if (product?.active === false || product?.stockout) nextPurchase = "자동화 중지";
          else if (product?.automationMode === "수동검토" && !order.manualApproved) nextPurchase = "수동검토";
          else nextPurchase = nextSupplier === "미연결" ? "도매처 연결 필요" : "발주대기";
        }

        if (order.supplier !== nextSupplier || order.purchaseStatus !== nextPurchase) {
          changed = true;
          return { ...order, supplier: nextSupplier, purchaseStatus: nextPurchase };
        }
        return order;
      });
      return changed ? next : prev;
    });
  }, [products, setOrders]);

  useEffect(() => {
    setInvoices((prev) => {
      const eligible = orders.filter((order) => order.purchaseStatus === "발주완료" && !order.marketing && order.supplier !== "미연결");
      const keepIds = new Set(eligible.map((o) => o.id));
      let changed = false;
      let next = prev.filter((row) => {
        const keep = keepIds.has(row.id) || row.source === "마케팅";
        if (!keep) changed = true;
        return keep;
      });

      eligible.forEach((order) => {
        const existing = next.find((row) => row.id === order.id);
        if (!existing) {
          changed = true;
          next.push({
            id: order.id,
            product: order.product,
            supplier: order.supplier,
            carrier: "",
            invoice: "",
            status: order.invoiceStatus === "쿠팡 등록 가능" ? "등록대기" : "송장대기",
            source: "도매처",
            updatedAt: nowIso(),
          });
        } else if (existing.product !== order.product || existing.supplier !== order.supplier) {
          changed = true;
          next = next.map((row) => row.id === order.id ? { ...row, product: order.product, supplier: order.supplier } : row);
        }
      });
      return changed ? next : prev;
    });
  }, [orders, setInvoices]);


  useEffect(() => {
    setOrders(prev => prev.map(o => ({ phone:"", address:"", customerNote:"", supplierNote:"", internalMemo:"", hold:false, holdReason:"", favorite:false, retryCount:0, ...o })));
    setProducts(prev => prev.map(p => ({ alternateSupplier:"", automationMode:"자동", stockout:false, costHistory:[], stockoutHistory:[], ...p })));
    setSuppliers(prev => prev.map(s => ({ minOrderQty:1, minOrderAmount:0, holidays:"", shipLeadDays:1, deliveryLeadDays:2, orderFileName:"{도매처}_{날짜}_발주서", orderSheetName:"발주서", invoiceMapOrderId:"주문번호", invoiceMapCarrier:"택배사", invoiceMapInvoice:"운송장번호", shareTarget:"", orderShareMessage:"{도매처} 발주서입니다. 발주번호 {발주번호}, 총 {주문수}건입니다. 출고 후 송장 파일 회신 부탁드립니다.", ...s })));
    setSettings(prev => ({ ...defaultSettings, ...prev, dataVersion: DATA_VERSION }));
  }, []);

  useEffect(() => {
    const minutes = Math.max(1, Number(settings.autoBackupMinutes || 15));
    const makeBackup = () => {
      const snap = { id:uid("AUTO"), time:nowIso(), label:"자동 백업", data:compactSnapshot({ orders, products, suppliers, invoices, purchaseBatches, inquiries, returnCases, csLogs, invoiceLogs, activityLogs, notifications, marketingLogs, settings }) };
      setAutoBackups(prev => [snap, ...prev].slice(0, 5));
    };
    const timer = setInterval(makeBackup, minutes * 60000);
    return () => clearInterval(timer);
  }, [settings.autoBackupMinutes, orders, products, suppliers, invoices, purchaseBatches, inquiries, returnCases, csLogs, invoiceLogs, activityLogs, notifications, marketingLogs, settings]);

  useEffect(() => {
    if (!settings.autoRetentionCleanup) return;
    const cutoff = Date.now() - Math.max(30, Number(settings.dataRetentionDays || 180)) * 86400000;
    setOrders(prev => prev.map(o => new Date(o.createdAt || 0).getTime() && new Date(o.createdAt).getTime() < cutoff ? { ...o, phone:"", address:"", customerNote:"", supplierNote:"" } : o));
    setReturnCases(prev => prev.map(c => new Date(c.createdAt || 0).getTime() && new Date(c.createdAt).getTime() < cutoff ? { ...c, evidenceImages:[] } : c));
  }, [settings.autoRetentionCleanup, settings.dataRetentionDays]);

  useEffect(() => {
    const handler = (e) => {
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (["input","textarea","select"].includes(tag)) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (e.key.toLowerCase() === "a") openPage("발주 관리");
      if (e.key.toLowerCase() === "i") openPage("운송장 관리");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const preference = settings.theme || "system";
      const resolved = preference === "system" ? (media?.matches ? "dark" : "light") : preference;
      root.dataset.theme = resolved;
      root.dataset.themePreference = preference;
    };
    applyTheme();
    media?.addEventListener?.("change", applyTheme);
    return () => media?.removeEventListener?.("change", applyTheme);
  }, [settings.theme]);

  const cycleTheme = () => {
    const current = settings.theme || "system";
    const next = current === "system" ? "dark" : current === "dark" ? "light" : "system";
    setSettings((prev) => ({ ...prev, theme: next }));
  };

  const derivedNotifications = useMemo(() => {
    const items = [];
    const unlinkedProducts = products.filter((p) => p.active !== false && !p.supplier).length;
    const pausedProducts = products.filter((p) => p.active === false).length;
    const purchaseWaiting = orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기").length;
    const oldPurchase = orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기" && daysAgo(o.createdAt) >= 1).length;
    const invoiceWaiting = invoices.filter((r) => r.status === "송장대기").length;
    const registerReady = invoices.filter((r) => r.status === "등록대기").length;
    const urgentCs = inquiries.filter((q) => q.deadline === "오늘" && q.status !== "답변완료").length;
    const riskyReturns = returnCases.filter((c) => !c.processed && ["품질문제", "오배송", "파손", "사기의심"].includes(c.reason)).length;
    const marketingPending = orders.filter((o) => o.marketing && o.invoiceStatus === "마케팅 송장 대기").length;
    const issues = buildOperationsIssues(orders, products, suppliers, invoices, inquiries, returnCases);

    if (issues.some((x) => x.level === "danger")) items.push({ type: "운영 오류", message: `즉시 확인할 위험 항목 ${issues.filter((x) => x.level === "danger").length}건`, page: "운영 센터", level: "danger" });
    if (unlinkedProducts) items.push({ type: "상품 연결", message: `${unlinkedProducts}개 상품의 도매처 연결이 필요합니다.`, page: "상품 연결", level: "warning" });
    if (pausedProducts) items.push({ type: "자동화 중지", message: `${pausedProducts}개 상품의 자동화가 중지돼 있습니다.`, page: "상품 연결", level: "warning" });
    if (purchaseWaiting) items.push({ type: "발주 대기", message: `${purchaseWaiting}건이 발주를 기다리고 있습니다.`, page: "발주 관리", level: oldPurchase ? "danger" : "warning" });
    if (invoiceWaiting) items.push({ type: "송장 대기", message: `${invoiceWaiting}건의 송장이 아직 도착하지 않았습니다.`, page: "운송장 관리", level: "warning" });

    suppliers.filter((s) => s.active && s.invoiceDeadline).forEach((supplier) => {
      const waiting = invoices.filter((r) => r.supplier === supplier.name && r.status === "송장대기").length;
      if (!waiting) return;
      const minutes = minutesUntilToday(supplier.invoiceDeadline);
      if (minutes !== null && minutes <= 60) {
        items.push({
          type: minutes < 0 ? "송장 마감 초과" : "송장 마감 임박",
          message: `${supplier.name} ${waiting}건 · ${supplier.invoiceDeadline} · ${formatCountdown(minutes)}`,
          page: "운송장 관리",
          level: "danger",
        });
      }
    });

    returnCases.filter((c) => !c.processed && String(c.status).includes("확인대기")).forEach((caseItem) => {
      const supplier = suppliers.find((s) => s.name === caseItem.supplier);
      if (!supplier) return;
      const elapsedHours = (Date.now() - new Date(caseItem.createdAt).getTime()) / 3600000;
      if (elapsedHours >= Number(supplier.responseDeadlineHours || 24)) {
        items.push({ type: "도매처 회신 지연", message: `${caseItem.id} · ${supplier.name} 회신 제한시간 초과`, page: "CS 관리", level: "danger" });
      }
    });

    if (registerReady) items.push({ type: "쿠팡 등록", message: `${registerReady}건이 쿠팡 등록 준비 상태입니다.`, page: "운송장 관리", level: "info" });
    if (urgentCs) items.push({ type: "CS 마감 임박", message: `오늘 답변해야 할 문의가 ${urgentCs}건 있습니다.`, page: "CS 관리", level: "danger" });
    if (riskyReturns) items.push({ type: "CS 수동검토", message: `품질·오배송·파손·사기의심 ${riskyReturns}건을 확인해야 합니다.`, page: "CS 관리", level: "danger" });
    if (marketingPending) items.push({ type: "마케팅 송장", message: `마케팅 주문 ${marketingPending}건의 송장이 필요합니다.`, page: "마케팅 주문", level: "warning" });
    return items;
  }, [products, orders, invoices, inquiries, returnCases, suppliers]);

  const unreadCount = notifications.filter((n) => !n.read).length + derivedNotifications.length;

  const openPage = (name, options = {}) => {
    if (!roleCanAccess(settings.currentRole || "관리자", name)) { alert(`${settings.currentRole} 권한에서는 ${name} 메뉴를 사용할 수 없습니다.`); return; }
    if (name === "주문내역") setOrderFilter(options.orderFilter || "all");
    if (name === "운송장 관리") setInvoiceFilter(options.invoiceFilter || "all");
    if (name === "상품 연결") setProductFilter(options.productFilter || "all");
    setPage(name);
  };

  const shared = {
    orders, setOrders, products, setProducts, suppliers, setSuppliers, invoices, setInvoices,
    purchaseBatches, setPurchaseBatches, inquiries, setInquiries, returnCases, setReturnCases,
    csLogs, setCsLogs, invoiceLogs, setInvoiceLogs, activityLogs, setActivityLogs,
    notifications, setNotifications, settings, setSettings, marketingLogs, setMarketingLogs,
    pushActivity, pushNotification, openPage, undoStack, setUndoStack, autoBackups, setAutoBackups, snapshotNow, undoLast,
  };

  return (
    <div className="app">
      <aside>
        <div className="logo"><i>S</i><b>Seller<span>Flow</span></b></div>
        <div className="workspace"><b>내 판매센터</b><small>● 운영형 MVP v6</small></div>
        {menus.filter(([name]) => roleCanAccess(settings.currentRole || "관리자", name)).map(([name, icon]) => (
          <button key={name} className={page === name ? "active" : ""} onClick={() => openPage(name)}>
            <em>{icon}</em>{name}
          </button>
        ))}
      </aside>

      <main>
        <header className="topHeader">
          <div>SellerFlow / <b>{page}</b></div>
          <div className="headerTools">
            <span className={`modeBadge ${settings.apiOutage ? "danger" : ""}`}>{settings.apiOutage ? "API 장애모드" : settings.systemMode}</span>
            <input id="global-search" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="주문·고객·전화·상품·도매처·송장 검색" />
            <button className="themeToggle" onClick={cycleTheme} title={`테마: ${settings.theme === "dark" ? "다크" : settings.theme === "light" ? "라이트" : "시스템"}`}>{settings.theme === "dark" ? "🌙" : settings.theme === "light" ? "☀️" : "◐"}</button>
            <button className="secondary undoTop" onClick={undoLast} disabled={!undoStack.length}>↶ 되돌리기</button>
            <button className="bell" onClick={() => openPage("운영 센터")}>알림 {unreadCount}</button>
          </div>
        </header>

        <section className="content">
          {page === "대시보드" && <Dashboard {...shared} derivedNotifications={derivedNotifications} globalSearch={globalSearch} setPage={openPage} />}
          {page === "운영 센터" && <OperationsPage {...shared} derivedNotifications={derivedNotifications} />}
          {page === "주문내역" && <OrderPage {...shared} orderFilter={orderFilter} globalSearch={globalSearch} />}
          {page === "도매처 관리" && <SupplierPage {...shared} />}
          {page === "상품 연결" && <ProductLinkPage {...shared} productFilter={productFilter} />}
          {page === "발주 관리" && <PurchasePage {...shared} />}
          {page === "운송장 관리" && <InvoicePage {...shared} invoiceFilter={invoiceFilter} globalSearch={globalSearch} />}
          {page === "마케팅 주문" && <MarketingPage {...shared} />}
          {page === "CS 관리" && <CSPage {...shared} />}
          {page === "정산 분석" && <SettlementPage {...shared} />}
          {page === "성과 분석" && <InsightsPage {...shared} />}
          {page === "마진 계산기" && <MarginPage />}
          {page === "설정" && <SettingsPage {...shared} />}
        </section>
        <div className="mobileQuickActions"><button onClick={() => openPage("주문내역")}>주문</button><button onClick={() => openPage("발주 관리")}>발주</button><button onClick={() => openPage("운송장 관리")}>송장</button><button onClick={() => openPage("CS 관리")}>CS</button></div>
      </main>
    </div>
  );
}

function Dashboard({ orders, products, suppliers, invoices, inquiries, returnCases, activityLogs, notifications, setNotifications, derivedNotifications, setPage, globalSearch, settings }) {
  const [range, setRange] = useState(7);
  const data = useMemo(() => sales30.slice(-range), [range]);
  const issues = buildOperationsIssues(orders, products, suppliers, invoices, inquiries, returnCases);

  const counts = {
    connection: products.filter((p) => p.active !== false && !p.supplier).length,
    purchase: orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기").length,
    invoice: invoices.filter((r) => r.status === "송장대기").length,
    ready: invoices.filter((r) => r.status === "등록대기").length,
    cs: inquiries.filter((q) => q.deadline === "오늘" && q.status !== "답변완료").length,
    risk: issues.filter((x) => x.level === "danger").length,
  };

  const recent = orders.filter((o) => !globalSearch || [o.id, o.customer, o.product, o.supplier].join(" ").toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 6);
  const allNotices = [
    ...derivedNotifications.map((n) => ({ id: `derived-${n.type}-${n.message}`, ...n, derived: true })),
    ...notifications.slice(0, 8).map((n) => ({ ...n, page: n.targetPage })),
  ];

  return (
    <>
      <PageHead title="대시보드" description="주문부터 발주·송장·CS까지 현재 자동화 상태를 확인합니다." actions={<button className="primary" onClick={() => setPage("운영 센터")}>오늘 할 일 {issues.length}건</button>} />
      <div className="cards cards6">
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("연결 필요") && <StatusCard count={counts.connection} title="연결 필요" description="상품 도매처 연결" onClick={() => setPage("상품 연결", { productFilter: "unlinked" })} />}
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("발주 대기") && <StatusCard count={counts.purchase} title="발주 대기" description="도매처 주문서 생성" onClick={() => setPage("발주 관리")} />}
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("운송장 대기") && <StatusCard count={counts.invoice} title="운송장 대기" description="도매처 송장 수신" onClick={() => setPage("운송장 관리", { invoiceFilter: "waiting" })} />}
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("쿠팡 등록 가능") && <StatusCard count={counts.ready} title="쿠팡 등록 가능" description="송장 등록 준비" onClick={() => setPage("운송장 관리", { invoiceFilter: "ready" })} />}
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("CS 마감 임박") && <StatusCard count={counts.cs} title="CS 마감 임박" description="오늘 답변 필요" onClick={() => setPage("CS 관리")} />}
        {(settings.dashboardCards || defaultSettings.dashboardCards).includes("운영 위험") && <StatusCard count={counts.risk} title="운영 위험" description="오류·이상 주문 확인" onClick={() => setPage("운영 센터")} />}
      </div>

      <div className="dashboardGrid">
        <div className="panel">
          <div className="panelHead">
            <div><h2>판매 분석</h2><p>일별 주문수와 매출 흐름</p></div>
            <div className="tabs">{[7, 15, 30].map((n) => <button key={n} className={range === n ? "on" : ""} onClick={() => setRange(n)}>{n}일</button>)}</div>
          </div>
          <SalesChart data={data} />
          <div className="legend"><span className="purpleDot" /> 주문수 <span className="greenDot" /> 매출(원)</div>
        </div>

        <div className="panel noticePanel">
          <div className="panelHead"><div><h2>알림 센터</h2><p>놓치면 안 되는 작업</p></div><button className="secondary" onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}>모두 읽음</button></div>
          {allNotices.length === 0 ? <EmptyLine text="현재 긴급 알림이 없습니다." /> : allNotices.slice(0, 8).map((n) => (
            <button key={n.id} className={`noticeRow ${n.level || "info"}`} onClick={() => n.page && setPage(n.page)}>
              <span><b>{n.type}</b><small>{n.message}</small></span><em>→</em>
            </button>
          ))}
        </div>
      </div>

      <div className="panel"><div className="panelHead"><div><h2>최근 주문내역</h2><p>실제 저장 상태 기준</p></div></div><OrderTable rows={recent} /></div>
      <div className="panel"><div className="panelHead"><div><h2>최근 작업 로그</h2><p>중요 작업의 감사 기록</p></div></div><LogTable rows={activityLogs.slice(0, 8)} /></div>
    </>
  );
}

function OperationsPage({ orders, setOrders, products, suppliers, invoices, inquiries, returnCases, activityLogs, openPage, pushActivity, settings }) {
  const [tab, setTab] = useState("할일");
  const issues = useMemo(() => buildOperationsIssues(orders, products, suppliers, invoices, inquiries, returnCases), [orders, products, suppliers, invoices, inquiries, returnCases]);
  const waiting = orders.filter(o => !o.marketing && o.purchaseStatus === "발주대기");
  const invoiceWaiting = invoices.filter(r => r.status === "송장대기");
  const registerReady = invoices.filter(r => r.status === "등록대기");
  const csUrgent = inquiries.filter(q => q.deadline === "오늘" && q.status !== "답변완료");
  const manual = returnCases.filter(c => !c.processed && ["품질문제","오배송","파손","사기의심"].includes(c.reason));
  const tasks = [
    issues.some(x=>x.level==="danger") && {level:"danger",title:"운영 오류 먼저 확인",description:`위험 ${issues.filter(x=>x.level==="danger").length}건`,page:"운영 센터"},
    csUrgent.length && {level:"danger",title:"오늘 CS 답변",description:`${csUrgent.length}건`,page:"CS 관리"},
    manual.length && {level:"danger",title:"CS 수동검토",description:`${manual.length}건`,page:"CS 관리"},
    orders.some(o=>o.supplier==="미연결") && {level:"warning",title:"도매처 연결",description:`${orders.filter(o=>o.supplier==="미연결").length}건`,page:"상품 연결"},
    waiting.length && {level:"warning",title:"도매처 발주",description:`${waiting.length}건`,page:"발주 관리"},
    invoiceWaiting.length && {level:"warning",title:"송장 수신",description:`${invoiceWaiting.length}건`,page:"운송장 관리"},
    registerReady.length && {level:"info",title:"쿠팡 송장 등록",description:`${registerReady.length}건`,page:"운송장 관리"},
  ].filter(Boolean);
  const blocked = orders.filter(o => orderRiskReasons(o, products, suppliers, invoices).length > 0);
  const simulation = { total:orders.filter(o=>!o.marketing && ["발주대기","수동검토","보류"].includes(o.purchaseStatus)).length, pass:waiting.filter(o=>orderRiskReasons(o,products,suppliers,invoices).length===0).length, blocked:blocked.length };
  const health = settings.apiOutage || issues.some(x=>x.level==="danger") ? "긴급" : issues.length || tasks.length ? "확인 필요" : "정상";
  const retryIssue = (issue) => {
    const order = orders.find(o => o.id === issue.target);
    if (!order) return openPage(issue.page);
    const next = Number(order.retryCount || 0) + 1;
    if (next > Number(settings.retryLimit || 3)) return alert(`자동 재시도 한도(${settings.retryLimit || 3}회)를 초과했습니다. 수동 확인이 필요합니다.`);
    setOrders(prev => prev.map(o => o.id===order.id ? {...o,retryCount:next} : o));
    pushActivity("오류 재시도", `${order.id} 재시도 ${next}/${settings.retryLimit || 3}`);
    alert("재검사를 예약했습니다. 원인이 해결되지 않으면 오류함에 유지됩니다.");
  };
  const deadlines = suppliers.filter(s=>s.active).map(s=>({supplier:s,purchaseCount:waiting.filter(o=>o.supplier===s.name).length,invoiceCount:invoiceWaiting.filter(r=>r.supplier===s.name).length,purchaseMinutes:minutesUntilToday(s.orderDeadline),invoiceMinutes:minutesUntilToday(s.invoiceDeadline)})).filter(x=>x.purchaseCount||x.invoiceCount);
  const exportOperations = () => { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(orders),"주문"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(issues),"오류"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(invoices),"운송장"); XLSX.writeFile(wb,`SellerFlow_운영_${new Date().toISOString().slice(0,10)}.xlsx`); pushActivity("운영 데이터 내보내기",`주문 ${orders.length}건`); };
  const morning = [`전날 미처리 발주 ${orders.filter(o=>o.purchaseStatus==="발주대기"&&daysAgo(o.createdAt)>=1).length}건`,`송장 미수신 ${invoiceWaiting.length}건`,`CS 미처리 ${csUrgent.length+manual.length}건`];
  const closing = [`오늘 발주대기 ${waiting.length}건`,`쿠팡 등록대기 ${registerReady.length}건`,`미답변 CS ${csUrgent.length}건`,`운영 위험 ${issues.filter(x=>x.level==="danger").length}건`];
  return <>
    <PageHead title="운영 센터" description="오늘 할 일·오류·마감·시뮬레이션·시작/마감 체크리스트를 한곳에서 관리합니다." actions={<><span className={`healthBadge ${health==='긴급'?'danger':health==='정상'?'ok':''}`}>운영 상태 · {health}</span><button className="secondary" onClick={exportOperations}>운영 Excel</button></>} />
    <div className="tabs wideTabs">{["할일","오류함","시뮬레이션","체크리스트"].map(x=><button key={x} className={tab===x?"on":""} onClick={()=>setTab(x)}>{x}</button>)}</div>
    <div className="cards"><MiniStat title="오늘 할 일" value={tasks.length}/><MiniStat title="위험 오류" value={issues.filter(x=>x.level==="danger").length}/><MiniStat title="발주 대기" value={waiting.length}/><MiniStat title="등록 가능" value={registerReady.length}/></div>
    {tab==="할일" && <div className="operationsGrid"><div className="panel"><div className="panelHead"><div><h2>오늘 할 일 자동 큐</h2><p>위험 → 마감 → 일반 작업 순</p></div></div>{tasks.length? <div className="taskList">{tasks.map((t,i)=><button key={i} className={`taskRow ${t.level}`} onClick={()=>openPage(t.page)}><span className="taskIndex">{i+1}</span><span><b>{t.title}</b><small>{t.description}</small></span><em>열기 →</em></button>)}</div>:<EmptyLine text="처리할 긴급 작업이 없습니다."/>}</div><div className="panel"><div className="panelHead"><div><h2>도매처 마감</h2><p>발주/송장 남은 시간</p></div></div>{deadlines.length?deadlines.map(d=><div className="deadlineRow" key={d.supplier.id}><div><b>{d.supplier.name}</b><small>{d.supplier.method}</small></div><div><span>발주 {d.purchaseCount}건</span><strong className={(d.purchaseMinutes??999)<=60?"dangerText":""}>{formatCountdown(d.purchaseMinutes)}</strong></div><div><span>송장 {d.invoiceCount}건</span><strong className={(d.invoiceMinutes??999)<=60?"dangerText":""}>{formatCountdown(d.invoiceMinutes)}</strong></div></div>):<EmptyLine text="대기 작업 없음"/>}</div></div>}
    {tab==="오류함" && <div className="panel"><div className="panelHead"><div><h2>오류함 · 이상 주문</h2><p>실패 원인과 해결 화면을 바로 제공합니다.</p></div></div><div className="table"><table><thead><tr><th>중요도</th><th>유형</th><th>대상</th><th>원인</th><th>작업</th></tr></thead><tbody>{issues.length?issues.map(i=><tr key={i.id}><td><span className={`severity ${i.level}`}>{i.level==='danger'?'긴급':'확인'}</span></td><td>{i.type}</td><td><b>{i.target}</b></td><td>{i.message}</td><td className="actions"><button className="secondary" onClick={()=>openPage(i.page)}>해결</button><button className="secondary" onClick={()=>retryIssue(i)}>재시도</button></td></tr>):<tr><td colSpan="5">오류 없음</td></tr>}</tbody></table></div></div>}
    {tab==="시뮬레이션" && <div className="panel"><div className="panelHead"><div><h2>자동화 사전 시뮬레이션</h2><p>지금 자동화를 실행했을 때 처리/차단될 주문을 실제 변경 없이 계산합니다.</p></div></div><div className="cards"><MiniStat title="검사 대상" value={simulation.total}/><MiniStat title="즉시 처리 가능" value={simulation.pass}/><MiniStat title="차단/검토" value={simulation.blocked}/><MiniStat title="API 재시도 한도" value={Number(settings.retryLimit||3)}/></div><p className="securityNote">실운영 모드에서도 이 버튼은 상태를 변경하지 않습니다. 실제 API 호출 전 미리보기 용도입니다.</p></div>}
    {tab==="체크리스트" && <div className="operationsGrid"><div className="panel"><h2>아침 시작 체크리스트</h2>{morning.map((x,i)=><label className="checkLine" key={x}><input type="checkbox"/> {i+1}. {x}</label>)}</div><div className="panel"><h2>마감 전 체크리스트</h2>{closing.map((x,i)=><label className="checkLine" key={x}><input type="checkbox"/> {i+1}. {x}</label>)}</div></div>}
    <div className="panel"><div className="panelHead"><div><h2>최근 운영 기록</h2></div></div><LogTable rows={activityLogs.slice(0,12)}/></div>
  </>;
}

function OrderPage({ orders, setOrders, products, setProducts, suppliers, invoices, purchaseBatches, globalSearch, orderFilter, openPage, pushActivity, pushNotification, settings, inquiries, returnCases }) {
  const [search,setSearch]=useState(""); const [selectedOrderId,setSelectedOrderId]=useState(null); const [selected,setSelected]=useState([]); const [preset,setPreset]=useState(orderFilter||"all");
  const [savedFilters,setSavedFilters]=usePersistentState("saved_order_filters",[{id:"F1",name:"미연결",preset:"unlinked"},{id:"F2",name:"오늘 발주",preset:"waiting"},{id:"F3",name:"보류",preset:"hold"},{id:"F4",name:"즐겨찾기",preset:"favorite"}]);
  const q=(search||globalSearch).trim().toLowerCase();
  const searchable=o=>{ const inv=invoices.find(r=>r.id===o.id); return [o.id,o.customer,o.phone,o.address,o.product,o.option,o.supplier,inv?.invoice,inv?.carrier,o.internalMemo].join(" ").toLowerCase(); };
  const rows=orders.filter(o=>{ if(q&&!searchable(o).includes(q)) return false; const f=preset||orderFilter; if(f==="waiting")return o.purchaseStatus==="발주대기"&&!o.marketing; if(f==="purchased")return o.purchaseStatus==="발주완료"; if(f==="unlinked")return o.supplier==="미연결"; if(f==="marketing")return o.marketing; if(f==="hold")return o.hold; if(f==="favorite")return o.favorite; if(f==="risk")return orderRiskReasons(o,products,suppliers,invoices).length>0; return true; });
  const selectedOrder=orders.find(o=>o.id===selectedOrderId); const toggle=id=>setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); const toggleAll=()=>setSelected(selected.length===rows.length?[]:rows.map(o=>o.id));
  const applyBulk=(action)=>{ if(!selected.length)return alert("주문을 선택해주세요."); let patch={}; let desc=""; if(action==="hold"){const reason=prompt("보류 이유", "확인 필요"); if(reason===null)return; patch={hold:true,holdReason:reason};desc=`${selected.length}건 보류`;} if(action==="unhold"){patch={hold:false,holdReason:""};desc=`${selected.length}건 보류 해제`;} if(action==="favorite"){patch={favorite:true};desc=`${selected.length}건 즐겨찾기`;} if(action==="memo"){const memo=prompt("선택 주문에 추가할 내부 메모","");if(memo===null)return;patch={internalMemo:memo};desc=`${selected.length}건 메모 수정`;} if(!confirm(`${desc}\n\n변경 전: ${selected.length}건 선택\n변경 후: 동일 ${selected.length}건에 적용`))return; setOrders(p=>p.map(o=>selected.includes(o.id)?{...o,...patch}:o)); pushActivity("대량 주문 수정",desc); setSelected([]); };
  const bulkSupplier=()=>{ if(!selected.length)return alert("주문 선택 필요"); const name=prompt(`도매처명 입력\n${suppliers.filter(s=>s.active).map(s=>s.name).join(", ")}`); if(!name)return; if(!suppliers.some(s=>s.name===name&&s.active))return alert("사용 가능한 도매처가 아닙니다."); if(!confirm(`${selected.length}건의 주문 도매처를 ${name}(으)로 변경할까요?`))return; setOrders(p=>p.map(o=>selected.includes(o.id)?{...o,supplierOverride:name}:o)); pushActivity("대량 도매처 변경",`${selected.length}건 → ${name}`); setSelected([]); };
  const importDemoOrder=()=>{ const active=products.filter(p=>p.active!==false&&!p.stockout); if(!active.length)return alert("자동화 사용 상품 없음"); const product=active[Math.floor(Math.random()*active.length)]; const n=Math.max(10000,...orders.map(o=>Number(String(o.id).replace(/\D/g,""))||0))+1; const id=`C${n}`; const supplier=product.supplier||"미연결"; const order={id,date:new Date().toLocaleDateString("ko-KR",{month:"2-digit",day:"2-digit"}).replace(/\.\s?/g,"/").replace(/\/$/,""),createdAt:nowIso(),customer:"데모고객",phone:"010-1234-0000",address:"경남 창원시 데모로 1",product:product.name,option:product.option,qty:1,saleAmount:product.price,supplier,purchaseStatus:supplier==="미연결"?"도매처 연결 필요":"발주대기",invoiceStatus:"송장대기",marketing:false,channelStatus:"결제완료",favorite:false,hold:false}; setOrders(p=>[order,...p]); pushActivity("주문 가져오기",`${id} 1건 추가(데모)`); pushNotification("주문 가져오기 완료",`${id} 주문을 가져왔습니다.`,"주문내역"); };
  const updateOrder=(id,patch,label="주문 수정")=>{setOrders(p=>p.map(o=>o.id===id?{...o,...patch}:o));pushActivity(label,`${id} 수정`);};
  const saveFilter=()=>{const name=prompt("필터 이름",search||"내 필터");if(!name)return;setSavedFilters(p=>[...p,{id:uid("FILTER"),name,preset,search}].slice(-12));};
  const chosenProduct=selectedOrder?products.find(p=>p.name===selectedOrder.product):null; const chosenSupplier=selectedOrder?suppliers.find(s=>s.name===selectedOrder.supplier):null; const chosenInvoice=selectedOrder?invoices.find(r=>r.id===selectedOrder.id):null; const risks=selectedOrder?orderRiskReasons(selectedOrder,products,suppliers,invoices):[];
  const timeline=selectedOrder?[{time:selectedOrder.createdAt,label:"주문 수집"},selectedOrder.purchaseBatchId&&{time:purchaseBatches.find(b=>b.id===selectedOrder.purchaseBatchId)?.createdAt,label:"발주 완료"},chosenInvoice&&{time:chosenInvoice.updatedAt,label:`운송장 ${chosenInvoice.status}`},...inquiries.filter(q=>q.orderId===selectedOrder.id).map(q=>({time:q.createdAt,label:`문의 ${q.status}`})),...returnCases.filter(c=>c.orderId===selectedOrder.id).map(c=>({time:c.createdAt,label:`${c.caseType} ${c.status}`}))].filter(Boolean).sort((a,b)=>new Date(a.time)-new Date(b.time)):[];
  const expectedShip=selectedOrder&&chosenSupplier?plusSupplierDays(selectedOrder.createdAt,chosenSupplier.shipLeadDays||1,chosenSupplier.holidays):"-"; const expectedDelivery=selectedOrder&&chosenSupplier?plusSupplierDays(selectedOrder.createdAt,(chosenSupplier.shipLeadDays||1)+(chosenSupplier.deliveryLeadDays||2),chosenSupplier.holidays):"-";
  return <>
    <PageHead title="주문내역" description="스마트 검색·저장 필터·대량 수정·보류·즐겨찾기·통합 상세·타임라인을 지원합니다." actions={<><button className="secondary" onClick={importDemoOrder}>주문 가져오기(데모)</button><button className="primary" onClick={()=>openPage("발주 관리")}>발주 관리</button></>}/>
    <div className="panel filterBar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="주문번호·고객·전화·주소·상품·도매처·송장번호 검색"/><select value={preset} onChange={e=>setPreset(e.target.value)}><option value="all">전체</option><option value="waiting">발주 대기</option><option value="unlinked">미연결</option><option value="hold">보류</option><option value="favorite">즐겨찾기</option><option value="risk">위험 주문</option><option value="marketing">마케팅</option></select><button className="secondary" onClick={saveFilter}>현재 필터 저장</button>{savedFilters.map(f=><button className="chip" key={f.id} onClick={()=>{setPreset(f.preset||"all");setSearch(f.search||"")}}>{f.name}</button>)}</div>
    {selected.length>0&&<div className="panel bulkBar"><b>{selected.length}건 선택</b><button className="secondary" onClick={()=>applyBulk("hold")}>보류</button><button className="secondary" onClick={()=>applyBulk("unhold")}>보류 해제</button><button className="secondary" onClick={()=>applyBulk("favorite")}>즐겨찾기</button><button className="secondary" onClick={bulkSupplier}>도매처 변경</button><button className="secondary" onClick={()=>applyBulk("memo")}>메모</button></div>}
    <div className="panel"><div className="table"><table><thead><tr><th><input type="checkbox" checked={rows.length>0&&selected.length===rows.length} onChange={toggleAll}/></th><th>핀</th><th>주문번호</th><th>날짜</th><th>고객</th><th>상품</th><th>수량</th><th>금액</th><th>도매처</th><th>발주</th><th>송장</th><th>점검</th><th>작업</th></tr></thead><tbody>{rows.length?rows.map(o=>{const rr=orderRiskReasons(o,products,suppliers,invoices);return <tr key={o.id} className={o.hold?"heldRow":""}><td><input type="checkbox" checked={selected.includes(o.id)} onChange={()=>toggle(o.id)}/></td><td><button className="iconButton" onClick={()=>updateOrder(o.id,{favorite:!o.favorite},"즐겨찾기")}>{o.favorite?"★":"☆"}</button></td><td><b>{o.id}</b>{o.hold&&<small className="subText dangerText">보류</small>}</td><td>{o.date}</td><td>{o.customer}<small className="subText">{settings.privacyMasking?maskPhone(o.phone):o.phone||"-"}</small></td><td>{o.product}<small className="subText">{o.option}</small></td><td>{o.qty}</td><td>{money(o.saleAmount)}</td><td>{o.supplier}</td><td><Tag>{o.purchaseStatus}</Tag></td><td><Tag>{o.invoiceStatus}</Tag></td><td>{rr.length?<span className="severity danger">{rr.length}개</span>:<span className="okText">정상</span>}</td><td><button className="secondary" onClick={()=>setSelectedOrderId(o.id)}>상세</button></td></tr>}):<tr><td colSpan="13">주문 없음</td></tr>}</tbody></table></div></div>
    {selectedOrder&&<div className="panel orderDetailPanel"><div className="panelHead"><div><h2>주문 통합 상세</h2><p>{selectedOrder.id} · 고객/발주/송장/CS/수익/일정을 한 화면에서 확인</p></div><button className="secondary" onClick={()=>setSelectedOrderId(null)}>닫기</button></div><div className="detailGrid"><Detail label="고객" value={`${selectedOrder.customer} · ${customerRiskLabel(selectedOrder,inquiries,returnCases,orders)}`}/><Detail label="전화" value={settings.privacyMasking?maskPhone(selectedOrder.phone):selectedOrder.phone||"-"}/><Detail label="주소" value={settings.privacyMasking?maskAddress(selectedOrder.address):selectedOrder.address||"-"}/><Detail label="상품" value={`${selectedOrder.product} · ${selectedOrder.option}`}/><Detail label="예상 출고" value={expectedShip}/><Detail label="예상 도착" value={expectedDelivery}/><Detail label="도매처" value={selectedOrder.supplier}/><Detail label="송장" value={chosenInvoice?.invoice?`${chosenInvoice.carrier} ${chosenInvoice.invoice}`:"미입력"}/><Detail label="예상 순이익" value={money(Math.round(productProfit(selectedOrder,chosenProduct)))}/><Detail label="내부 메모" value={selectedOrder.internalMemo||"없음"}/><Detail label="고객 요청" value={selectedOrder.customerNote||"없음"}/><Detail label="도매처 전달" value={selectedOrder.supplierNote||"없음"}/></div><div className="formActions left"><button className="secondary" onClick={()=>{const v=prompt("고객 요청사항",selectedOrder.customerNote||"");if(v!==null)updateOrder(selectedOrder.id,{customerNote:v})}}>고객 요청 메모</button><button className="secondary" onClick={()=>{const v=prompt("도매처 전달사항",selectedOrder.supplierNote||"");if(v!==null)updateOrder(selectedOrder.id,{supplierNote:v})}}>도매처 전달 메모</button><button className="secondary" onClick={()=>{const v=prompt("내부 메모",selectedOrder.internalMemo||"");if(v!==null)updateOrder(selectedOrder.id,{internalMemo:v})}}>내부 메모</button>{chosenProduct?.automationMode==="수동검토"&&!selectedOrder.manualApproved&&<button className="primary" onClick={()=>updateOrder(selectedOrder.id,{manualApproved:true,purchaseStatus:"발주대기"},"수동 검토 승인")}>수동 검토 승인</button>}{chosenProduct?.alternateSupplier&&<button className="secondary" onClick={()=>updateOrder(selectedOrder.id,{supplierOverride:chosenProduct.alternateSupplier},"대체 도매처 적용")}>대체 도매처: {chosenProduct.alternateSupplier}</button>}</div><div className="riskBox"><b>자동 점검</b>{risks.length?<ul>{risks.map(r=><li key={r}>{r}</li>)}</ul>:<p className="okText">위험 요소 없음</p>}</div><div className="timeline"><b>주문 타임라인</b>{timeline.map((t,i)=><div className="timelineRow" key={i}><span>{new Date(t.time).toLocaleString("ko-KR")}</span><strong>{t.label}</strong></div>)}</div></div>}
  </>;
}

function PurchasePage({ orders, setOrders, products, suppliers, invoices, setInvoices, purchaseBatches, setPurchaseBatches, settings, pushActivity, pushNotification }) {
  const [selected, setSelected] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [sharingKey, setSharingKey] = useState("");
  const eligible = orders.filter((o) => !o.marketing && !o.hold && o.supplier !== "미연결" && o.purchaseStatus === "발주대기");

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === eligible.length ? [] : eligible.map((o) => o.id));

  const validate = (order) => {
    const problems = [];
    const supplier = suppliers.find((s) => s.name === order.supplier);
    const product = products.find((p) => p.name === order.product);
    if (!supplier) problems.push("도매처 데이터 없음");
    else {
      if (!supplier.active) problems.push("중지된 도매처");
      const holidayList=String(supplier.holidays||"").split(",").map(x=>x.trim()).filter(Boolean);
      const today=new Date().toISOString().slice(0,10); if(holidayList.includes(today)) problems.push("도매처 휴무일");
    }
    if (!product) problems.push("상품 데이터 없음");
    else { if (product.active === false || product.stockout) problems.push("자동화 중지/품절 상품"); if(product.automationMode==="수동검토" && !order.manualApproved) problems.push("상품 수동검토 규칙"); if(productProfit(order,product)<0) problems.push("손해 주문 차단"); }
    if (order.hold) problems.push("보류 주문");
    if (order.address && addressLooksInvalid(order.address)) problems.push("배송지 확인 필요");
    if (!Number(order.qty || 0) || Number(order.qty) < 1) problems.push("수량 오류");
    if (order.purchaseBatchId) problems.push("기존 발주 묶음 존재");
    return problems;
  };

  const selectedOrders = eligible.filter((o) => selected.includes(o.id));
  const groupIssues = Object.entries(selectedOrders.reduce((a,o)=>((a[o.supplier]||=[]).push(o),a),{})).flatMap(([name,items])=>{
    const sp=suppliers.find(s=>s.name===name); if(!sp) return []; const qty=items.reduce((a,o)=>a+Number(o.qty||0),0); const amount=items.reduce((a,o)=>a+Number(o.saleAmount||0)*Number(o.qty||1),0); const out=[];
    if(qty<Number(sp.minOrderQty||1)) out.push({id:name,message:`도매처 묶음 최소수량 ${sp.minOrderQty||1} 미달 (현재 ${qty})`});
    if(amount<Number(sp.minOrderAmount||0)) out.push({id:name,message:`도매처 묶음 최소금액 ${money(sp.minOrderAmount)} 미달 (현재 ${money(amount)})`});
    return out;
  });
  const selectedIssues = [...selectedOrders.flatMap((o) => validate(o).map((message) => ({ id: o.id, message }))), ...groupIssues];

  const buildRowsForSupplier = (supplierName, items) => {
    const supplier = suppliers.find((s) => s.name === supplierName);
    const columns = String(supplier?.orderColumns || "주문번호,주문일,수취인,상품명,옵션,수량").split(",").map((x) => x.trim()).filter(Boolean);
    return items.map((order) => {
      const source = {
        주문번호: order.id, 주문일: order.date, 수취인: order.customer, 고객명: order.customer,
        상품명: order.product, 옵션: order.option, 수량: order.qty, 판매금액: order.saleAmount,
        연락처: order.phone || "", 수취인연락처: order.phone || "", 주소: order.address || "", 배송주소: order.address || "",
        보내는사람: settings.senderName || "", 보내는사람연락처: settings.senderPhone || "", 보내는사람주소: settings.senderAddress || "",
      };
      const row = {}; columns.forEach((col) => { row[col] = source[col] ?? ""; }); return row;
    });
  };

  const makeSupplierFile = (supplierName, items) => {
    const rows = buildRowsForSupplier(supplierName, items);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const supplierData = suppliers.find((s) => s.name === supplierName);
    XLSX.utils.book_append_sheet(wb, ws, supplierData?.orderSheetName || "발주서");
    const array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const base = (supplierData?.orderFileName || "{도매처}_{날짜}_발주서").replace("{도매처}", supplierName).replace("{날짜}", new Date().toISOString().slice(0, 10));
    const filename = `${base}.xlsx`;
    const blob = new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const file = new File([blob], filename, { type: blob.type });
    return { array, blob, file, filename };
  };

  const batchSupplierOrders = (batch, supplierName) => orders.filter((o) => batch.orderIds.includes(o.id) && o.supplier === supplierName);
  const deliveryInfo = (batch, supplierName) => batch.deliveries?.[supplierName] || { status: "미전송", sentAt: "", method: suppliers.find((s) => s.name === supplierName)?.method || "수동" };

  const renderShareMessage = (batch, supplierName, count) => {
    const supplier = suppliers.find((s) => s.name === supplierName);
    const template = supplier?.orderShareMessage || "{도매처} 발주서입니다. 발주번호 {발주번호}, 총 {주문수}건입니다. 출고 후 송장 파일 회신 부탁드립니다.";
    return template.replaceAll("{도매처}", supplierName).replaceAll("{발주번호}", batch.id).replaceAll("{주문수}", String(count));
  };

  const markDelivery = (batchId, supplierName, status, extra = {}) => {
    setPurchaseBatches((prev) => prev.map((batch) => batch.id === batchId ? {
      ...batch,
      deliveries: {
        ...(batch.deliveries || {}),
        [supplierName]: { ...deliveryInfo(batch, supplierName), status, ...extra },
      },
    } : batch));
  };

  const copyShareMessage = async (batch, supplierName) => {
    const items = batchSupplierOrders(batch, supplierName);
    const text = renderShareMessage(batch, supplierName, items.length);
    try {
      await navigator.clipboard.writeText(text);
      alert("발주 메시지를 복사했습니다.");
    } catch {
      window.prompt("아래 발주 메시지를 복사하세요.", text);
    }
  };

  const downloadSupplierFile = (batch, supplierName) => {
    const items = batchSupplierOrders(batch, supplierName);
    if (!items.length) return alert("해당 도매처 주문이 없습니다.");
    const { blob, filename } = makeSupplierFile(supplierName, items);
    saveBlob(blob, filename);
    pushActivity("도매처 발주서 다운로드", `${batch.id} · ${supplierName} · ${items.length}건`);
  };

  const shareSupplierFile = async (batch, supplierName) => {
    const key = `${batch.id}-${supplierName}`;
    if (sharingKey) return;
    const items = batchSupplierOrders(batch, supplierName);
    if (!items.length) return alert("해당 도매처 주문이 없습니다.");
    const supplier = suppliers.find((s) => s.name === supplierName);
    const { file, blob, filename } = makeSupplierFile(supplierName, items);
    const text = renderShareMessage(batch, supplierName, items.length);
    setSharingKey(key);
    try {
      const shareData = { title: `${supplierName} 발주서`, text, files: [file] };
      const canShareFiles = Boolean(navigator.share) && (!navigator.canShare || navigator.canShare(shareData));
      if (canShareFiles) {
        await navigator.share(shareData);
        markDelivery(batch.id, supplierName, "공유완료", { sentAt: nowIso(), method: supplier?.method || "공유" });
        pushActivity("도매처 발주 공유", `${batch.id} · ${supplierName} · ${items.length}건 공유 완료`);
      } else {
        saveBlob(blob, filename);
        try { await navigator.clipboard.writeText(text); } catch {}
        alert("이 브라우저는 파일 공유창을 지원하지 않아 도매처 전용 XLSX를 다운로드했습니다. 발주 메시지도 가능한 경우 클립보드에 복사했습니다.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        saveBlob(blob, filename);
        alert("공유창을 열지 못해 도매처 전용 발주서를 다운로드했습니다.");
      }
    } finally {
      setSharingKey("");
    }
  };

  const previewPurchase = () => {
    if (!selectedOrders.length) return alert("발주할 주문을 선택해주세요.");
    const grouped = selectedOrders.reduce((acc, o) => ((acc[o.supplier] ||= []).push(o), acc), {});
    const supplierText = Object.entries(grouped).map(([supplier, items]) => `${supplier}: ${items.length}건`).join("\n");
    const issueText = selectedIssues.length ? `\n\n⚠ 점검 필요 ${selectedIssues.length}건\n${selectedIssues.slice(0, 8).map((x) => `${x.id}: ${x.message}`).join("\n")}` : "\n\n✓ 사전 검증 통과";
    const senderWarning = (!settings.senderName || !settings.senderPhone || !settings.senderAddress) ? "\n\n※ 보내는 사람 정보가 일부 비어 있습니다." : "";
    alert(`${supplierText}${issueText}${senderWarning}`);
  };

  const createPurchaseZip = async () => {
    if (processing) return;
    const targets = selectedOrders;
    if (!targets.length) return alert("발주할 주문을 선택해주세요.");
    if (selectedIssues.length) return alert(`발주 전 검증에 실패했습니다.\n\n${selectedIssues.slice(0, 10).map((x) => `${x.id}: ${x.message}`).join("\n")}\n\n문제를 해결한 뒤 다시 시도해주세요.`);
    const safety=targets.filter(o=>Number(o.saleAmount||0)>=Number(settings.highValueThreshold||100000)||Number(o.qty||0)>=Number(settings.bulkQtyThreshold||5));
    if (safety.length && !window.confirm(`고가/다량 주문 ${safety.length}건이 포함돼 있습니다.\n${safety.map(o=>`${o.id} · ${money(o.saleAmount)} · ${o.qty}개`).slice(0,8).join("\n")}\n\n검토 후 계속할까요?`)) return;
    if (!window.confirm(`${targets.length}건을 도매처별 발주서로 생성하고 발주완료 상태로 바꿀까요?`)) return;

    setProcessing(true);
    const grouped = targets.reduce((acc, o) => ((acc[o.supplier] ||= []).push(o), acc), {});
    const zip = new JSZip();
    Object.entries(grouped).forEach(([supplierName, items]) => {
      const { array, filename } = makeSupplierFile(supplierName, items);
      zip.file(filename, array);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const batchId = uid("PO");
    saveBlob(zipBlob, `SellerFlow_${batchId}_도매처별_발주서.zip`);

    setOrders((prev) => prev.map((o) => selected.includes(o.id) ? { ...o, purchaseStatus: "발주완료", invoiceStatus: "송장대기", purchaseBatchId: batchId } : o));
    setInvoices((prev) => {
      const next = [...prev];
      targets.forEach((o) => { if (!next.some((r) => r.id === o.id)) next.push({ id: o.id, product: o.product, supplier: o.supplier, carrier: "", invoice: "", status: "송장대기", source: "도매처", updatedAt: nowIso() }); });
      return next;
    });
    const deliveries = Object.keys(grouped).reduce((acc, supplierName) => {
      const supplier = suppliers.find((s) => s.name === supplierName);
      acc[supplierName] = { status: "미전송", sentAt: "", method: supplier?.method || "수동" };
      return acc;
    }, {});
    setPurchaseBatches((prev) => [{ id: batchId, createdAt: nowIso(), orderIds: targets.map((o) => o.id), suppliers: Object.keys(grouped), status: "발주완료", deliveries }, ...prev]);
    pushActivity("발주서 생성", `${targets.length}건 · ${Object.keys(grouped).length}개 도매처 발주서 ZIP 생성`, { batchId });
    pushNotification("발주 완료", `${targets.length}건 발주서가 생성됐습니다. 도매처 전송센터에서 각 도매처 파일만 공유하세요.`, "발주 관리");
    setSelected([]);
    setProcessing(false);
  };

  const cancelBatch = (batch) => {
    const touched = invoices.some((row) => batch.orderIds.includes(row.id) && (row.carrier || row.invoice || row.status !== "송장대기"));
    if (touched) return alert("송장 입력 또는 등록이 진행된 주문이 포함되어 주문서 전체 취소가 불가능합니다.");
    if (!window.confirm(`${batch.id} 발주 묶음을 취소할까요?`)) return;
    setOrders((prev) => prev.map((o) => batch.orderIds.includes(o.id) ? { ...o, purchaseStatus: "발주대기", invoiceStatus: "송장대기", purchaseBatchId: null } : o));
    setInvoices((prev) => prev.filter((row) => !batch.orderIds.includes(row.id)));
    setPurchaseBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: "취소" } : b));
    pushActivity("발주 묶음 취소", `${batch.id} · ${batch.orderIds.length}건 복구`);
  };

  const deliveryRows = purchaseBatches.filter((b) => b.status === "발주완료").slice(0, 6).flatMap((batch) => (batch.suppliers || []).map((supplierName) => ({ batch, supplierName, items: batchSupplierOrders(batch, supplierName), info: deliveryInfo(batch, supplierName), supplier: suppliers.find((s) => s.name === supplierName) })));

  return (
    <>
      <PageHead title="발주 관리" description="도매처별 XLSX 생성 → ZIP 보관 → 각 도매처 전용 파일만 공유 → 전송상태 추적까지 한 번에 처리합니다." actions={<><button className="secondary" onClick={previewPurchase}>발주 전 미리보기</button><button className="primary" disabled={processing} onClick={createPurchaseZip}>{processing?"생성 중...":`검증 후 발주서 생성 (${selected.length})`}</button></>} />

      <div className={`preflight ${selectedIssues.length ? "danger" : "ok"}`}><div><b>발주 사전 검증</b><span>선택 {selectedOrders.length}건</span></div><strong>{selectedOrders.length === 0 ? "주문 선택 필요" : selectedIssues.length ? `${selectedIssues.length}개 문제 발견` : "검증 통과"}</strong></div>

      <div className="panel"><label className="checkLine"><input type="checkbox" checked={eligible.length > 0 && selected.length === eligible.length} onChange={toggleAll} /> 전체 선택 · 발주 가능한 주문만</label><div className="table"><table><thead><tr><th>선택</th><th>주문번호</th><th>상품</th><th>도매처</th><th>수량</th><th>검증</th><th>상태</th></tr></thead><tbody>
        {eligible.length === 0 ? <tr><td colSpan="7">발주 대기 주문이 없습니다.</td></tr> : eligible.map((o) => { const issues = validate(o); return <tr key={o.id}><td><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} /></td><td><b>{o.id}</b></td><td>{o.product}<small className="subText">{o.option}</small></td><td>{o.supplier}</td><td>{o.qty}</td><td>{issues.length ? <span className="severity danger">{issues.join(" · ")}</span> : <span className="okText">정상</span>}</td><td><Tag>{o.purchaseStatus}</Tag></td></tr>; })}
      </tbody></table></div></div>

      <div className="panel supplierDeliveryPanel"><div className="panelHead"><div><h2>도매처 전송센터</h2><p>ZIP 전체가 아니라 각 도매처의 전용 XLSX만 공유합니다. iPad/모바일에서는 공유 버튼으로 카카오톡 공유창을 바로 열 수 있습니다.</p></div></div>
        {deliveryRows.length === 0 ? <div className="emptyLine">발주서를 생성하면 도매처별 전송 작업이 여기에 나타납니다.</div> : <div className="table"><table><thead><tr><th>발주번호</th><th>도매처</th><th>주문수</th><th>전달방식</th><th>대상</th><th>전송상태</th><th>작업</th></tr></thead><tbody>{deliveryRows.map(({batch,supplierName,items,info,supplier}) => { const key=`${batch.id}-${supplierName}`; return <tr key={key}><td><b>{batch.id}</b><small className="subText">{new Date(batch.createdAt).toLocaleString("ko-KR")}</small></td><td><b>{supplierName}</b></td><td>{items.length}건</td><td>{supplier?.method || info.method || "수동"}</td><td>{supplier?.shareTarget || "미설정"}</td><td><span className={`deliveryStatus ${info.status === "공유완료" ? "sent" : "pending"}`}>{info.status || "미전송"}</span>{info.sentAt && <small className="subText">{new Date(info.sentAt).toLocaleString("ko-KR")}</small>}</td><td className="actions"><button className="primary" disabled={sharingKey===key} onClick={()=>shareSupplierFile(batch,supplierName)}>{sharingKey===key?"공유 중...":info.status==="공유완료"?"다시 공유":"공유"}</button><button className="secondary" onClick={()=>downloadSupplierFile(batch,supplierName)}>파일</button><button className="secondary" onClick={()=>copyShareMessage(batch,supplierName)}>메시지</button>{info.status!=="공유완료"&&<button className="secondary" onClick={()=>markDelivery(batch.id,supplierName,"공유완료",{sentAt:nowIso(),method:supplier?.method||"수동"})}>완료표시</button>}</td></tr>; })}</tbody></table></div>}
        <p className="securityNote">개인정보 보호를 위해 도매처에는 자기 주문이 들어간 XLSX만 공유하세요. 전체 ZIP을 카카오톡 방에 보내는 기능은 의도적으로 제공하지 않습니다.</p>
      </div>

      <div className="panel"><div className="panelHead"><div><h2>최근 발주 묶음</h2><p>송장 진행 전까지만 묶음 취소 가능</p></div></div><div className="table"><table><thead><tr><th>발주번호</th><th>시간</th><th>도매처</th><th>주문수</th><th>상태</th><th>작업</th></tr></thead><tbody>{purchaseBatches.length === 0 ? <tr><td colSpan="6">발주 기록이 없습니다.</td></tr> : purchaseBatches.slice(0, 10).map((b) => <tr key={b.id}><td><b>{b.id}</b></td><td>{new Date(b.createdAt).toLocaleString("ko-KR")}</td><td>{b.suppliers.join(", ")}</td><td>{b.orderIds.length}</td><td><Tag>{b.status}</Tag></td><td><button className="secondary" disabled={b.status !== "발주완료"} onClick={() => cancelBatch(b)}>주문서 취소</button></td></tr>)}</tbody></table></div></div>
    </>
  );
}

function InvoicePage({ orders, setOrders, invoices, setInvoices, suppliers, invoiceLogs, setInvoiceLogs, invoiceFilter, globalSearch, pushActivity, pushNotification, settings }) {
  const [selected, setSelected] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [inboxResults, setInboxResults] = useState([]);
  const [lastInboxAt, setLastInboxAt] = useState("");
  const fileRef = useRef(null);
  const q = (search || globalSearch).trim().toLowerCase();

  const duplicateInvoice = (invoiceNumber, excludeId = "") => {
    const value = String(invoiceNumber || "").trim();
    if (!value) return false;
    return invoices.some((r) => r.id !== excludeId && String(r.invoice || "").trim() === value);
  };

  const rowIssues = (row) => {
    const issues = [];
    if (row.invoice && !row.carrier) issues.push("택배사 누락");
    if (row.invoice && duplicateInvoice(row.invoice, row.id)) issues.push("중복 송장");
    return issues;
  };

  const rows = invoices.filter((row) => {
    if (invoiceFilter === "waiting" && row.status !== "송장대기") return false;
    if (invoiceFilter === "ready" && row.status !== "등록대기") return false;
    if (invoiceFilter === "done" && row.status !== "등록완료(테스트)") return false;
    if (supplierFilter !== "all" && row.supplier !== supplierFilter) return false;
    if (q && ![row.id, row.product, row.supplier, row.carrier, row.invoice].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

  const addLog = (type, row, message) => setInvoiceLogs((prev) => [{ id: uid("INVLOG"), time: nowIso(), orderId: row.id, type, message }, ...prev].slice(0, 200));
  const syncOrderStatus = (id, status) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, invoiceStatus: status } : o));
  const selectable = rows.filter((r) => r.carrier && r.invoice && r.status !== "등록완료(테스트)" && rowIssues(r).length === 0);
  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === selectable.length ? [] : selectable.map((r) => r.id));

  const edit = (row) => {
    if (row.status === "등록완료(테스트)") return alert("먼저 등록 취소를 해주세요.");
    const carrier = window.prompt("택배사를 입력하세요.", row.carrier || "");
    if (carrier === null) return;
    const invoice = window.prompt("운송장번호를 입력하세요.", row.invoice || "");
    if (invoice === null) return;
    if (!carrier.trim() || !invoice.trim()) return alert("택배사와 운송장번호를 모두 입력해주세요.");
    if (duplicateInvoice(invoice, row.id)) return alert("이미 다른 주문에 사용 중인 운송장번호입니다. 중복 등록을 차단했습니다.");
    setInvoices((prev) => prev.map((r) => r.id === row.id ? { ...r, carrier: carrier.trim(), invoice: invoice.trim(), status: "등록대기", updatedAt: nowIso() } : r));
    syncOrderStatus(row.id, "쿠팡 등록 가능");
    addLog("수기 송장 입력", row, `${carrier.trim()} / ${invoice.trim()}`);
  };

  const registerRows = (targets) => {
    if (processing) return;
    if (settings.apiOutage) return alert("API 장애모드입니다. 쿠팡 등록 작업을 중단했습니다.");
    const invalid = targets.filter((r) => rowIssues(r).length);
    if (invalid.length) return alert(`등록 전 검증 실패 ${invalid.length}건\n\n${invalid.slice(0, 8).map((r) => `${r.id}: ${rowIssues(r).join(", ")}`).join("\n")}`);
    const actual = targets.filter((r) => r.carrier && r.invoice && r.status !== "등록완료(테스트)");
    if (!actual.length) return alert("등록 가능한 송장이 없습니다.");
    if (!window.confirm(`${actual.length}건을 ${settings.systemMode === "테스트" ? "등록완료(테스트)" : "실운영 준비"} 상태로 전환할까요?\n\n※ 현재 파일에는 실제 WING API 전송 코드가 없어 외부 전송은 하지 않습니다.`)) return;
    setProcessing(true);
    setInvoices((prev) => prev.map((r) => actual.some((t) => t.id === r.id) ? { ...r, status: "등록완료(테스트)", updatedAt: nowIso() } : r));
    setOrders((prev) => prev.map((o) => actual.some((t) => t.id === o.id) ? { ...o, invoiceStatus: "등록완료(테스트)" } : o));
    actual.forEach((r) => addLog("쿠팡 등록 완료", r, `${r.carrier} / ${r.invoice} 등록 완료(테스트)`));
    pushActivity("송장 등록", `${actual.length}건 쿠팡 등록 완료(테스트)`);
    pushNotification("쿠팡 등록 완료", `${actual.length}건 송장 등록이 완료됐습니다.`, "운송장 관리");
    setSelected([]);
    setProcessing(false);
  };

  const cancelRegister = (row) => {
    if (row.status !== "등록완료(테스트)") return;
    if (!window.confirm(`${row.id} 등록완료 상태를 되돌릴까요?`)) return;
    setInvoices((prev) => prev.map((r) => r.id === row.id ? { ...r, status: r.invoice ? "등록대기" : "송장대기", updatedAt: nowIso() } : r));
    syncOrderStatus(row.id, row.invoice ? "쿠팡 등록 가능" : "송장대기");
    addLog("등록 취소", row, "등록완료 상태를 등록대기로 되돌렸습니다.");
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({ 주문번호: r.id, 택배사: r.carrier || "", 운송장번호: r.invoice || "" })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "송장입력");
    XLSX.writeFile(wb, "SellerFlow_송장입력_템플릿.xlsx");
  };

  const supplierFromFileName = (name) => {
    const normalized = normalizeHeader(name);
    return suppliers.find((supplier) => normalized.includes(normalizeHeader(supplier.name)))?.name || "";
  };

  const parseInboxFile = async (file) => {
    const rawRows = sheetRowsFromArrayBuffer(await file.arrayBuffer());
    const fileSupplier = supplierFromFileName(file.name);
    const supplierData = suppliers.find((s) => s.name === fileSupplier);
    const orderCandidates = [supplierData?.invoiceMapOrderId, ...suppliers.map((s) => s.invoiceMapOrderId), "주문번호", "orderid", "주문ID", "주문코드", "주문번호(쿠팡)"].filter(Boolean);
    const carrierCandidates = [supplierData?.invoiceMapCarrier, ...suppliers.map((s) => s.invoiceMapCarrier), "택배사", "택배사명", "carrier", "배송사"].filter(Boolean);
    const invoiceCandidates = [supplierData?.invoiceMapInvoice, ...suppliers.map((s) => s.invoiceMapInvoice), "운송장번호", "송장번호", "invoice", "trackingnumber", "운송장"].filter(Boolean);

    const entries = rawRows.map((row, index) => ({
      fileName: file.name,
      rowNo: index + 2,
      id: String(findCell(row, orderCandidates, 0)).trim(),
      carrier: String(findCell(row, carrierCandidates, 1)).trim(),
      invoice: String(findCell(row, invoiceCandidates, 2)).trim(),
    })).filter((r) => r.id || r.invoice || r.carrier);

    // 파일명에 도매처명이 명확히 들어간 경우에만 그 도매처를 강제 검증합니다.
    // 일반 파일은 각 행의 주문번호로 실제 도매처를 판단하므로 여러 도매처가 섞여 있어도 처리됩니다.
    const matchedSuppliers = [...new Set(entries.map((entry) => invoices.find((x) => x.id === entry.id)?.supplier).filter(Boolean))];
    const detectedSupplier = fileSupplier || (matchedSuppliers.length === 1 ? matchedSuppliers[0] : matchedSuppliers.length > 1 ? "혼합 파일" : "자동판별 실패");
    return { fileName: file.name, fileSupplier, detectedSupplier, entries };
  };

  const uploadInvoiceFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || processing) return;
    setProcessing(true);
    try {
      const parsedFiles = [];
      for (const file of files) parsedFiles.push(await parseInboxFile(file));
      const all = parsedFiles.flatMap((file) => file.entries.map((entry) => ({ ...entry, fileSupplier: file.fileSupplier, detectedSupplier: file.detectedSupplier })));
      const uploadInvoiceCounts = {};
      const uploadOrderCounts = {};
      all.forEach((r) => {
        if (r.invoice) uploadInvoiceCounts[r.invoice] = (uploadInvoiceCounts[r.invoice] || 0) + 1;
        if (r.id) uploadOrderCounts[r.id] = (uploadOrderCounts[r.id] || 0) + 1;
      });

      const resultByFile = new Map(parsedFiles.map((file) => [file.fileName, { fileName: file.fileName, supplier: file.detectedSupplier, total: file.entries.length, matched: 0, failed: 0, errors: [] }]));
      const valid = [];
      all.forEach((r) => {
        const result = resultByFile.get(r.fileName);
        const order = orders.find((x) => x.id === r.id);
        const target = invoices.find((x) => x.id === r.id);
        let error = "";
        if (!r.id) error = "주문번호 없음";
        else if (!order) error = "SellerFlow 주문번호 없음";
        else if (!target) error = `아직 송장대기 대상 아님(${order.purchaseStatus || "상태확인"})`;
        else if (!r.carrier || !r.invoice) error = "택배사/송장번호 누락";
        else if (uploadOrderCounts[r.id] > 1) error = "여러 파일에 같은 주문번호 중복";
        else if (uploadInvoiceCounts[r.invoice] > 1) error = "업로드 파일 사이 송장번호 중복";
        else if (duplicateInvoice(r.invoice, r.id)) error = "기존 데이터와 송장번호 중복";
        else if (r.fileSupplier && target.supplier && target.supplier !== r.fileSupplier) error = `파일명 도매처 불일치(${target.supplier})`;

        if (error) {
          result.failed += 1;
          if (result.errors.length < 6) result.errors.push(`${r.rowNo}행 ${r.id || "-"}: ${error}`);
        } else {
          result.matched += 1;
          valid.push(r);
        }
      });

      const validMap = new Map(valid.map((r) => [r.id, r]));
      setInvoices((prev) => prev.map((row) => {
        const found = validMap.get(row.id);
        return found ? { ...row, carrier: found.carrier, invoice: found.invoice, status: "등록대기", updatedAt: nowIso() } : row;
      }));
      setOrders((prev) => prev.map((o) => validMap.has(o.id) ? { ...o, invoiceStatus: "쿠팡 등록 가능" } : o));
      setSelected(valid.map((r) => r.id));
      setInboxResults(Array.from(resultByFile.values()));
      setLastInboxAt(nowIso());

      const failedCount = Array.from(resultByFile.values()).reduce((sum, item) => sum + item.failed, 0);
      if (failedCount) pushNotification("송장 수신함 점검", `${failedCount}건은 오류함에서 확인이 필요합니다.`, "운송장 관리", "danger");
      pushActivity("송장 수신함 자동 매칭", `${files.length}개 파일 · ${valid.length}건 자동 매칭 / ${failedCount}건 제외`);
      alert(`송장 수신함 처리 완료\n파일 ${files.length}개\n자동 매칭 ${valid.length}건\n확인 필요 ${failedCount}건\n\n정상 건은 자동으로 선택됐습니다.`);
    } catch (error) {
      console.error(error);
      alert("송장 파일을 읽는 중 오류가 발생했습니다. XLSX/XLS/CSV 파일인지 확인해주세요.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHead title="운송장 관리" description="여러 도매처 송장 파일을 한 번에 넣으면 도매처·컬럼·주문번호를 자동 판별해 정상 건만 매칭합니다." actions={<><button className="secondary" onClick={downloadTemplate}>송장 템플릿</button><label className="primary fileLabel">{processing ? "처리 중..." : "송장 파일 여러 개 불러오기"}<input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" disabled={processing} onChange={(e) => uploadInvoiceFiles(e.target.files)} /></label><button className="primary" disabled={!selected.length || processing} onClick={() => registerRows(invoices.filter((r) => selected.includes(r.id)))}>검증 후 일괄등록 ({selected.length})</button></>} />

      <div className="panel invoiceInbox">
        <div className="panelHead"><div><h2>송장 수신함</h2><p>카톡·메일로 받은 도매처 송장 파일을 여러 개 선택하면 한 번에 처리합니다. 수기 입력은 예외 수정용입니다.</p></div>{lastInboxAt && <span className="muted">최근 처리 {new Date(lastInboxAt).toLocaleString("ko-KR")}</span>}</div>
        {inboxResults.length === 0 ? <div className="inboxEmpty">여러 도매처의 XLSX/XLS/CSV를 한꺼번에 선택하세요.<br/><small>파일명이 도매처를 명시하면 검증하고, 일반 파일은 각 주문번호 기준으로 행별 도매처를 판별합니다. 여러 도매처가 한 파일에 섞여 있어도 처리됩니다.</small></div> : <div className="inboxGrid">{inboxResults.map((result) => <div className={`inboxCard ${result.failed ? "warning" : "ok"}`} key={result.fileName}><b>{result.fileName}</b><span>도매처 · {result.supplier}</span><div><strong>{result.matched}</strong> 자동매칭 <em>{result.failed} 확인필요</em></div>{result.errors.length > 0 && <ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</div>)}</div>}
        <p className="securityNote">정상 매칭 건은 자동으로 ‘쿠팡 등록 가능’으로 전환되고 일괄등록 대상으로 선택됩니다. 실제 WING API 연결 전에는 외부로 전송되지 않습니다.</p>
      </div>

      <div className="panel filterBar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="주문번호·상품·택배사·송장번호 검색" /><select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}><option value="all">전체 도매처</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
      <div className="panel"><div className="table"><table><thead><tr><th><input type="checkbox" checked={selectable.length > 0 && selected.length === selectable.length} onChange={toggleAll} /></th><th>주문번호</th><th>상품</th><th>도매처</th><th>택배사</th><th>운송장번호</th><th>검증</th><th>상태</th><th>관리</th></tr></thead><tbody>
        {rows.length === 0 ? <tr><td colSpan="9">조건에 맞는 운송장 주문이 없습니다.</td></tr> : rows.map((row) => { const issues = rowIssues(row); return <tr key={row.id}><td><input type="checkbox" disabled={!row.carrier || !row.invoice || row.status === "등록완료(테스트)" || issues.length > 0} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td><td><b>{row.id}</b><small className="subText">{row.source}</small></td><td>{row.product}</td><td>{row.supplier}</td><td>{row.carrier || "-"}</td><td>{row.invoice || "-"}</td><td>{issues.length ? <span className="severity danger">{issues.join(" · ")}</span> : <span className="okText">정상</span>}</td><td><Tag>{row.status}</Tag></td><td className="actions">{row.status === "등록완료(테스트)" ? <button className="secondary" onClick={() => cancelRegister(row)}>등록 취소</button> : <button className="secondary" disabled={!row.carrier || !row.invoice || issues.length > 0} onClick={() => registerRows([row])}>쿠팡 등록</button>}<button className="secondary" onClick={() => edit(row)} disabled={row.status === "등록완료(테스트)"}>수정</button></td></tr>; })}
      </tbody></table></div></div>
      <div className="panel"><div className="panelHead"><div><h2>운송장 처리 로그</h2><p>자동매칭·중복·실패·등록·취소 기록</p></div><button className="secondary" onClick={() => setInvoiceLogs([])}>로그 비우기</button></div><LogTable rows={invoiceLogs} /></div>
    </>
  );
}

function MarketingPage({ orders, setOrders, invoices, setInvoices, marketingLogs, setMarketingLogs, pushActivity, pushNotification }) {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const listRef = useRef(null);
  const invoiceRef = useRef(null);
  const marketingOrders = orders.filter((o) => o.marketing);

  const addLog = (type, message) => setMarketingLogs((prev) => [{ id: uid("MKT"), time: nowIso(), type, message }, ...prev].slice(0, 150));

  const parseList = async (file) => {
    if (!file) return;
    const rows = sheetRowsFromArrayBuffer(await file.arrayBuffer());
    const ids = rows.map((row) => String(findCell(row, ["주문번호", "orderid", "주문ID"], 0)).trim()).filter(Boolean);
    const matched = orders.filter((o) => ids.includes(o.id));
    setCandidates(matched);
    setSelected(matched.map((o) => o.id));
    addLog("명단 매칭", `${matched.length}건 매칭 / ${Math.max(0, ids.length - matched.length)}건 미매칭`);
    if (listRef.current) listRef.current.value = "";
  };

  const confirmMarketing = () => {
    if (!selected.length) return alert("확정할 주문을 선택해주세요.");
    setOrders((prev) => prev.map((o) => selected.includes(o.id) ? { ...o, marketing: true, purchaseStatus: "마케팅 처리", invoiceStatus: "마케팅 송장 대기" } : o));
    setInvoices((prev) => prev.filter((r) => !selected.includes(r.id)));
    addLog("마케팅 확정", `${selected.length}건을 마케팅 주문으로 분류`);
    pushActivity("마케팅 주문 분류", `${selected.length}건 일반 발주에서 제외`);
    pushNotification("마케팅 분류 완료", `${selected.length}건이 마케팅 주문으로 분류됐습니다.`, "마케팅 주문");
    setCandidates([]); setSelected([]);
  };

  const releaseMarketing = (id) => {
    const order = orders.find((o) => o.id === id); if (!order) return;
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, marketing: false, purchaseStatus: o.supplier === "미연결" ? "도매처 연결 필요" : "발주대기", invoiceStatus: "송장대기" } : o));
    setInvoices((prev) => prev.filter((r) => r.id !== id));
    addLog("마케팅 해제", `${id} 일반 주문으로 복구`);
  };

  const uploadMarketingInvoices = async (file) => {
    if (!file) return;
    const imported = sheetRowsFromArrayBuffer(await file.arrayBuffer()).map((row) => ({
      id: String(findCell(row, ["주문번호", "orderid"], 0)).trim(),
      carrier: String(findCell(row, ["택배사", "carrier"], 1)).trim(),
      invoice: String(findCell(row, ["운송장번호", "송장번호", "invoice"], 2)).trim(),
    })).filter((r) => r.id);
    const valid = imported.filter((r) => marketingOrders.some((o) => o.id === r.id));
    setInvoices((prev) => {
      const next = [...prev.filter((r) => !valid.some((v) => v.id === r.id))];
      valid.forEach((v) => {
        const o = orders.find((x) => x.id === v.id);
        next.push({ id: v.id, product: o?.product || "", supplier: "마케팅", carrier: v.carrier, invoice: v.invoice, status: v.invoice ? "등록대기" : "송장대기", source: "마케팅", updatedAt: nowIso() });
      });
      return next;
    });
    setOrders((prev) => prev.map((o) => valid.some((v) => v.id === o.id) ? { ...o, invoiceStatus: valid.find((v) => v.id === o.id)?.invoice ? "쿠팡 등록 가능" : "마케팅 송장 대기" } : o));
    addLog("마케팅 송장 매칭", `${valid.length}건 매칭`);
    pushNotification("마케팅 송장 준비", `${valid.length}건이 쿠팡 등록 가능한 상태로 전환됐습니다.`, "운송장 관리");
    if (invoiceRef.current) invoiceRef.current.value = "";
  };

  return (
    <>
      <PageHead title="마케팅 주문" description="명단 매칭 → 일반 도매처 발주 제외 → 마케팅 송장 매칭 → 운송장 관리 전달 흐름입니다." actions={<><label className="secondary fileLabel">명단 업로드<input ref={listRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => parseList(e.target.files?.[0])} /></label><label className="primary fileLabel">마케팅 송장 업로드<input ref={invoiceRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => uploadMarketingInvoices(e.target.files?.[0])} /></label></>} />
      {candidates.length > 0 && <div className="panel"><div className="panelHead"><div><h2>명단 매칭 미리보기</h2><p>확정 전 주문을 확인합니다.</p></div><button className="primary" onClick={confirmMarketing}>선택 마케팅 확정 ({selected.length})</button></div><div className="table"><table><thead><tr><th>선택</th><th>주문번호</th><th>고객</th><th>상품</th><th>현재 발주상태</th></tr></thead><tbody>{candidates.map((o) => <tr key={o.id}><td><input type="checkbox" checked={selected.includes(o.id)} onChange={() => setSelected((prev) => prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id])} /></td><td><b>{o.id}</b></td><td>{o.customer}</td><td>{o.product}</td><td><Tag>{o.purchaseStatus}</Tag></td></tr>)}</tbody></table></div></div>}
      <div className="panel"><div className="panelHead"><div><h2>마케팅 주문</h2><p>일반 발주에서 자동 제외됩니다.</p></div></div><div className="table"><table><thead><tr><th>주문번호</th><th>고객</th><th>상품</th><th>발주상태</th><th>송장상태</th><th>작업</th></tr></thead><tbody>{marketingOrders.length === 0 ? <tr><td colSpan="6">마케팅 주문이 없습니다.</td></tr> : marketingOrders.map((o) => <tr key={o.id}><td><b>{o.id}</b></td><td>{o.customer}</td><td>{o.product}</td><td><Tag>{o.purchaseStatus}</Tag></td><td><Tag>{o.invoiceStatus}</Tag></td><td><button className="secondary" onClick={() => releaseMarketing(o.id)}>마케팅 해제</button></td></tr>)}</tbody></table></div></div>
      <div className="panel"><div className="panelHead"><div><h2>마케팅 처리 로그</h2></div></div><LogTable rows={marketingLogs} /></div>
    </>
  );
}

function SupplierPage({ suppliers, setSuppliers, products }) {
  const emptyForm={name:"",contact:"",method:"카카오톡",shareTarget:"",orderShareMessage:"{도매처} 발주서입니다. 발주번호 {발주번호}, 총 {주문수}건입니다. 출고 후 송장 파일 회신 부탁드립니다.",orderDeadline:"17:00",invoiceDeadline:"19:00",orderColumns:"주문번호,주문일,수취인,상품명,옵션,수량,주소",invoiceColumns:"주문번호,택배사,운송장번호",defectAction:"환불",wrongAction:"재배송",damageAction:"재배송",returnShippingPayer:"도매처",responseDeadlineHours:24,active:true,minOrderQty:1,minOrderAmount:0,holidays:"",shipLeadDays:1,deliveryLeadDays:2,orderFileName:"{도매처}_{날짜}_발주서",orderSheetName:"발주서",invoiceMapOrderId:"주문번호",invoiceMapCarrier:"택배사",invoiceMapInvoice:"운송장번호"};
  const [form,setForm]=useState(emptyForm); const [editingId,setEditingId]=useState(null); const [showForm,setShowForm]=useState(false);
  const save=()=>{if(!form.name.trim())return alert("도매처명 입력"); if(editingId)setSuppliers(p=>p.map(s=>s.id===editingId?{...s,...form,name:form.name.trim()}:s));else setSuppliers(p=>[...p,{...form,id:Date.now(),name:form.name.trim()}]);setForm(emptyForm);setEditingId(null);setShowForm(false)};
  const edit=s=>{setForm({...emptyForm,...s});setEditingId(s.id);setShowForm(true);window.scrollTo({top:0,behavior:"smooth"})};
  return <><PageHead title="도매처 관리" description="발주 전달대상·메시지·마감·휴무·발주/송장 양식·CS 규정을 도매처별로 저장합니다." actions={<button className="primary" onClick={()=>{setForm(emptyForm);setEditingId(null);setShowForm(true)}}>+ 도매처 추가</button>}/>
  {showForm&&<div className="panel"><h2>{editingId?"도매처 수정":"도매처 추가"}</h2><div className="formGrid"><Field label="도매처명"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="연락처"><input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></Field><Field label="발주 방식"><select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}><option>카카오톡</option><option>문자</option><option>이메일</option><option>기타</option></select></Field><Field label="발주 전달 대상/채팅방"><input value={form.shareTarget||""} placeholder="예: A농장 오픈채팅" onChange={e=>setForm({...form,shareTarget:e.target.value})}/></Field><Field label="발주 공유 메시지" wide><input value={form.orderShareMessage||""} onChange={e=>setForm({...form,orderShareMessage:e.target.value})} placeholder="{도매처} {발주번호} {주문수} 사용 가능"/></Field><Field label="발주 마감"><input type="time" value={form.orderDeadline} onChange={e=>setForm({...form,orderDeadline:e.target.value})}/></Field><Field label="송장 마감"><input type="time" value={form.invoiceDeadline} onChange={e=>setForm({...form,invoiceDeadline:e.target.value})}/></Field><Field label="회신 제한(시간)"><input type="number" value={form.responseDeadlineHours} onChange={e=>setForm({...form,responseDeadlineHours:Number(e.target.value)})}/></Field><Field label="최소 발주 수량"><input type="number" min="1" value={form.minOrderQty} onChange={e=>setForm({...form,minOrderQty:Number(e.target.value)})}/></Field><Field label="최소 발주 금액"><input type="number" min="0" value={form.minOrderAmount} onChange={e=>setForm({...form,minOrderAmount:Number(e.target.value)})}/></Field><Field label="휴무일(YYYY-MM-DD, 쉼표구분)"><input value={form.holidays||""} onChange={e=>setForm({...form,holidays:e.target.value})}/></Field><Field label="출고 리드타임(일)"><input type="number" min="0" value={form.shipLeadDays} onChange={e=>setForm({...form,shipLeadDays:Number(e.target.value)})}/></Field><Field label="배송 리드타임(일)"><input type="number" min="0" value={form.deliveryLeadDays} onChange={e=>setForm({...form,deliveryLeadDays:Number(e.target.value)})}/></Field><Field label="발주 파일명"><input value={form.orderFileName} onChange={e=>setForm({...form,orderFileName:e.target.value})}/></Field><Field label="발주 시트명"><input value={form.orderSheetName} onChange={e=>setForm({...form,orderSheetName:e.target.value})}/></Field><Field label="발주서 컬럼" wide><input value={form.orderColumns} onChange={e=>setForm({...form,orderColumns:e.target.value})}/></Field><Field label="송장 컬럼" wide><input value={form.invoiceColumns} onChange={e=>setForm({...form,invoiceColumns:e.target.value})}/></Field><Field label="송장 주문번호 컬럼"><input value={form.invoiceMapOrderId} onChange={e=>setForm({...form,invoiceMapOrderId:e.target.value})}/></Field><Field label="송장 택배사 컬럼"><input value={form.invoiceMapCarrier} onChange={e=>setForm({...form,invoiceMapCarrier:e.target.value})}/></Field><Field label="송장번호 컬럼"><input value={form.invoiceMapInvoice} onChange={e=>setForm({...form,invoiceMapInvoice:e.target.value})}/></Field><Field label="품질 기본"><select value={form.defectAction} onChange={e=>setForm({...form,defectAction:e.target.value})}><option>환불</option><option>재배송</option><option>수동</option></select></Field><Field label="오배송 기본"><select value={form.wrongAction} onChange={e=>setForm({...form,wrongAction:e.target.value})}><option>환불</option><option>재배송</option><option>수동</option></select></Field><Field label="파손 기본"><select value={form.damageAction} onChange={e=>setForm({...form,damageAction:e.target.value})}><option>환불</option><option>재배송</option><option>수동</option></select></Field><Field label="반품 배송비"><select value={form.returnShippingPayer} onChange={e=>setForm({...form,returnShippingPayer:e.target.value})}><option>도매처</option><option>판매자</option><option>고객</option></select></Field></div><div className="formActions"><button className="secondary" onClick={()=>setShowForm(false)}>취소</button><button className="primary" onClick={save}>저장</button></div></div>}
  <div className="panel"><div className="table"><table><thead><tr><th>도매처</th><th>발주 전달</th><th>마감</th><th>최소발주</th><th>예상일정</th><th>연결상품</th><th>양식</th><th>상태</th><th>관리</th></tr></thead><tbody>{suppliers.map(s=><tr key={s.id}><td><b>{s.name}</b><small className="subText">{s.contact}</small></td><td>{s.method}<small className="subText">{s.shareTarget||"대상 미설정"}</small></td><td>발주 {s.orderDeadline}<small className="subText">송장 {s.invoiceDeadline}</small></td><td>{s.minOrderQty||1}개<small className="subText">{money(s.minOrderAmount||0)}</small></td><td>출고 +{s.shipLeadDays||1}일<small className="subText">도착 +{(s.shipLeadDays||1)+(s.deliveryLeadDays||2)}일</small></td><td>{products.filter(p=>p.supplier===s.name||p.alternateSupplier===s.name).length}개</td><td>{s.orderSheetName||"발주서"}<small className="subText">{s.orderFileName}</small></td><td><Tag>{s.active?"사용중":"중지"}</Tag></td><td className="actions"><button className="secondary" onClick={()=>edit(s)}>수정</button><button className="secondary" onClick={()=>setSuppliers(p=>p.map(x=>x.id===s.id?{...x,active:!x.active}:x))}>{s.active?"중지":"사용"}</button></td></tr>)}</tbody></table></div></div></>;
}

function ProductLinkPage({ products, setProducts, suppliers, productFilter }) {
  const [search,setSearch]=useState(""); const [selectedId,setSelectedId]=useState(null); const activeSuppliers=suppliers.filter(s=>s.active); const rows=products.filter(p=>(productFilter!=="unlinked"||!p.supplier)&&(!search||[p.name,p.option,p.supplier,p.alternateSupplier,p.vendorProductName].join(" ").toLowerCase().includes(search.toLowerCase()))); const update=(id,patch)=>setProducts(p=>p.map(x=>x.id===id?{...x,...patch}:x)); const chosen=products.find(p=>p.id===selectedId);
  const changeCost=(p)=>{const next=prompt("새 원가",String(p.cost||0));if(next===null)return;const n=Number(next);if(!Number.isFinite(n)||n<0)return alert("숫자 입력");const history=[{time:nowIso(),cost:n,previous:Number(p.cost||0)},...(p.costHistory||[])].slice(0,20);update(p.id,{cost:n,costHistory:history});};
  const toggleStock=(p)=>{const stockout=!p.stockout;update(p.id,{stockout,stockoutHistory:[{time:nowIso(),stockout},...(p.stockoutHistory||[])].slice(0,20)});};
  const recommend=(p)=>{const candidates=activeSuppliers.filter(s=>s.name!==p.supplier);if(!candidates.length)return alert("추천 가능한 다른 도매처가 없습니다.");const scored=candidates.map(s=>({s,count:products.filter(x=>x.supplier===s.name).length})).sort((a,b)=>a.count-b.count);update(p.id,{alternateSupplier:scored[0].s.name});alert(`대체 도매처 후보로 ${scored[0].s.name}을 저장했습니다. 최종 연결은 직접 확인해주세요.`);};
  return <><PageHead title="상품 연결" description="주/대체 도매처·자동화 규칙·품절·원가 변경 이력·연결 추천을 관리합니다."/><div className="panel filterBar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="상품·옵션·도매처 검색"/><span className="muted">미연결 {products.filter(p=>p.active!==false&&!p.supplier).length} · 품절 {products.filter(p=>p.stockout).length}</span></div><div className="panel"><div className="table"><table><thead><tr><th>상품</th><th>옵션</th><th>판매가</th><th>원가</th><th>배송비</th><th>수수료</th><th>주 도매처</th><th>대체 도매처</th><th>자동화 규칙</th><th>재고</th><th>상태</th><th>관리</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><b>{p.name}</b><small className="subText">{p.vendorProductName||"도매처 상품명 미입력"}</small></td><td>{p.option}</td><td>{money(p.price)}</td><td>{money(p.cost)}<button className="linkButton" onClick={()=>changeCost(p)}>변경</button></td><td><input className="smallInput" type="number" value={p.shippingCost??0} onChange={e=>update(p.id,{shippingCost:Number(e.target.value||0)})}/></td><td><input className="tinyInput" type="number" value={p.feeRate??10} onChange={e=>update(p.id,{feeRate:Number(e.target.value||0)})}/>%</td><td><select value={p.supplier||""} onChange={e=>update(p.id,{supplier:e.target.value})}><option value="">도매처 선택</option>{activeSuppliers.map(s=><option key={s.id}>{s.name}</option>)}</select></td><td><select value={p.alternateSupplier||""} onChange={e=>update(p.id,{alternateSupplier:e.target.value})}><option value="">없음</option>{activeSuppliers.filter(s=>s.name!==p.supplier).map(s=><option key={s.id}>{s.name}</option>)}</select></td><td><select value={p.automationMode||"자동"} onChange={e=>update(p.id,{automationMode:e.target.value})}><option>자동</option><option>수동검토</option></select></td><td><button className={p.stockout?"dangerButton":"secondary"} onClick={()=>toggleStock(p)}>{p.stockout?"품절":"판매가능"}</button></td><td><Tag>{p.active===false?"자동화 중지":p.stockout?"품절":p.supplier?"연결완료":"미연결"}</Tag></td><td className="actions"><button className="secondary" onClick={()=>recommend(p)}>연결 추천</button><button className="secondary" onClick={()=>setSelectedId(p.id)}>이력</button><button className="secondary" onClick={()=>update(p.id,{active:p.active===false})}>{p.active===false?"자동화 켜기":"자동화 끄기"}</button></td></tr>)}</tbody></table></div></div>{chosen&&<div className="panel"><div className="panelHead"><div><h2>{chosen.name} 변경 이력</h2></div><button className="secondary" onClick={()=>setSelectedId(null)}>닫기</button></div><div className="operationsGrid"><div><h3>원가 이력</h3>{(chosen.costHistory||[]).length?(chosen.costHistory||[]).map((h,i)=><p key={i} className="historyRow">{new Date(h.time).toLocaleString("ko-KR")} · {money(h.previous)} → <b>{money(h.cost)}</b></p>):<p className="muted">이력 없음</p>}</div><div><h3>품절 이력</h3>{(chosen.stockoutHistory||[]).length?(chosen.stockoutHistory||[]).map((h,i)=><p key={i} className="historyRow">{new Date(h.time).toLocaleString("ko-KR")} · {h.stockout?"품절":"판매 재개"}</p>):<p className="muted">이력 없음</p>}</div></div></div>}<p className="securityNote">연결 추천은 자동 확정하지 않습니다. 도매처 상품 규격/원가/재고를 직접 확인한 뒤 주 도매처로 지정하세요.</p></>;
}

function CSPage({ orders, suppliers, invoices, inquiries, setInquiries, returnCases, setReturnCases, csLogs, setCsLogs, pushActivity, pushNotification }) {
  const [range, setRange] = useState(7);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const selectedCase = returnCases.find((c) => c.id === selectedCaseId);
  const within = (iso) => daysAgo(iso) < range;
  const rangeInquiries = inquiries.filter((q) => within(q.createdAt));
  const rangeCases = returnCases.filter((c) => within(c.createdAt));
  const stats = { inquiry: rangeInquiries.length, return: rangeCases.filter((c) => c.caseType === "반품").length, cancel: rangeCases.filter((c) => c.caseType === "취소").length, pending: rangeCases.filter((c) => !c.processed).length };

  const log = (type, target, message) => setCsLogs((prev) => [{ id: uid("CSLOG"), time: nowIso(), caseId: target.id, orderId: target.orderId, type, message }, ...prev].slice(0, 250));
  const orderFor = (id) => orders.find((o) => o.id === id);
  const supplierFor = (caseItem) => suppliers.find((s) => s.name === (caseItem.supplier || orderFor(caseItem.orderId)?.supplier));

  const reply = (item) => {
    if (item.status === "답변완료") return alert("이미 답변한 문의입니다.");
    const answer = window.prompt("고객에게 보낼 답변을 입력하세요.", item.answer || "");
    if (answer === null || !answer.trim()) return;
    setInquiries((prev) => prev.map((q) => q.id === item.id ? { ...q, answer: answer.trim(), status: "답변완료" } : q));
    log("고객문의 답변", item, answer.trim());
    pushActivity("CS 답변", `${item.id} 답변완료`);
  };

  const handleCase = (item) => {
    if (item.processed) return alert("이미 처리된 건입니다.");
    const order = orderFor(item.orderId);
    const invoice = invoices.find((r) => r.id === item.orderId);
    const shipped = invoice?.status === "등록완료(테스트)" || Boolean(invoice?.invoice) || order?.invoiceStatus === "등록완료(테스트)";

    if (item.reason === "단순변심") {
      const status = shipped ? "회수없이 환불완료(테스트)" : "출고중지·환불완료(테스트)";
      setReturnCases((prev) => prev.map((c) => c.id === item.id ? { ...c, shipped, processed: true, resolution: "환불", status } : c));
      log("자동처리 완료", item, status);
      pushActivity("CS 자동처리", `${item.id} · ${status}`);
      return;
    }

    const supplier = supplierFor(item);
    if (!supplier) return alert("도매처 연결이 필요합니다.");
    const evidence = window.prompt("증빙/상황을 입력하세요.", item.evidence || "");
    if (evidence === null || !evidence.trim()) return alert("품질·오배송·파손·사기의심은 증빙이 필요합니다.");
    const reviewNote = window.prompt("검토 메모를 입력하세요.", item.reviewNote || "");
    if (reviewNote === null) return;
    const defaultResolution = item.reason === "품질문제" ? supplier.defectAction : item.reason === "오배송" ? supplier.wrongAction : item.reason === "파손" ? supplier.damageAction : "수동";
    const resolution = window.prompt("처리 결과를 입력하세요. (환불/재배송/수동)", defaultResolution);
    if (resolution === null || !resolution.trim()) return;

    setReturnCases((prev) => prev.map((c) => c.id === item.id ? { ...c, shipped, supplier: supplier.name, evidence: evidence.trim(), reviewNote: reviewNote.trim(), resolution: resolution.trim(), status: `${supplier.name} 확인대기 · ${resolution.trim()}` } : c));
    log("수동검토 시작", item, `${supplier.name} · ${resolution.trim()} 요청`);
    pushNotification("CS 수동검토", `${item.id} ${item.reason} 건이 ${supplier.name} 확인대기 상태입니다.`, "CS 관리", "danger");
  };

  const completeManual = (item) => {
    if (item.processed) return;
    const replyText = window.prompt("도매처 회신 내용을 입력하세요.", item.supplierReply || "");
    if (replyText === null || !replyText.trim()) return;
    if (!window.confirm(`${item.resolution || "처리"} 완료로 확정할까요?`)) return;
    setReturnCases((prev) => prev.map((c) => c.id === item.id ? { ...c, supplierReply: replyText.trim(), supplierReplyAt: nowIso(), processed: true, status: `${item.resolution || "처리"}완료(테스트)` } : c));
    log("도매처 회신", item, replyText.trim());
    log("처리 완료", item, `${item.resolution || "처리"}완료(테스트)`);
  };

  const addImages = async (item, files) => {
    const images = await Promise.all(Array.from(files || []).slice(0, 3).map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); })));
    setReturnCases((prev) => prev.map((c) => c.id === item.id ? { ...c, evidenceImages: [...(c.evidenceImages || []), ...images].slice(0, 5) } : c));
  };

  return (
    <>
      <PageHead title="CS 관리" description="문의·반품·취소를 기간별로 집계하고, 단순변심만 자동 처리합니다." actions={<div className="tabs">{[1, 7, 15, 30].map((n) => <button key={n} className={range === n ? "on" : ""} onClick={() => setRange(n)}>{n === 1 ? "오늘" : `${n}일`}</button>)}</div>} />
      <div className="cards"><MiniStat title="문의" value={stats.inquiry} /><MiniStat title="반품" value={stats.return} /><MiniStat title="취소" value={stats.cancel} /><MiniStat title="처리대기" value={stats.pending} /></div>
      <div className="panel"><div className="panelHead"><div><h2>고객 문의</h2><p>마감 임박 순</p></div></div><div className="table"><table><thead><tr><th>문의</th><th>주문</th><th>상품</th><th>내용</th><th>마감</th><th>상태</th><th>작업</th></tr></thead><tbody>{[...rangeInquiries].sort((a, b) => (a.deadline === "오늘" ? -1 : 1) - (b.deadline === "오늘" ? -1 : 1)).map((q) => <tr key={q.id}><td><b>{q.id}</b></td><td>{q.orderId}</td><td>{q.product}</td><td>{q.content}<small className="subText">{q.answer && `답변: ${q.answer}`}</small></td><td>{q.deadline}{q.deadline === "오늘" && q.status !== "답변완료" && <span className="dangerText"> 마감 임박</span>}</td><td><Tag>{q.status}</Tag></td><td><button className="secondary" onClick={() => reply(q)} disabled={q.status === "답변완료"}>{q.status === "답변완료" ? "답변완료" : "답변"}</button></td></tr>)}</tbody></table></div></div>
      <div className="panel"><div className="panelHead"><div><h2>반품·취소</h2><p>단순변심 자동 / 품질·오배송·파손·사기의심 수동</p></div></div><div className="table"><table><thead><tr><th>접수</th><th>종류</th><th>주문</th><th>사유</th><th>도매처</th><th>출고</th><th>상태</th><th>작업</th></tr></thead><tbody>{rangeCases.map((item) => <tr key={item.id}><td><b>{item.id}</b></td><td>{item.caseType}</td><td>{item.orderId}</td><td>{item.reason}</td><td>{item.supplier || orderFor(item.orderId)?.supplier || "-"}</td><td>{item.shipped ? "출고됨" : "출고 전"}</td><td><Tag>{item.status}</Tag></td><td className="actions"><button className="secondary" disabled={item.processed} onClick={() => item.reason === "단순변심" ? handleCase(item) : item.resolution ? completeManual(item) : handleCase(item)}>{item.processed ? "처리완료" : item.reason === "단순변심" ? "자동처리" : item.resolution ? `${item.resolution} 완료처리` : "수동검토"}</button><button className="secondary" onClick={() => setSelectedCaseId(item.id)}>상세보기</button></td></tr>)}</tbody></table></div></div>
      {selectedCase && <div className="panel"><div className="panelHead"><div><h2>CS 상세보기</h2><p>{selectedCase.id} · {selectedCase.orderId}</p></div><button className="secondary" onClick={() => setSelectedCaseId(null)}>닫기</button></div><div className="detailGrid"><Detail label="상품" value={selectedCase.product} /><Detail label="고객" value={selectedCase.customer} /><Detail label="사유" value={selectedCase.reason} /><Detail label="도매처" value={selectedCase.supplier || orderFor(selectedCase.orderId)?.supplier || "-"} /><Detail label="검토 메모" value={selectedCase.reviewNote || "없음"} /><Detail label="도매처 회신" value={selectedCase.supplierReply || "대기"} /><Detail label="처리 결과" value={selectedCase.resolution || "미정"} /><Detail label="배송비 부담" value={supplierFor(selectedCase)?.returnShippingPayer || "미정"} /></div><div className="evidenceBlock"><b>증빙 내용</b><p>{selectedCase.evidence || "등록된 증빙이 없습니다."}</p><label className="secondary fileLabel">사진 추가<input type="file" accept="image/*" multiple onChange={(e) => addImages(selectedCase, e.target.files)} /></label><div className="imageRow">{(selectedCase.evidenceImages || []).map((src, index) => <div key={index} className="imageThumb"><img src={src} alt={`증빙 ${index + 1}`} /><button onClick={() => setReturnCases((prev) => prev.map((c) => c.id === selectedCase.id ? { ...c, evidenceImages: c.evidenceImages.filter((_, i) => i !== index) } : c))}>×</button></div>)}</div></div></div>}
      <div className="panel"><div className="panelHead"><div><h2>CS 처리 로그</h2></div><button className="secondary" onClick={() => setCsLogs([])}>로그 비우기</button></div><LogTable rows={csLogs} /></div>
    </>
  );
}

function SettingsPage({ settings,setSettings,orders,products,suppliers,invoices,purchaseBatches,inquiries,returnCases,csLogs,invoiceLogs,activityLogs,notifications,marketingLogs,setOrders,setProducts,setSuppliers,setInvoices,setPurchaseBatches,setInquiries,setReturnCases,setCsLogs,setInvoiceLogs,setActivityLogs,setNotifications,setMarketingLogs,pushNotification,autoBackups,setAutoBackups,undoStack,undoLast }) {
  const restoreRef=useRef(null); const requestNotifications=async()=>{if(!("Notification" in window))return alert("알림 미지원");const permission=await Notification.requestPermission();setSettings(p=>({...p,browserNotifications:permission==="granted"}));};
  const payload=()=>({version:DATA_VERSION,exportedAt:nowIso(),orders,products,suppliers,invoices,purchaseBatches,inquiries,returnCases,csLogs,invoiceLogs,activityLogs,notifications,marketingLogs,settings});
  const backup=()=>saveBlob(new Blob([JSON.stringify(payload(),null,2)],{type:"application/json"}),`SellerFlow_backup_${new Date().toISOString().slice(0,10)}.json`);
  const restore=async file=>{if(!file)return;try{const d=JSON.parse(await file.text());if(!d.orders||!d.products||!d.suppliers)throw new Error();setOrders(d.orders);setProducts(d.products);setSuppliers(d.suppliers);setInvoices(d.invoices||[]);setPurchaseBatches(d.purchaseBatches||[]);setInquiries(d.inquiries||[]);setReturnCases(d.returnCases||[]);setCsLogs(d.csLogs||[]);setInvoiceLogs(d.invoiceLogs||[]);setActivityLogs(d.activityLogs||[]);setNotifications(d.notifications||[]);setMarketingLogs(d.marketingLogs||[]);setSettings({...defaultSettings,...(d.settings||{}),dataVersion:DATA_VERSION});alert("백업 복원 완료")}catch{alert("SellerFlow 백업 파일이 아닙니다.")} if(restoreRef.current)restoreRef.current.value=""};
  const integrityCheck=()=>{const issues=[];orders.forEach(o=>{if(!products.some(p=>p.name===o.product))issues.push(`${o.id}: 상품 데이터 없음`);if(o.purchaseStatus==="발주완료"&&!o.marketing&&!invoices.some(r=>r.id===o.id))issues.push(`${o.id}: 운송장 행 없음`);if(o.supplier!=="미연결"&&!suppliers.some(s=>s.name===o.supplier))issues.push(`${o.id}: 없는 도매처 ${o.supplier}`)});const dup={};invoices.forEach(r=>{if(r.invoice)dup[r.invoice]=(dup[r.invoice]||0)+1});Object.entries(dup).filter(([,n])=>n>1).forEach(([x])=>issues.push(`중복 송장 ${x}`));alert(issues.length?`점검 ${issues.length}건\n\n${issues.slice(0,15).join("\n")}`:"데이터 무결성 이상 없음")};
  const restoreAuto=s=>{if(!confirm("이 자동 백업 시점으로 복구할까요?"))return;const d=s.data;setOrders(d.orders||[]);setProducts(d.products||[]);setSuppliers(d.suppliers||[]);setInvoices(d.invoices||[]);setPurchaseBatches(d.purchaseBatches||[]);setInquiries(d.inquiries||[]);setReturnCases(d.returnCases||[]);setCsLogs(d.csLogs||[]);setInvoiceLogs(d.invoiceLogs||[]);setActivityLogs(d.activityLogs||[]);setNotifications(d.notifications||[]);setMarketingLogs(d.marketingLogs||[]);setSettings({...defaultSettings,...(d.settings||{}),dataVersion:DATA_VERSION});alert("자동 백업 복구 완료")};
  return <><PageHead title="설정" description="테마·역할·운영모드·API 상태·안전장치·개인정보·백업·알림을 관리합니다."/>
  <div className="panel"><h2>운영 모드 / 권한</h2><div className="formGrid"><Field label="현재 역할"><select value={settings.currentRole} onChange={e=>setSettings({...settings,currentRole:e.target.value})}><option>관리자</option><option>발주 담당</option><option>CS 담당</option><option>조회 전용</option></select></Field><Field label="시스템 모드"><select value={settings.systemMode} onChange={e=>setSettings({...settings,systemMode:e.target.value})}><option>테스트</option><option>실운영 준비</option></select></Field><Field label="화면 테마"><select value={settings.theme || "system"} onChange={e=>setSettings({...settings,theme:e.target.value})}><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></Field><Field label="API 상태"><input readOnly value={settings.apiOutage?"장애모드":settings.wingStatus||"미연결"}/></Field><Field label="마지막 동기화"><input readOnly value={settings.apiLastSyncAt?new Date(settings.apiLastSyncAt).toLocaleString("ko-KR"):"아직 없음"}/></Field><Field label="API 성공률"><input readOnly value={`${Number(settings.apiSuccessRate||0)}%`}/></Field><Field label="자동 재시도 횟수"><input type="number" min="0" max="5" value={settings.retryLimit} onChange={e=>setSettings({...settings,retryLimit:Number(e.target.value)})}/></Field><Field label="고가 주문 확인 기준"><input type="number" value={settings.highValueThreshold} onChange={e=>setSettings({...settings,highValueThreshold:Number(e.target.value)})}/></Field><Field label="다량 주문 확인 기준"><input type="number" value={settings.bulkQtyThreshold} onChange={e=>setSettings({...settings,bulkQtyThreshold:Number(e.target.value)})}/></Field></div><div className="formActions left"><button className={settings.apiOutage?"dangerButton":"secondary"} onClick={()=>setSettings({...settings,apiOutage:!settings.apiOutage})}>{settings.apiOutage?"API 장애모드 해제":"API 장애모드 켜기"}</button><button className="secondary" onClick={()=>setSettings({...settings,apiLastSyncAt:nowIso(),apiSuccessRate:100,wingStatus:"연결 테스트 통과(데모)"})}>API 상태 테스트(데모)</button></div><p className="securityNote">실운영 준비를 선택해도 현재 MVP는 실제 Coupang WING으로 주문/송장을 전송하지 않습니다. API Secret은 브라우저에 저장하지 않습니다.</p></div>
  <div className="panel"><h2>개인정보 / 보관 정책</h2><div className="formGrid"><Field label="목록 개인정보 마스킹"><select value={settings.privacyMasking?"사용":"해제"} onChange={e=>setSettings({...settings,privacyMasking:e.target.value==="사용"})}><option>사용</option><option>해제</option></select></Field><Field label="보관기간(일)"><input type="number" min="30" value={settings.dataRetentionDays} onChange={e=>setSettings({...settings,dataRetentionDays:Number(e.target.value)})}/></Field><Field label="자동 정리"><select value={settings.autoRetentionCleanup?"사용":"해제"} onChange={e=>setSettings({...settings,autoRetentionCleanup:e.target.value==="사용"})}><option>해제</option><option>사용</option></select></Field><Field label="자동 백업 간격(분)"><input type="number" min="1" value={settings.autoBackupMinutes} onChange={e=>setSettings({...settings,autoBackupMinutes:Number(e.target.value)})}/></Field></div></div>
  <div className="panel"><h2>보내는 사람</h2><div className="formGrid"><Field label="이름"><input value={settings.senderName} onChange={e=>setSettings({...settings,senderName:e.target.value})}/></Field><Field label="전화번호"><input value={settings.senderPhone} onChange={e=>setSettings({...settings,senderPhone:e.target.value})}/></Field><Field label="주소"><input value={settings.senderAddress} onChange={e=>setSettings({...settings,senderAddress:e.target.value})}/></Field></div></div>
  <div className="panel"><h2>알림</h2><div className="toggleGrid">{[["notifyOrderImport","주문 가져오기"],["notifyInvoiceDeadline","송장 마감"],["notifyCsRisk","CS 위험"],["notifyPurchaseDelay","발주 지연"],["notifyInvoiceMatchFail","송장 실패"],["notifyRegisterDone","등록 완료"]].map(([k,l])=><label key={k}><input type="checkbox" checked={Boolean(settings[k])} onChange={e=>setSettings({...settings,[k]:e.target.checked})}/> {l}</label>)}</div><div className="formActions left"><button className="secondary" onClick={requestNotifications}>브라우저 알림 권한</button><button className="secondary" onClick={()=>pushNotification("테스트 알림","SellerFlow 알림 정상","대시보드")}>알림 테스트</button></div></div>
  <div className="panel"><h2>대시보드 카드</h2><div className="toggleGrid">{defaultSettings.dashboardCards.map(card=><label key={card}><input type="checkbox" checked={(settings.dashboardCards||defaultSettings.dashboardCards).includes(card)} onChange={e=>{const cur=settings.dashboardCards||defaultSettings.dashboardCards;setSettings({...settings,dashboardCards:e.target.checked?[...new Set([...cur,card])]:cur.filter(x=>x!==card)})}}/> {card}</label>)}</div></div>
  <div className="panel"><h2>백업 / 복구 / 되돌리기</h2><div className="formActions left"><button className="secondary" onClick={backup}>JSON 백업</button><label className="secondary fileLabel">백업 복원<input ref={restoreRef} type="file" accept=".json" onChange={e=>restore(e.target.files?.[0])}/></label><button className="secondary" onClick={integrityCheck}>무결성 점검</button><button className="secondary" disabled={!undoStack.length} onClick={undoLast}>최근 작업 되돌리기</button></div><h3>자동 백업</h3>{autoBackups.length?autoBackups.map(s=><div className="backupRow" key={s.id}><span>{new Date(s.time).toLocaleString("ko-KR")}</span><button className="secondary" onClick={()=>restoreAuto(s)}>복구</button></div>):<p className="muted">자동 백업은 설정한 간격으로 생성됩니다.</p>}<button className="dangerButton" onClick={()=>setAutoBackups([])}>자동 백업 목록 비우기</button></div>
  </>;
}

function SettlementPage({ orders, products, returnCases }) {
  const [range, setRange] = useState(30);
  const now = Date.now();
  const rows = orders.filter((o) => {
    const time = new Date(o.createdAt).getTime();
    return !Number.isFinite(time) || now - time <= range * 86400000;
  }).map((order) => {
    const product = products.find((p) => p.name === order.product);
    const revenue = Number(order.saleAmount || 0) * Number(order.qty || 1);
    const cost = Number(product?.cost || 0) * Number(order.qty || 1);
    const shipping = Number(product?.shippingCost || 0);
    const fee = revenue * (Number(product?.feeRate ?? 10) / 100);
    const estimatedProfit = revenue - cost - shipping - fee;
    const refundCase = returnCases.find((c) => c.orderId === order.id && c.processed && String(c.resolution || c.status).includes("환불"));
    const refundLoss = refundCase ? cost + shipping : 0;
    return { ...order, revenue, cost, shipping, fee, estimatedProfit, refundLoss, netAfterRefund: estimatedProfit - refundLoss };
  });

  const total = rows.reduce((acc, row) => {
    acc.revenue += row.revenue; acc.cost += row.cost; acc.shipping += row.shipping; acc.fee += row.fee; acc.profit += row.estimatedProfit; acc.refundLoss += row.refundLoss; acc.net += row.netAfterRefund;
    return acc;
  }, { revenue: 0, cost: 0, shipping: 0, fee: 0, profit: 0, refundLoss: 0, net: 0 });

  const exportSettlement = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      주문번호: r.id, 날짜: r.date, 상품: r.product, 수량: r.qty, 매출: r.revenue, 상품원가: r.cost, 배송비: r.shipping,
      수수료추정: Math.round(r.fee), 예상이익: Math.round(r.estimatedProfit), 환불손실추정: Math.round(r.refundLoss), 환불반영이익: Math.round(r.netAfterRefund),
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "정산분석"); XLSX.writeFile(wb, `SellerFlow_정산분석_${range}일.xlsx`);
  };

  return (
    <>
      <PageHead title="정산 분석" description="상품 원가·배송비·수수료율을 기준으로 주문별 예상 손익과 환불 손실을 확인합니다." actions={<><div className="tabs">{[7, 15, 30].map((n) => <button key={n} className={range === n ? "on" : ""} onClick={() => setRange(n)}>{n}일</button>)}</div><button className="secondary" onClick={exportSettlement}>Excel 내보내기</button></>} />
      <div className="cards cards6">
        <MiniStat title="매출" value={money(total.revenue)} text />
        <MiniStat title="상품 원가" value={money(total.cost)} text />
        <MiniStat title="배송비" value={money(total.shipping)} text />
        <MiniStat title="수수료 추정" value={money(Math.round(total.fee))} text />
        <MiniStat title="환불 손실 추정" value={money(Math.round(total.refundLoss))} text />
        <MiniStat title="예상 순이익" value={money(Math.round(total.net))} text />
      </div>
      <div className="panel"><div className="panelHead"><div><h2>주문별 예상 손익</h2><p>원가가 등록되지 않은 상품은 원가 0원으로 계산되므로 상품 연결에서 입력 필요</p></div></div><div className="table"><table><thead><tr><th>주문번호</th><th>상품</th><th>매출</th><th>원가</th><th>배송비</th><th>수수료</th><th>환불손실</th><th>예상 순이익</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="8">기간 내 주문이 없습니다.</td></tr> : rows.map((r) => <tr key={r.id}><td><b>{r.id}</b></td><td>{r.product}</td><td>{money(r.revenue)}</td><td>{money(r.cost)}</td><td>{money(r.shipping)}</td><td>{money(Math.round(r.fee))}</td><td>{money(Math.round(r.refundLoss))}</td><td className={r.netAfterRefund < 0 ? "dangerText" : "okText"}><b>{money(Math.round(r.netAfterRefund))}</b></td></tr>)}</tbody></table></div></div>
      <p className="securityNote">이 화면은 운영 의사결정용 예상치입니다. 실제 쿠팡 정산금·부가세·광고비·반품 회수비 등과 차이가 날 수 있습니다.</p>
    </>
  );
}

function InsightsPage({ orders, products, suppliers, invoices, returnCases, inquiries }) {
  const [range,setRange]=useState(30); const now=Date.now(); const inRange=o=>{const t=new Date(o.createdAt||0).getTime();return !Number.isFinite(t)||now-t<=range*86400000}; const filtered=orders.filter(inRange);
  const supplierRows=suppliers.map(s=>{const os=filtered.filter(o=>o.supplier===s.name);const inv=invoices.filter(r=>r.supplier===s.name);const bad=returnCases.filter(c=>c.supplier===s.name&&["품질문제","오배송","파손"].includes(c.reason));const replied=returnCases.filter(c=>c.supplier===s.name&&c.supplierReplyAt).map(c=>(new Date(c.supplierReplyAt)-new Date(c.createdAt))/3600000).filter(Number.isFinite);const avgReply=replied.length?Math.round(replied.reduce((a,b)=>a+b,0)/replied.length*10)/10:null;const revenue=os.reduce((a,o)=>a+Number(o.saleAmount||0)*Number(o.qty||1),0);const complete=inv.filter(r=>r.invoice).length;return {name:s.name,orders:os.length,revenue,invoiceRate:os.length?Math.round(complete/os.length*100):0,problems:bad.length,responseHours:Number(s.responseDeadlineHours||24),avgReply};}).sort((a,b)=>b.orders-a.orders);
  const productRows=products.map(p=>{const os=filtered.filter(o=>o.product===p.name);const revenue=os.reduce((a,o)=>a+Number(o.saleAmount||0)*Number(o.qty||1),0);const profit=os.reduce((a,o)=>a+productProfit(o,p),0);const cs=inquiries.filter(q=>q.product===p.name).length+returnCases.filter(c=>c.product===p.name).length;return {name:p.name,orders:os.length,revenue,profit,cs,margin:revenue?Math.round(profit/revenue*1000)/10:0};}).sort((a,b)=>b.revenue-a.revenue);
  const current=filtered.reduce((a,o)=>a+Number(o.saleAmount||0)*Number(o.qty||1),0); const prevOrders=orders.filter(o=>{const t=new Date(o.createdAt||0).getTime();return Number.isFinite(t)&&now-t>range*86400000&&now-t<=range*2*86400000}); const previous=prevOrders.reduce((a,o)=>a+Number(o.saleAmount||0)*Number(o.qty||1),0); const change=previous?Math.round((current-previous)/previous*1000)/10:null;
  const exportSupplier=()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(supplierRows.map(r=>({도매처:r.name,주문:r.orders,매출:r.revenue,송장확보율:r.invoiceRate,품질오배송파손:r.problems}))),"도매처성과");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(productRows.map(r=>({상품:r.name,주문:r.orders,매출:r.revenue,예상이익:Math.round(r.profit),이익률:r.margin,CS:r.cs}))),"상품성과");XLSX.writeFile(wb,`SellerFlow_성과_${range}일.xlsx`)};
  const exportTax=()=>{const rows=filtered.map(o=>{const p=products.find(x=>x.name===o.product);return {주문번호:o.id,일자:o.date,매출:Number(o.saleAmount||0)*Number(o.qty||1),매입원가:Number(p?.cost||0)*Number(o.qty||1),배송비:Number(p?.shippingCost||0),수수료추정:Math.round(Number(o.saleAmount||0)*Number(o.qty||1)*Number(p?.feeRate??10)/100),도매처:o.supplier}});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"세금정리용");XLSX.writeFile(wb,`SellerFlow_세금정리_${range}일.xlsx`)};
  return <><PageHead title="성과 분석" description="도매처·상품별 성과, 기간 비교, 도매처 정산, 세금 정리용 데이터를 확인합니다." actions={<><div className="tabs">{[7,15,30,90].map(n=><button key={n} className={range===n?"on":""} onClick={()=>setRange(n)}>{n}일</button>)}</div><button className="secondary" onClick={exportSupplier}>성과 Excel</button><button className="secondary" onClick={exportTax}>세금 정리 Excel</button></>}/><div className="cards"><MiniStat title="이번 기간 매출" value={money(current)} text/><MiniStat title="이전 기간 매출" value={money(previous)} text/><MiniStat title="기간 증감" value={change===null?"비교자료 부족":`${change>0?"+":""}${change}%`} text/><MiniStat title="도매처 수" value={suppliers.length}/></div><div className="operationsGrid"><div className="panel"><div className="panelHead"><div><h2>도매처 성과 / 정산</h2><p>주문·매출·송장확보·품질 문제</p></div></div><div className="table"><table><thead><tr><th>도매처</th><th>주문</th><th>발주액 추정</th><th>매출</th><th>송장확보율</th><th>품질/오배송/파손</th><th>평균 회신</th></tr></thead><tbody>{supplierRows.map(r=>{const cost=filtered.filter(o=>o.supplier===r.name).reduce((a,o)=>{const p=products.find(x=>x.name===o.product);return a+Number(p?.cost||0)*Number(o.qty||1)},0);return <tr key={r.name}><td><b>{r.name}</b></td><td>{r.orders}</td><td>{money(cost)}</td><td>{money(r.revenue)}</td><td>{r.invoiceRate}%</td><td>{r.problems}건</td><td>{r.avgReply===null?"자료부족":`${r.avgReply}시간`}</td></tr>})}</tbody></table></div></div><div className="panel"><div className="panelHead"><div><h2>상품 성과</h2><p>겉매출이 아닌 예상이익·CS까지 함께 확인</p></div></div><div className="table"><table><thead><tr><th>상품</th><th>주문</th><th>매출</th><th>예상이익</th><th>이익률</th><th>CS</th></tr></thead><tbody>{productRows.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.orders}</td><td>{money(r.revenue)}</td><td className={r.profit<0?"dangerText":"okText"}>{money(Math.round(r.profit))}</td><td>{r.margin}%</td><td>{r.cs}건</td></tr>)}</tbody></table></div></div></div><p className="securityNote">성과·정산·세금용 수치는 MVP 추정치입니다. 실제 쿠팡 정산/세무 신고 자료와 대조해야 합니다.</p></>;
}

function MarginPage() {
  const [cost, setCost] = useState(18000);
  const [shipping, setShipping] = useState(3000);
  const [extra, setExtra] = useState(0);
  const [feeRate, setFeeRate] = useState(10);
  const [targetMargin, setTargetMargin] = useState(20);
  const base = Number(cost || 0) + Number(shipping || 0) + Number(extra || 0);
  const fee = Number(feeRate || 0) / 100;
  const margin = Number(targetMargin || 0) / 100;
  const raw = base / Math.max(0.05, 1 - fee - margin);
  const suggested = Math.ceil(raw / 100) * 100;
  const commission = suggested * fee;
  const vatEstimate = suggested - suggested / 1.1;
  const profit = suggested - base - commission - vatEstimate;
  const breakEven = Math.ceil((base / Math.max(0.05, 1 - fee - 0.1)) / 100) * 100;

  return (
    <><PageHead title="마진 계산기" description="수수료·배송비·기타비용·간이 VAT 추정치를 반영한 MVP 계산기입니다." /><div className="panel"><div className="formGrid"><Field label="원가"><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field><Field label="배송비"><input type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} /></Field><Field label="기타비용"><input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field><Field label="쿠팡 수수료율 %"><input type="number" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} /></Field><Field label="목표 순이익률 %"><input type="number" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} /></Field></div><div className="cards marginCards"><MiniStat title="권장 판매가" value={money(suggested)} text /><MiniStat title="예상 수수료" value={money(commission)} text /><MiniStat title="간이 VAT" value={money(vatEstimate)} text /><MiniStat title="예상 순이익" value={money(profit)} text /><MiniStat title="보수적 손익분기" value={money(breakEven)} text /></div><p className="securityNote">세무 신고용 계산이 아니라 상품 가격 검토용 간이 추정입니다.</p></div></>
  );
}

function OrderTable({ rows }) {
  return <div className="table"><table><thead><tr><th>주문번호</th><th>날짜</th><th>고객</th><th>상품</th><th>옵션</th><th>수량</th><th>판매금액</th><th>도매처</th><th>발주상태</th><th>운송장상태</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="10">주문이 없습니다.</td></tr> : rows.map((o) => <tr key={o.id}><td><b>{o.id}</b>{o.marketing && <small className="subText">마케팅</small>}</td><td>{o.date}</td><td>{o.customer}</td><td>{o.product}</td><td>{o.option}</td><td>{o.qty}</td><td>{money(o.saleAmount)}</td><td>{o.supplier}</td><td><Tag>{o.purchaseStatus}</Tag></td><td><Tag>{o.invoiceStatus}</Tag></td></tr>)}</tbody></table></div>;
}

function LogTable({ rows }) {
  return <div className="table"><table><thead><tr><th>시간</th><th>담당</th><th>유형</th><th>대상</th><th>내용</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="5">아직 기록이 없습니다.</td></tr> : rows.slice(0, 50).map((log) => <tr key={log.id}><td>{new Date(log.time).toLocaleString("ko-KR")}</td><td>{log.actor || "시스템"}</td><td><Tag>{log.type}</Tag></td><td>{log.orderId || log.caseId || log.batchId || "-"}</td><td>{log.message}</td></tr>)}</tbody></table></div>;
}

function PageHead({ title, description, actions }) {
  return <div className="head"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="headActions">{actions}</div>}</div>;
}
function StatusCard({ count, title, description, onClick }) { return <div className="card clickable" onClick={onClick}><div className="cardTop"><span>처리 현황</span><i>→</i></div><strong>{count}<small>건</small></strong><b>{title}</b><p>{description}</p></div>; }
function MiniStat({ title, value, text = false }) { return <div className="card miniStat"><span>{title}</span><strong className={text ? "textValue" : ""}>{value}{!text && <small>건</small>}</strong></div>; }
function Tag({ children }) { return <span className="tag">{children}</span>; }
function EmptyLine({ text }) { return <div className="emptyLine">{text}</div>; }
function Field({ label, children, wide = false }) { return <label className={wide ? "field wide" : "field"}><span>{label}</span>{children}</label>; }
function Detail({ label, value }) { return <div><b>{label}</b><p>{value}</p></div>; }

function SalesChart({ data }) {
  const width = 1000, height = 280, left = 45, right = 20, top = 20, bottom = 40;
  const maxOrders = Math.max(...data.map((d) => d.orderCount), 1);
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const x = (i) => left + i * ((width - left - right) / Math.max(data.length - 1, 1));
  const orderY = (v) => top + (height - top - bottom) * (1 - v / maxOrders);
  const revenueY = (v) => top + (height - top - bottom) * (1 - v / maxRevenue);
  const orderPoints = data.map((d, i) => `${x(i)},${orderY(d.orderCount)}`).join(" ");
  const revenuePoints = data.map((d, i) => `${x(i)},${revenueY(d.revenue)}`).join(" ");
  return <div className="chartWrap"><svg viewBox={`0 0 ${width} ${height}`}>{[0,1,2,3,4].map((n) => { const y = top + n * ((height-top-bottom)/4); return <line key={n} x1={left} x2={width-right} y1={y} y2={y} className="grid" />; })}<polyline points={orderPoints} className="orderLine" /><polyline points={revenuePoints} className="revenueLine" />{data.map((d,i) => <React.Fragment key={d.date}><circle cx={x(i)} cy={orderY(d.orderCount)} r="4" className="orderPoint" /><circle cx={x(i)} cy={revenueY(d.revenue)} r="4" className="revenuePoint" />{(data.length <= 7 || i % (data.length === 15 ? 2 : 5) === 0 || i === data.length-1) && <text x={x(i)} y={height-13} textAnchor="middle">{d.date}</text>}</React.Fragment>)}</svg></div>;
}

createRoot(document.getElementById("root")).render(<App />);
