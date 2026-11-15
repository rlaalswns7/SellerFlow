// Pure rules shared by file import, manual entry, and registration.
export const normalizeText = value => String(value ?? "").normalize("NFKC").replace(/^\uFEFF/, "").trim();
export const headerKey = value => normalizeText(value).replace(/\s+/g, "").toLowerCase();
const carriers = new Map([
  ["CJ대한통운", ["CJ대한통운", "CJ", "대한통운", "CJ택배", "CJLOGISTICS"]],
  ["한진택배", ["한진", "한진택배", "HANJIN"]],
  ["롯데택배", ["롯데", "롯데택배", "LOTTE"]],
  ["로젠택배", ["로젠", "로젠택배", "LOGEN"]],
  ["우체국택배", ["우체국", "우체국택배", "EPOST", "EMS"]],
  ...["경동택배", "대신택배", "일양로지스", "합동택배", "건영택배", "천일택배", "한덱스", "DHL", "FEDEX", "UPS", "CU편의점택배", "GS편의점택배"].map(x => [x, [x]])
].flatMap(([name, aliases]) => aliases.map(alias => [headerKey(alias), name])));
export function carrierName(value) { return carriers.get(headerKey(value)) || ""; }
export function invoiceValueIssues(carrier, invoice) {
  const issues = [];
  if (!normalizeText(carrier)) issues.push("택배사 누락");
  else if (!carrierName(carrier)) issues.push("지원하지 않는 택배사: 등록된 명칭을 사용하세요");
  if (!normalizeText(invoice)) issues.push("운송장번호 누락");
  else if (!/^\d{8,30}$/.test(normalizeText(invoice))) issues.push("운송장번호는 숫자 8~30자리의 텍스트여야 합니다");
  return issues;
}
export function csBlockedIds(cases = []) {
  return new Set(cases.filter(c => c.processed && (c.resolution === "환불" || /^(출고중지·|회수없이 )?환불완료(?:\(테스트\))?$/.test(c.status || "") || /^취소완료(?:\(테스트\))?$/.test(c.status || ""))).map(c => c.orderId));
}
export function fulfillmentIssues(order, target, cases = []) {
  if (!order) return ["SellerFlow 주문번호 없음"];
  if (!target) return ["아직 송장대기 대상이 아닙니다"];
  const issues = [];
  if (order.hold) issues.push("보류 주문");
  if (csBlockedIds(cases).has(order.id) || /취소|환불/.test(order.channelStatus || "")) issues.push("환불·취소된 주문");
  if (!order.marketing && order.purchaseStatus !== "발주완료") issues.push("유효한 발주완료 주문이 아닙니다");
  if (!order.marketing && order.supplier && target.supplier !== order.supplier) issues.push("주문·송장의 도매처 불일치");
  return issues;
}
const aliases = {
  id: ["주문번호", "orderid", "주문ID", "주문코드", "주문번호(쿠팡)"],
  carrier: ["택배사", "택배사명", "carrier", "배송사"],
  invoice: ["운송장번호", "송장번호", "invoice", "trackingnumber", "운송장"]
};
export function resolveHeaders(headers, mapping = {}) {
  const normalized = headers.map(headerKey);
  const columns = {};
  for (const field of Object.keys(aliases)) {
    const custom = mapping[field];
    const accepted = new Set((custom && !aliases[field].some(x => headerKey(x) === headerKey(custom)) ? [custom] : aliases[field]).map(headerKey));
    const found = normalized.flatMap((key, i) => accepted.has(key) ? [i] : []);
    if (found.length !== 1) throw new Error(`${field === "id" ? "주문번호" : field === "carrier" ? "택배사" : "운송장번호"} 열이 ${found.length ? "중복되어 있습니다" : "없습니다"}. 발주서가 아닌 송장 파일을 선택하세요.`);
    columns[field] = found[0];
  }
  if (new Set(Object.values(columns)).size !== 3) throw new Error("송장 열 설정이 서로 겹칩니다");
  return columns;
}
function cellValue(cell, field) {
  if (!cell) return "";
  if (cell.f || cell.t === "e" || cell.t === "d" || cell.t === "b") throw new Error("수식·오류·날짜·논리값 대신 텍스트 값을 입력하세요");
  if (cell.t === "n") {
    if (!Number.isSafeInteger(cell.v) || cell.v < 0) throw new Error("숫자 정밀도 손실 또는 소수입니다. 원본 번호를 텍스트로 입력하세요");
    if (field === "carrier") throw new Error("택배사가 숫자 또는 날짜입니다");
    // Explicit zero-padding/date/scientific formats cannot safely identify an original number.
    if (cell.z && !["General", "0", "@"].includes(cell.z)) throw new Error("번호 열의 숫자 서식이 모호합니다. 텍스트 형식으로 저장하세요");
  }
  return normalizeText(cell.v);
}
export async function parseInvoiceFile(file, XLSX, suppliers = []) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("XLSX/XLS/CSV 파일만 지원합니다");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("빈 파일이거나 10MB를 초과했습니다");
  const matches = suppliers.filter(s => s.name && headerKey(file.name).includes(headerKey(s.name)));
  // A농장 and A농장2 both matching is ambiguous: do not guess a supplier.
  const fileSupplier = matches.length === 1 ? matches[0].name : "";
  const supplier = matches.length === 1 ? matches[0] : null;
  const mapping = { id: supplier?.invoiceMapOrderId, carrier: supplier?.invoiceMapCarrier, invoice: supplier?.invoiceMapInvoice };
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, cellNF: true });
  if (!wb.SheetNames.length || wb.SheetNames.length > 20) throw new Error("시트 수가 없거나 20개를 초과했습니다");
  const entries = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    if (range.e.r > 10000 || range.e.c > 200) throw new Error("시트는 10,000행·201열 이하로 나누어주세요");
    const first = range.s.r;
    const headers = Array.from({ length: range.e.c + 1 }, (_, c) => ws[XLSX.utils.encode_cell({ r: first, c })]?.v ?? "");
    // Every nonempty sheet must explicitly identify all three required fields.
    const columns = resolveHeaders(headers, mapping);
    for (let r = first + 1; r <= range.e.r; r++) {
      const cells = Object.fromEntries(Object.entries(columns).map(([field, c]) => [field, ws[XLSX.utils.encode_cell({ r, c })]]));
      if (Object.values(cells).every(cell => !normalizeText(cell?.v))) continue;
      const entry = { fileName: file.name, sheetName: name, rowNo: r + 1, id: "", carrier: "", invoice: "" };
      try {
        for (const [field, cell] of Object.entries(cells)) entry[field] = cellValue(cell, field);
      } catch (error) { entry.parseError = error.message; }
      entries.push(entry);
      if (entries.length > 10000) throw new Error("한 파일은 10,000건 이하로 나누어주세요");
    }
  }
  if (!entries.length) throw new Error("처리할 송장 행이 없습니다");
  return { fileName: file.name, fileSupplier, detectedSupplier: fileSupplier || "주문별 판별", entries };
}
export function planInvoiceImport(parsedFiles, orders, invoices, cases = []) {
  const results = parsedFiles.map((file, i) => ({ key: String(i), fileName: file.fileName, supplier: file.detectedSupplier || "확인 필요", total: file.entries?.length || 0, matched: 0, skipped: 0, failed: file.error ? 1 : 0, errors: file.error ? [file.error] : [] }));
  const all = parsedFiles.flatMap((f, i) => (f.entries || []).map(row => ({ ...row, fileIndex: i, fileSupplier: f.fileSupplier })));
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const invoiceMap = new Map(invoices.map(o => [o.id, o]));
  const byId = new Map(), byNumber = new Map();
  for (const r of all) {
    if (!byId.has(r.id)) byId.set(r.id, new Set());
    byId.get(r.id).add(`${carrierName(r.carrier)}|${r.invoice}`);
    if (!byNumber.has(r.invoice)) byNumber.set(r.invoice, new Set());
    byNumber.get(r.invoice).add(r.id);
  }
  const valid = [], seen = new Set();
  for (const r of all) {
    const result = results[r.fileIndex], order = orderMap.get(r.id), target = invoiceMap.get(r.id);
    const valueIssues = invoiceValueIssues(r.carrier, r.invoice);
    let error = r.parseError || (!r.id ? "주문번호 없음" : "") || fulfillmentIssues(order, target, cases)[0] || valueIssues[0] || "";
    if (!error && /등록완료/.test(target.status || "")) error = "이미 등록완료된 주문입니다. 먼저 등록 취소를 확인하세요";
    if (!error && byId.get(r.id).size > 1) error = "같은 주문에 서로 다른 송장이 있습니다";
    if (!error && byNumber.get(r.invoice).size > 1) error = "여러 주문에 같은 송장번호가 있습니다(합배송 자동처리 미지원)";
    if (!error && invoices.some(t => t.id !== r.id && normalizeText(t.invoice) === r.invoice)) error = "기존 데이터와 송장번호 중복";
    if (!error && r.fileSupplier && target.supplier !== r.fileSupplier) error = "파일명 도매처 불일치";
    if (!error && target.invoice && invoiceValueIssues(target.carrier, target.invoice).length === 0 && (target.invoice !== r.invoice || carrierName(target.carrier) !== carrierName(r.carrier))) error = "기존 송장을 덮어쓰지 않습니다. 수정에서 비운 뒤 다시 불러오세요";
    if (error) {
      result.failed++;
      if (result.errors.length < 8) result.errors.push(`${r.sheetName || ""} ${r.rowNo}행 ${r.id || "-"}: ${error}`);
    } else if (seen.has(r.id) || (target.invoice === r.invoice && carrierName(target.carrier) === carrierName(r.carrier))) {
      result.skipped++;
    } else {
      result.matched++;
      seen.add(r.id);
      valid.push({ ...r, carrier: carrierName(r.carrier) });
    }
  }
  return { results, valid };
}
// Local fulfillment must survive subsequent order downloads.
export function mergeSyncedOrder(current, incoming) {
  const next = { ...current, ...incoming };
  for (const key of ["id", "manualApproved", "hold", "holdReason", "internalMemo", "supplierOverride", "favorite", "customerNote", "supplierNote"]) {
    if (key in current) next[key] = current[key];
  }
  if (current.purchaseBatchId || current.purchaseStatus === "발주완료" || /등록완료/.test(current.invoiceStatus || "")) {
    for (const key of ["supplier", "purchaseStatus", "invoiceStatus", "purchaseBatchId", "product", "option", "qty"]) if (key in current) next[key] = current[key];
  }
  return next;
}
export function safeFileName(value) {
  const name = normalizeText(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+|\.+$/g, "").slice(0, 160);
  return name || "발주서";
}
export function safeSheetName(value) { return (normalizeText(value).replace(/[\\/?*\[\]:\x00-\x1f]/g, "_").replace(/^'+|'+$/g, "").slice(0, 31)) || "발주서"; }
export function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 객체가 아닙니다");
  const keys = ["orders", "products", "suppliers", "invoices", "purchaseBatches", "purchaseDispatches", "inquiries", "returnCases", "csLogs", "invoiceLogs", "activityLogs", "notifications", "marketingLogs"];
  for (const key of keys) {
    if (!(key in data)) { if (["orders", "products", "suppliers"].includes(key)) throw new Error(`${key} 누락`); continue; }
    if (!Array.isArray(data[key]) || data[key].some(x => !x || typeof x !== "object" || Array.isArray(x))) throw new Error(`${key} 배열 형식 오류`);
  }
  for (const key of ["orders", "products", "suppliers", "invoices", "purchaseBatches", "returnCases"]) {
    const rows = data[key] || [];
    if (rows.some(x => !["string", "number"].includes(typeof x.id) || !String(x.id) || (typeof x.id === "number" && !Number.isSafeInteger(x.id))) || new Set(rows.map(x => x.id)).size !== rows.length) throw new Error(`${key} 식별자 누락 또는 중복`);
  }
  for (const row of data.purchaseBatches || []) if (!Array.isArray(row.orderIds) || !Array.isArray(row.suppliers)) throw new Error("발주 묶음 형식 오류");
  if (data.settings !== undefined && (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings))) throw new Error("설정 형식 오류");
  if (data.version !== undefined && (!Number.isInteger(Number(data.version)) || Number(data.version) < 1 || Number(data.version) > 7)) throw new Error("지원하지 않는 백업 버전");
  return data;
}
