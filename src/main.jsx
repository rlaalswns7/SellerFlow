import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import "./style.css";

const STORAGE_PREFIX = "sellerflow_v2_";
const nowIso = () => new Date().toISOString();
const money = (value) => `₩${Number(value || 0).toLocaleString("ko-KR")}`;
const uid = (prefix = "ID") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const menus = [
  ["대시보드", "⌂"],
  ["주문내역", "▣"],
  ["도매처 관리", "⌂"],
  ["상품 연결", "◫"],
  ["발주 관리", "▤"],
  ["운송장 관리", "◇"],
  ["마케팅 주문", "◎"],
  ["CS 관리", "◌"],
  ["마진 계산기", "₩"],
  ["설정", "⚙"],
];

const defaultOrders = [
  {
    id: "C10001",
    date: "09/23",
    createdAt: "2026-09-23T08:30:00+09:00",
    customer: "홍길동",
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
  { id: 1, name: "사과 5kg", option: "5kg / 특품", price: 32900, supplier: "A농장", vendorProductName: "부사 사과 특품 5kg", active: true },
  { id: 2, name: "토마토 2kg", option: "2kg", price: 21900, supplier: "", vendorProductName: "", active: true },
  { id: 3, name: "복숭아 3kg", option: "3kg / 특", price: 27900, supplier: "C농장", vendorProductName: "백도 복숭아 3kg", active: true },
];

const defaultSuppliers = [
  {
    id: 1,
    name: "A농장",
    contact: "010-1234-5678",
    method: "카카오톡",
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
  sellerId: "",
  vendorId: "",
  wingStatus: "미연결",
  senderName: "",
  senderPhone: "",
  senderAddress: "",
  browserNotifications: false,
  notifyOrderImport: true,
  notifyInvoiceDeadline: true,
  notifyCsRisk: true,
  notifyPurchaseDelay: true,
  notifyInvoiceMatchFail: true,
  notifyRegisterDone: true,
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

  const pushActivity = (type, message, meta = {}) => {
    setActivityLogs((prev) => [
      { id: uid("ACT"), time: nowIso(), type, message, ...meta },
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
        const product = products.find((p) => p.name === order.product && p.active !== false);
        const nextSupplier = product?.supplier || "미연결";
        let nextPurchase = order.purchaseStatus;

        if (!order.marketing && order.purchaseStatus !== "발주완료") {
          nextPurchase = nextSupplier === "미연결" ? "도매처 연결 필요" : "발주대기";
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

  const derivedNotifications = useMemo(() => {
    const items = [];
    const unlinkedProducts = products.filter((p) => p.active && !p.supplier).length;
    const purchaseWaiting = orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기").length;
    const oldPurchase = orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기" && daysAgo(o.createdAt) >= 1).length;
    const invoiceWaiting = invoices.filter((r) => r.status === "송장대기").length;
    const registerReady = invoices.filter((r) => r.status === "등록대기").length;
    const urgentCs = inquiries.filter((q) => q.deadline === "오늘" && q.status !== "답변완료").length;
    const riskyReturns = returnCases.filter((c) => !c.processed && ["품질문제", "오배송", "파손", "사기의심"].includes(c.reason)).length;
    const marketingPending = orders.filter((o) => o.marketing && o.invoiceStatus === "마케팅 송장 대기").length;

    if (unlinkedProducts) items.push({ type: "상품 연결", message: `${unlinkedProducts}개 상품의 도매처 연결이 필요합니다.`, page: "상품 연결", level: "warning" });
    if (purchaseWaiting) items.push({ type: "발주 대기", message: `${purchaseWaiting}건이 발주를 기다리고 있습니다.`, page: "발주 관리", level: oldPurchase ? "danger" : "warning" });
    if (invoiceWaiting) items.push({ type: "송장 대기", message: `${invoiceWaiting}건의 송장이 아직 도착하지 않았습니다.`, page: "운송장 관리", level: "warning" });

    const current = new Date();
    suppliers.filter((s) => s.active && s.invoiceDeadline).forEach((supplier) => {
      const waiting = invoices.filter((r) => r.supplier === supplier.name && r.status === "송장대기").length;
      if (!waiting) return;
      const [h, m] = supplier.invoiceDeadline.split(":").map(Number);
      const deadline = new Date(current);
      deadline.setHours(h || 0, m || 0, 0, 0);
      const minutes = Math.round((deadline.getTime() - current.getTime()) / 60000);
      if (minutes <= 60) {
        items.push({
          type: minutes < 0 ? "송장 마감 초과" : "송장 마감 임박",
          message: `${supplier.name} ${waiting}건 · ${supplier.invoiceDeadline} 마감`,
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
  }, [products, orders, invoices, inquiries, returnCases]);

  const unreadCount = notifications.filter((n) => !n.read).length + derivedNotifications.length;

  const openPage = (name, options = {}) => {
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
    pushActivity, pushNotification, openPage,
  };

  return (
    <div className="app">
      <aside>
        <div className="logo"><i>S</i><b>Seller<span>Flow</span></b></div>
        <div className="workspace"><b>내 판매센터</b><small>● MVP 운영 테스트</small></div>
        {menus.map(([name, icon]) => (
          <button key={name} className={page === name ? "active" : ""} onClick={() => openPage(name)}>
            <em>{icon}</em>{name}
          </button>
        ))}
      </aside>

      <main>
        <header className="topHeader">
          <div>SellerFlow / <b>{page}</b></div>
          <div className="headerTools">
            <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="주문번호·상품·고객 검색" />
            <button className="bell" onClick={() => openPage("대시보드")}>알림 {unreadCount}</button>
          </div>
        </header>

        <section className="content">
          {page === "대시보드" && <Dashboard {...shared} derivedNotifications={derivedNotifications} globalSearch={globalSearch} setPage={openPage} />}
          {page === "주문내역" && <OrderPage {...shared} orderFilter={orderFilter} globalSearch={globalSearch} />}
          {page === "도매처 관리" && <SupplierPage {...shared} />}
          {page === "상품 연결" && <ProductLinkPage {...shared} productFilter={productFilter} />}
          {page === "발주 관리" && <PurchasePage {...shared} />}
          {page === "운송장 관리" && <InvoicePage {...shared} invoiceFilter={invoiceFilter} globalSearch={globalSearch} />}
          {page === "마케팅 주문" && <MarketingPage {...shared} />}
          {page === "CS 관리" && <CSPage {...shared} />}
          {page === "마진 계산기" && <MarginPage />}
          {page === "설정" && <SettingsPage {...shared} />}
        </section>
      </main>
    </div>
  );
}

function Dashboard({ orders, products, invoices, inquiries, returnCases, activityLogs, notifications, setNotifications, derivedNotifications, setPage, globalSearch }) {
  const [range, setRange] = useState(7);
  const data = useMemo(() => sales30.slice(-range), [range]);

  const counts = {
    connection: products.filter((p) => p.active && !p.supplier).length,
    purchase: orders.filter((o) => !o.marketing && o.purchaseStatus === "발주대기").length,
    invoice: invoices.filter((r) => r.status === "송장대기").length,
    ready: invoices.filter((r) => r.status === "등록대기").length,
    cs: inquiries.filter((q) => q.deadline === "오늘" && q.status !== "답변완료").length,
    marketing: orders.filter((o) => o.marketing && o.invoiceStatus === "마케팅 송장 대기").length,
  };

  const recent = orders.filter((o) => !globalSearch || [o.id, o.customer, o.product, o.supplier].join(" ").toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 6);
  const allNotices = [
    ...derivedNotifications.map((n) => ({ id: `derived-${n.type}`, ...n, derived: true })),
    ...notifications.slice(0, 8).map((n) => ({ ...n, page: n.targetPage })),
  ];

  return (
    <>
      <PageHead title="대시보드" description="주문부터 발주·송장·CS까지 현재 자동화 상태를 확인합니다." />
      <div className="cards cards6">
        <StatusCard count={counts.connection} title="연결 필요" description="상품 도매처 연결" onClick={() => setPage("상품 연결", { productFilter: "unlinked" })} />
        <StatusCard count={counts.purchase} title="발주 대기" description="도매처 주문서 생성" onClick={() => setPage("주문내역", { orderFilter: "waiting" })} />
        <StatusCard count={counts.invoice} title="운송장 대기" description="도매처 송장 수신" onClick={() => setPage("운송장 관리", { invoiceFilter: "waiting" })} />
        <StatusCard count={counts.ready} title="쿠팡 등록 가능" description="송장 등록 준비" onClick={() => setPage("운송장 관리", { invoiceFilter: "ready" })} />
        <StatusCard count={counts.cs} title="CS 마감 임박" description="오늘 답변 필요" onClick={() => setPage("CS 관리")} />
        <StatusCard count={counts.marketing} title="마케팅 송장" description="마케팅 주문 처리" onClick={() => setPage("마케팅 주문")} />
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

function OrderPage({ orders, setOrders, products, invoices, setInvoices, purchaseBatches, setPurchaseBatches, globalSearch, orderFilter, openPage, pushActivity, pushNotification }) {
  const [search, setSearch] = useState("");
  const q = (search || globalSearch).trim().toLowerCase();

  const rows = orders.filter((o) => {
    if (q && ![o.id, o.customer, o.product, o.option, o.supplier].join(" ").toLowerCase().includes(q)) return false;
    if (orderFilter === "waiting") return o.purchaseStatus === "발주대기" && !o.marketing;
    if (orderFilter === "purchased") return o.purchaseStatus === "발주완료";
    if (orderFilter === "unlinked") return o.supplier === "미연결";
    if (orderFilter === "marketing") return o.marketing;
    return true;
  });

  const importDemoOrder = () => {
    const activeProducts = products.filter((p) => p.active !== false);
    if (!activeProducts.length) return alert("활성 상품이 없습니다.");
    const product = activeProducts[Math.floor(Math.random() * activeProducts.length)];
    const n = Math.max(10000, ...orders.map((o) => Number(String(o.id).replace(/\D/g, "")) || 0)) + 1;
    const id = `C${n}`;
    const supplier = product.supplier || "미연결";
    const order = {
      id,
      date: new Date().toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\.\s?/g, "/").replace(/\/$/, ""),
      createdAt: nowIso(),
      customer: "데모고객",
      product: product.name,
      option: product.option,
      qty: 1,
      saleAmount: product.price,
      supplier,
      purchaseStatus: supplier === "미연결" ? "도매처 연결 필요" : "발주대기",
      invoiceStatus: "송장대기",
      marketing: false,
      channelStatus: "결제완료",
    };
    setOrders((prev) => [order, ...prev]);
    pushActivity("주문 가져오기", `${id} 결제완료 주문 1건 추가(데모)`);
    pushNotification("주문 가져오기 완료", `${id} 주문을 가져왔습니다.`, "주문내역");
  };

  const cancelPurchase = (order) => {
    if (order.purchaseStatus !== "발주완료") return;
    const invoice = invoices.find((r) => r.id === order.id);
    if (invoice && (invoice.carrier || invoice.invoice || invoice.status !== "송장대기")) {
      return alert("이미 송장 처리가 진행된 주문은 발주 취소할 수 없습니다.");
    }
    if (!window.confirm(`${order.id} 주문의 발주를 취소할까요?`)) return;

    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, purchaseStatus: "발주대기", invoiceStatus: "송장대기", purchaseBatchId: null } : o));
    setInvoices((prev) => prev.filter((r) => r.id !== order.id));
    setPurchaseBatches((prev) => prev.map((batch) => {
      if (!batch.orderIds.includes(order.id)) return batch;
      const remain = batch.orderIds.filter((id) => id !== order.id);
      return { ...batch, orderIds: remain, status: remain.length ? "부분취소" : "취소" };
    }));
    pushActivity("발주 취소", `${order.id} 발주대기로 복구`);
  };

  return (
    <>
      <PageHead
        title="주문내역"
        description="주문을 검색하고 발주·상품 연결·마케팅 분류 상태를 확인합니다."
        actions={
          <>
            <button className="secondary" onClick={importDemoOrder}>결제완료 주문 가져오기(데모)</button>
            <button className="primary" onClick={() => openPage("발주 관리")}>발주 관리 열기</button>
          </>
        }
      />
      <div className="panel filterBar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="주문번호·고객·상품·도매처 검색" />
        <button className="secondary" onClick={() => openPage("상품 연결", { productFilter: "unlinked" })}>미연결 상품 보기</button>
      </div>
      <div className="panel">
        <div className="table">
          <table>
            <thead><tr><th>주문번호</th><th>날짜</th><th>고객</th><th>상품</th><th>옵션</th><th>수량</th><th>판매금액</th><th>도매처</th><th>발주상태</th><th>운송장상태</th><th>작업</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan="11">주문이 없습니다.</td></tr> : rows.map((o) => {
                const invoice = invoices.find((r) => r.id === o.id);
                const canCancel = o.purchaseStatus === "발주완료" && (!invoice || (!invoice.carrier && !invoice.invoice && invoice.status === "송장대기"));
                return <tr key={o.id}><td><b>{o.id}</b>{o.marketing && <small className="subText">마케팅</small>}</td><td>{o.date}</td><td>{o.customer}</td><td>{o.product}</td><td>{o.option}</td><td>{o.qty}</td><td>{money(o.saleAmount)}</td><td>{o.supplier}</td><td><Tag>{o.purchaseStatus}</Tag></td><td><Tag>{o.invoiceStatus}</Tag></td><td>{canCancel ? <button className="secondary" onClick={() => cancelPurchase(o)}>발주 취소</button> : "-"}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PurchasePage({ orders, setOrders, suppliers, invoices, setInvoices, purchaseBatches, setPurchaseBatches, settings, pushActivity, pushNotification }) {
  const [selected, setSelected] = useState([]);
  const eligible = orders.filter((o) => !o.marketing && o.supplier !== "미연결" && o.purchaseStatus === "발주대기");

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === eligible.length ? [] : eligible.map((o) => o.id));

  const buildRowsForSupplier = (supplierName, items) => {
    const supplier = suppliers.find((s) => s.name === supplierName);
    const columns = String(supplier?.orderColumns || "주문번호,주문일,수취인,상품명,옵션,수량").split(",").map((x) => x.trim()).filter(Boolean);
    return items.map((order) => {
      const source = {
        주문번호: order.id,
        주문일: order.date,
        수취인: order.customer,
        고객명: order.customer,
        상품명: order.product,
        옵션: order.option,
        수량: order.qty,
        판매금액: order.saleAmount,
        보내는사람: settings.senderName || "",
        연락처: settings.senderPhone || "",
        주소: settings.senderAddress || "",
      };
      const row = {};
      columns.forEach((col) => { row[col] = source[col] ?? ""; });
      return row;
    });
  };

  const previewPurchase = () => {
    const targets = eligible.filter((o) => selected.includes(o.id));
    if (!targets.length) return alert("발주할 주문을 선택해주세요.");
    const grouped = Object.groupBy ? Object.groupBy(targets, (o) => o.supplier) : targets.reduce((acc, o) => ((acc[o.supplier] ||= []).push(o), acc), {});
    alert(Object.entries(grouped).map(([supplier, items]) => `${supplier}: ${items.length}건`).join("\n"));
  };

  const createPurchaseZip = async () => {
    const targets = eligible.filter((o) => selected.includes(o.id));
    if (!targets.length) return alert("발주할 주문을 선택해주세요.");
    const grouped = targets.reduce((acc, o) => ((acc[o.supplier] ||= []).push(o), acc), {});
    const zip = new JSZip();

    Object.entries(grouped).forEach(([supplier, items]) => {
      const rows = buildRowsForSupplier(supplier, items);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "발주서");
      const array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      zip.file(`${supplier}_발주서.xlsx`, array);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const batchId = uid("PO");
    saveBlob(zipBlob, `SellerFlow_${batchId}_도매처별_발주서.zip`);

    setOrders((prev) => prev.map((o) => selected.includes(o.id) ? { ...o, purchaseStatus: "발주완료", invoiceStatus: "송장대기", purchaseBatchId: batchId } : o));
    setInvoices((prev) => {
      const next = [...prev];
      targets.forEach((o) => {
        if (!next.some((r) => r.id === o.id)) next.push({ id: o.id, product: o.product, supplier: o.supplier, carrier: "", invoice: "", status: "송장대기", source: "도매처", updatedAt: nowIso() });
      });
      return next;
    });
    setPurchaseBatches((prev) => [{ id: batchId, createdAt: nowIso(), orderIds: targets.map((o) => o.id), suppliers: Object.keys(grouped), status: "발주완료" }, ...prev]);
    pushActivity("발주서 생성", `${targets.length}건 · ${Object.keys(grouped).length}개 도매처 발주서 ZIP 생성`, { batchId });
    pushNotification("발주 완료", `${targets.length}건이 발주완료로 전환됐습니다.`, "운송장 관리");
    setSelected([]);
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

  return (
    <>
      <PageHead title="발주 관리" description="마케팅 주문을 제외하고 도매처별 XLSX를 자동 생성해 ZIP으로 한 번에 받습니다." actions={<><button className="secondary" onClick={previewPurchase}>발주 전 미리보기</button><button className="primary" onClick={createPurchaseZip}>도매처별 발주서 생성 ({selected.length})</button></>} />
      <div className="panel">
        <label className="checkLine"><input type="checkbox" checked={eligible.length > 0 && selected.length === eligible.length} onChange={toggleAll} /> 전체 선택 · 발주 가능한 주문만</label>
        <div className="table"><table><thead><tr><th>선택</th><th>주문번호</th><th>상품</th><th>도매처</th><th>수량</th><th>상태</th></tr></thead><tbody>
          {eligible.length === 0 ? <tr><td colSpan="6">발주 대기 주문이 없습니다.</td></tr> : eligible.map((o) => <tr key={o.id}><td><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} /></td><td><b>{o.id}</b></td><td>{o.product}<small className="subText">{o.option}</small></td><td>{o.supplier}</td><td>{o.qty}</td><td><Tag>{o.purchaseStatus}</Tag></td></tr>)}
        </tbody></table></div>
      </div>
      <div className="panel"><div className="panelHead"><div><h2>최근 발주 묶음</h2><p>주문서 단위 취소 안전장치 포함</p></div></div><div className="table"><table><thead><tr><th>발주번호</th><th>시간</th><th>도매처</th><th>주문수</th><th>상태</th><th>작업</th></tr></thead><tbody>
        {purchaseBatches.length === 0 ? <tr><td colSpan="6">발주 기록이 없습니다.</td></tr> : purchaseBatches.slice(0, 10).map((b) => <tr key={b.id}><td><b>{b.id}</b></td><td>{new Date(b.createdAt).toLocaleString("ko-KR")}</td><td>{b.suppliers.join(", ")}</td><td>{b.orderIds.length}</td><td><Tag>{b.status}</Tag></td><td><button className="secondary" disabled={b.status !== "발주완료"} onClick={() => cancelBatch(b)}>주문서 취소</button></td></tr>)}
      </tbody></table></div></div>
    </>
  );
}

function InvoicePage({ orders, setOrders, invoices, setInvoices, suppliers, invoiceLogs, setInvoiceLogs, invoiceFilter, globalSearch, pushActivity, pushNotification }) {
  const [selected, setSelected] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);
  const q = (search || globalSearch).trim().toLowerCase();

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
  const selectable = rows.filter((r) => r.carrier && r.invoice && r.status !== "등록완료(테스트)");
  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === selectable.length ? [] : selectable.map((r) => r.id));

  const edit = (row) => {
    if (row.status === "등록완료(테스트)") return alert("먼저 등록 취소를 해주세요.");
    const carrier = window.prompt("택배사를 입력하세요.", row.carrier || "");
    if (carrier === null) return;
    const invoice = window.prompt("운송장번호를 입력하세요.", row.invoice || "");
    if (invoice === null) return;
    if (!carrier.trim() || !invoice.trim()) return alert("택배사와 운송장번호를 모두 입력해주세요.");
    setInvoices((prev) => prev.map((r) => r.id === row.id ? { ...r, carrier: carrier.trim(), invoice: invoice.trim(), status: "등록대기", updatedAt: nowIso() } : r));
    syncOrderStatus(row.id, "쿠팡 등록 가능");
    addLog("수기 송장 입력", row, `${carrier.trim()} / ${invoice.trim()}`);
  };

  const registerRows = (targets) => {
    const actual = targets.filter((r) => r.carrier && r.invoice && r.status !== "등록완료(테스트)");
    if (!actual.length) return alert("등록 가능한 송장이 없습니다.");
    setInvoices((prev) => prev.map((r) => actual.some((t) => t.id === r.id) ? { ...r, status: "등록완료(테스트)", updatedAt: nowIso() } : r));
    setOrders((prev) => prev.map((o) => actual.some((t) => t.id === o.id) ? { ...o, invoiceStatus: "등록완료(테스트)" } : o));
    actual.forEach((r) => addLog("쿠팡 등록 완료", r, `${r.carrier} / ${r.invoice} 등록 완료(테스트)`));
    pushActivity("송장 등록", `${actual.length}건 쿠팡 등록 완료(테스트)`);
    pushNotification("쿠팡 등록 완료", `${actual.length}건 송장 등록이 완료됐습니다.`, "운송장 관리");
    setSelected([]);
  };

  const cancelRegister = (row) => {
    if (row.status !== "등록완료(테스트)") return;
    setInvoices((prev) => prev.map((r) => r.id === row.id ? { ...r, status: r.invoice ? "등록대기" : "송장대기", updatedAt: nowIso() } : r));
    syncOrderStatus(row.id, row.invoice ? "쿠팡 등록 가능" : "송장대기");
    addLog("등록 취소", row, "등록완료 상태를 등록대기로 되돌렸습니다.");
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({ 주문번호: r.id, 택배사: r.carrier || "", 운송장번호: r.invoice || "" })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "송장입력"); XLSX.writeFile(wb, "SellerFlow_송장입력_템플릿.xlsx");
  };

  const uploadInvoices = async (file) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const imported = sheetRowsFromArrayBuffer(buffer).map((row) => ({
      id: String(findCell(row, ["주문번호", "orderid", "주문ID"], 0)).trim(),
      carrier: String(findCell(row, ["택배사", "carrier"], 1)).trim(),
      invoice: String(findCell(row, ["운송장번호", "송장번호", "invoice"], 2)).trim(),
    })).filter((r) => r.id);

    const matchedIds = new Set();
    const failures = [];
    setInvoices((prev) => prev.map((row) => {
      const found = imported.find((x) => x.id === row.id);
      if (!found) return row;
      matchedIds.add(row.id);
      const status = found.invoice ? "등록대기" : "송장대기";
      return { ...row, carrier: found.carrier, invoice: found.invoice, status, updatedAt: nowIso() };
    }));

    imported.forEach((r) => { if (!invoices.some((x) => x.id === r.id)) failures.push(r.id); });
    setOrders((prev) => prev.map((o) => matchedIds.has(o.id) ? { ...o, invoiceStatus: "쿠팡 등록 가능" } : o));
    if (failures.length) pushNotification("송장 매칭 실패", `${failures.length}건 주문번호를 찾지 못했습니다: ${failures.slice(0, 4).join(", ")}`, "운송장 관리", "danger");
    pushActivity("송장 파일 업로드", `${matchedIds.size}건 매칭 / ${failures.length}건 실패`);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <PageHead title="운송장 관리" description="도매처별 필터, XLSX/CSV 일괄 매칭, 수기 수정, 쿠팡 등록 테스트를 한 화면에서 처리합니다." actions={<><button className="secondary" onClick={downloadTemplate}>송장 템플릿 다운로드</button><label className="primary fileLabel">송장 파일 불러오기<input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => uploadInvoices(e.target.files?.[0])} /></label><button className="primary" disabled={!selected.length} onClick={() => registerRows(invoices.filter((r) => selected.includes(r.id)))}>선택 일괄등록 ({selected.length})</button></>} />
      <div className="panel filterBar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="주문번호·상품·택배사·송장번호 검색" /><select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}><option value="all">전체 도매처</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
      <div className="panel"><div className="table"><table><thead><tr><th><input type="checkbox" checked={selectable.length > 0 && selected.length === selectable.length} onChange={toggleAll} /></th><th>주문번호</th><th>상품</th><th>도매처</th><th>택배사</th><th>운송장번호</th><th>상태</th><th>관리</th></tr></thead><tbody>
        {rows.length === 0 ? <tr><td colSpan="8">조건에 맞는 운송장 주문이 없습니다.</td></tr> : rows.map((row) => <tr key={row.id}><td><input type="checkbox" disabled={!row.carrier || !row.invoice || row.status === "등록완료(테스트)"} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td><td><b>{row.id}</b><small className="subText">{row.source}</small></td><td>{row.product}</td><td>{row.supplier}</td><td>{row.carrier || "-"}</td><td>{row.invoice || "-"}</td><td><Tag>{row.status}</Tag></td><td className="actions">{row.status === "등록완료(테스트)" ? <button className="secondary" onClick={() => cancelRegister(row)}>등록 취소</button> : <button className="secondary" disabled={!row.carrier || !row.invoice} onClick={() => registerRows([row])}>쿠팡 등록</button>}<button className="secondary" onClick={() => edit(row)} disabled={row.status === "등록완료(테스트)"}>수정</button></td></tr>)}
      </tbody></table></div></div>
      <div className="panel"><div className="panelHead"><div><h2>운송장 처리 로그</h2><p>중복·실패·등록·취소 기록</p></div><button className="secondary" onClick={() => setInvoiceLogs([])}>로그 비우기</button></div><LogTable rows={invoiceLogs} /></div>
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
  const emptyForm = { name: "", contact: "", method: "카카오톡", orderDeadline: "17:00", invoiceDeadline: "19:00", orderColumns: "주문번호,주문일,수취인,상품명,옵션,수량,주소", invoiceColumns: "주문번호,택배사,운송장번호", defectAction: "환불", wrongAction: "재배송", damageAction: "재배송", returnShippingPayer: "도매처", responseDeadlineHours: 24, active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const save = () => {
    if (!form.name.trim()) return alert("도매처명을 입력해주세요.");
    if (editingId) setSuppliers((prev) => prev.map((s) => s.id === editingId ? { ...s, ...form, name: form.name.trim() } : s));
    else setSuppliers((prev) => [...prev, { ...form, id: Date.now(), name: form.name.trim() }]);
    setForm(emptyForm); setEditingId(null); setShowForm(false);
  };

  const edit = (supplier) => { setForm({ ...supplier }); setEditingId(supplier.id); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
      <PageHead title="도매처 관리" description="발주 마감·송장 마감·엑셀 양식·불량/오배송/파손 처리 규정을 도매처별로 저장합니다." actions={<button className="primary" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>+ 도매처 추가</button>} />
      {showForm && <div className="panel"><h2>{editingId ? "도매처 수정" : "도매처 추가"}</h2><div className="formGrid">
        <Field label="도매처명"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="연락처"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
        <Field label="발주 방식"><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>카카오톡</option><option>문자</option><option>이메일</option><option>기타</option></select></Field>
        <Field label="발주 마감"><input type="time" value={form.orderDeadline} onChange={(e) => setForm({ ...form, orderDeadline: e.target.value })} /></Field>
        <Field label="송장 마감"><input type="time" value={form.invoiceDeadline} onChange={(e) => setForm({ ...form, invoiceDeadline: e.target.value })} /></Field>
        <Field label="회신 제한(시간)"><input type="number" min="1" value={form.responseDeadlineHours} onChange={(e) => setForm({ ...form, responseDeadlineHours: Number(e.target.value) })} /></Field>
        <Field label="발주서 컬럼" wide><input value={form.orderColumns} onChange={(e) => setForm({ ...form, orderColumns: e.target.value })} /></Field>
        <Field label="송장 컬럼" wide><input value={form.invoiceColumns} onChange={(e) => setForm({ ...form, invoiceColumns: e.target.value })} /></Field>
        <Field label="품질문제 기본 처리"><select value={form.defectAction} onChange={(e) => setForm({ ...form, defectAction: e.target.value })}><option>환불</option><option>재배송</option><option>수동</option></select></Field>
        <Field label="오배송 기본 처리"><select value={form.wrongAction} onChange={(e) => setForm({ ...form, wrongAction: e.target.value })}><option>환불</option><option>재배송</option><option>수동</option></select></Field>
        <Field label="파손 기본 처리"><select value={form.damageAction} onChange={(e) => setForm({ ...form, damageAction: e.target.value })}><option>환불</option><option>재배송</option><option>수동</option></select></Field>
        <Field label="귀책 반품 배송비"><select value={form.returnShippingPayer} onChange={(e) => setForm({ ...form, returnShippingPayer: e.target.value })}><option>도매처</option><option>판매자</option><option>고객</option></select></Field>
      </div><div className="formActions"><button className="secondary" onClick={() => setShowForm(false)}>취소</button><button className="primary" onClick={save}>저장</button></div></div>}
      <div className="panel"><div className="table"><table><thead><tr><th>도매처</th><th>연락</th><th>마감</th><th>연결 상품</th><th>CS 규정</th><th>상태</th><th>관리</th></tr></thead><tbody>{suppliers.map((s) => <tr key={s.id}><td><b>{s.name}</b><small className="subText">{s.method}</small></td><td>{s.contact}</td><td>발주 {s.orderDeadline}<small className="subText">송장 {s.invoiceDeadline}</small></td><td>{products.filter((p) => p.supplier === s.name).length}개</td><td>품질 {s.defectAction} · 오배송 {s.wrongAction}<small className="subText">파손 {s.damageAction} · 배송비 {s.returnShippingPayer}</small></td><td><Tag>{s.active ? "사용중" : "중지"}</Tag></td><td className="actions"><button className="secondary" onClick={() => edit(s)}>수정</button><button className="secondary" onClick={() => setSuppliers((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !x.active } : x))}>{s.active ? "중지" : "사용"}</button></td></tr>)}</tbody></table></div></div>
    </>
  );
}

function ProductLinkPage({ products, setProducts, suppliers, productFilter }) {
  const [search, setSearch] = useState("");
  const activeSuppliers = suppliers.filter((s) => s.active);
  const rows = products.filter((p) => (productFilter !== "unlinked" || !p.supplier) && (!search || [p.name, p.option, p.supplier, p.vendorProductName].join(" ").toLowerCase().includes(search.toLowerCase())));
  const update = (id, patch) => setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));

  return (
    <>
      <PageHead title="상품 연결" description="쿠팡 상품과 도매처·도매처 상품명을 연결합니다. 연결 상태는 주문 발주 가능 여부와 즉시 동기화됩니다." />
      <div className="panel filterBar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품·옵션·도매처 상품명 검색" /><span className="muted">미연결 {products.filter((p) => p.active && !p.supplier).length}개</span></div>
      <div className="panel"><div className="table"><table><thead><tr><th>상품</th><th>옵션</th><th>판매가</th><th>도매처</th><th>도매처 상품명</th><th>활성화</th><th>상태</th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.option}</td><td>{money(p.price)}</td><td><select value={p.supplier} onChange={(e) => update(p.id, { supplier: e.target.value })}><option value="">도매처 선택</option>{activeSuppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></td><td><input value={p.vendorProductName || ""} onChange={(e) => update(p.id, { vendorProductName: e.target.value })} placeholder="도매처 상품명" /></td><td><input type="checkbox" checked={p.active !== false} onChange={(e) => update(p.id, { active: e.target.checked })} /></td><td><Tag>{p.supplier ? "연결완료" : "미연결"}</Tag></td></tr>)}</tbody></table></div></div>
    </>
  );
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
    setReturnCases((prev) => prev.map((c) => c.id === item.id ? { ...c, supplierReply: replyText.trim(), processed: true, status: `${item.resolution || "처리"}완료(테스트)` } : c));
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

function SettingsPage({ settings, setSettings, orders, products, suppliers, invoices, purchaseBatches, inquiries, returnCases, csLogs, invoiceLogs, activityLogs, notifications, marketingLogs, setOrders, setProducts, setSuppliers, setInvoices, setPurchaseBatches, setInquiries, setReturnCases, setCsLogs, setInvoiceLogs, setActivityLogs, setNotifications, setMarketingLogs, pushNotification }) {
  const restoreRef = useRef(null);

  const requestNotifications = async () => {
    if (!("Notification" in window)) return alert("이 브라우저는 시스템 알림을 지원하지 않습니다.");
    const permission = await Notification.requestPermission();
    setSettings((prev) => ({ ...prev, browserNotifications: permission === "granted" }));
    alert(permission === "granted" ? "브라우저 알림을 허용했습니다." : "브라우저 알림 권한이 허용되지 않았습니다.");
  };

  const backup = () => {
    const payload = { version: 2, exportedAt: nowIso(), orders, products, suppliers, invoices, purchaseBatches, inquiries, returnCases, csLogs, invoiceLogs, activityLogs, notifications, marketingLogs, settings };
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `SellerFlow_backup_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.orders || !data.products || !data.suppliers) throw new Error();
      setOrders(data.orders); setProducts(data.products); setSuppliers(data.suppliers); setInvoices(data.invoices || []); setPurchaseBatches(data.purchaseBatches || []); setInquiries(data.inquiries || []); setReturnCases(data.returnCases || []); setCsLogs(data.csLogs || []); setInvoiceLogs(data.invoiceLogs || []); setActivityLogs(data.activityLogs || []); setNotifications(data.notifications || []); setMarketingLogs(data.marketingLogs || []); setSettings({ ...defaultSettings, ...(data.settings || {}) });
      alert("백업을 복원했습니다.");
    } catch { alert("SellerFlow 백업 파일 형식이 아닙니다."); }
    if (restoreRef.current) restoreRef.current.value = "";
  };

  const integrityCheck = () => {
    const issues = [];
    orders.forEach((o) => {
      if (!products.some((p) => p.name === o.product)) issues.push(`${o.id}: 상품 연결 데이터 없음`);
      if (o.purchaseStatus === "발주완료" && !o.marketing && !invoices.some((r) => r.id === o.id)) issues.push(`${o.id}: 발주완료인데 운송장 행 없음`);
      if (o.supplier !== "미연결" && !suppliers.some((s) => s.name === o.supplier)) issues.push(`${o.id}: 존재하지 않는 도매처 ${o.supplier}`);
    });
    invoices.forEach((r) => { if (!orders.some((o) => o.id === r.id)) issues.push(`${r.id}: 주문 없는 운송장 데이터`); });
    alert(issues.length ? `점검 결과 ${issues.length}건\n\n${issues.slice(0, 12).join("\n")}` : "데이터 무결성 이상 없음");
  };

  const resetDemo = () => {
    if (!window.confirm("모든 MVP 데이터를 초기 데모 상태로 되돌릴까요?")) return;
    setOrders(clone(defaultOrders)); setProducts(clone(defaultProducts)); setSuppliers(clone(defaultSuppliers)); setInvoices(clone(defaultInvoices)); setPurchaseBatches([]); setInquiries(clone(defaultInquiries)); setReturnCases(clone(defaultReturnCases)); setCsLogs([]); setInvoiceLogs([]); setActivityLogs([]); setNotifications([]); setMarketingLogs([]); setSettings(clone(defaultSettings));
  };

  return (
    <>
      <PageHead title="설정" description="쿠팡 연결 준비, 보내는 사람 정보, 알림, 백업/복원, 데이터 점검을 관리합니다." />
      <div className="panel"><h2>쿠팡 WING 연결 준비</h2><p className="securityNote">실제 Access Key / Secret Key는 브라우저에 저장하지 않습니다. 실제 연동 단계에서는 Vercel 서버 환경변수에만 보관합니다.</p><div className="formGrid"><Field label="WING 판매자 ID"><input value={settings.sellerId} onChange={(e) => setSettings({ ...settings, sellerId: e.target.value })} /></Field><Field label="Vendor ID"><input value={settings.vendorId} onChange={(e) => setSettings({ ...settings, vendorId: e.target.value })} /></Field><Field label="연결 상태"><input readOnly value={settings.wingStatus} /></Field></div><div className="formActions"><button className="secondary" onClick={() => alert("MVP에서는 실제 API를 호출하지 않습니다. 백엔드 연결 후 이 버튼이 실제 인증 테스트로 바뀝니다.")}>연결 테스트(데모)</button></div></div>
      <div className="panel"><h2>보내는 사람 정보</h2><div className="formGrid"><Field label="이름"><input value={settings.senderName} onChange={(e) => setSettings({ ...settings, senderName: e.target.value })} /></Field><Field label="전화번호"><input value={settings.senderPhone} onChange={(e) => setSettings({ ...settings, senderPhone: e.target.value })} /></Field><Field label="주소" wide><input value={settings.senderAddress} onChange={(e) => setSettings({ ...settings, senderAddress: e.target.value })} /></Field></div></div>
      <div className="panel"><h2>알림 설정</h2><div className="toggleGrid">{[["notifyOrderImport", "주문 가져오기 완료"], ["notifyInvoiceDeadline", "송장 마감 임박"], ["notifyCsRisk", "CS 환불 위험"], ["notifyPurchaseDelay", "발주 지연"], ["notifyInvoiceMatchFail", "송장 매칭 실패"], ["notifyRegisterDone", "쿠팡 등록 완료"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} /> {label}</label>)}</div><div className="formActions"><button className="secondary" onClick={requestNotifications}>브라우저 알림 권한 요청</button><button className="secondary" onClick={() => pushNotification("테스트 알림", "SellerFlow 알림 기능이 정상입니다.", "대시보드")}>알림 테스트</button></div></div>
      <div className="panel"><h2>데이터 관리</h2><div className="formActions left"><button className="secondary" onClick={backup}>JSON 백업</button><label className="secondary fileLabel">백업 복원<input ref={restoreRef} type="file" accept="application/json,.json" onChange={(e) => restore(e.target.files?.[0])} /></label><button className="secondary" onClick={integrityCheck}>데이터 무결성 점검</button><button className="dangerButton" onClick={resetDemo}>데모 데이터 초기화</button></div></div>
    </>
  );
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
  return <div className="table"><table><thead><tr><th>시간</th><th>유형</th><th>대상</th><th>내용</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="4">아직 기록이 없습니다.</td></tr> : rows.slice(0, 50).map((log) => <tr key={log.id}><td>{new Date(log.time).toLocaleString("ko-KR")}</td><td><Tag>{log.type}</Tag></td><td>{log.orderId || log.caseId || log.batchId || "-"}</td><td>{log.message}</td></tr>)}</tbody></table></div>;
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
