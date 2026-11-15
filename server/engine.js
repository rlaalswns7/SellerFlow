import crypto from "node:crypto";
import XLSX from "xlsx-js-style";
import { invoiceValueIssues, fulfillmentIssues, csBlockedIds, mergeSyncedOrder, safeFileName, safeSheetName, planInvoiceImport } from "../src/reliability.js";
import { AutomationError, normalizeBox, wingCourier, kstDate } from "./wing.js";

export const jobId = (kind, key) => crypto.createHash("sha256").update(`${kind}:${key}`).digest("hex");
const copy = value => JSON.parse(JSON.stringify(value));
export function matchProduct(order, products) {
  const byId = products.filter(p => String(p.vendorItemId || "") === order.coupangVendorItemId);
  const candidates = byId.length ? byId : products.filter(p => p.name === order.product && (!p.option || p.option === order.option));
  return candidates.length === 1 ? candidates[0] : null;
}
function init(state) {
  const s = copy(state);
  for (const key of ["orders","products","suppliers","invoices","purchaseBatches","purchaseDispatches","inquiries","returnCases","csLogs","invoiceLogs","activityLogs","notifications","marketingLogs"]) s[key] ||= [];
  s.settings ||= {};
  return s;
}
function trace(state, type, message, now) {
  state.activityLogs.unshift({ id: crypto.randomUUID(), time: now().toISOString(), type, message, actor: "서버 자동화" });
  state.activityLogs = state.activityLogs.slice(0,250);
}
export function mergeBoxes(state, boxes) {
  const next = init(state), seen = new Set();
  for (const box of boxes) for (let row of normalizeBox(box)) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const exact = next.orders.find(o => o.id === row.id);
    const legacy = next.orders.filter(o => o.source === "coupang" && o.coupangOrderId === row.coupangOrderId && o.coupangVendorItemId === row.coupangVendorItemId && (!o.shipmentBoxId || o.shipmentBoxId === row.shipmentBoxId));
    if (!exact && legacy.length > 1) throw new AutomationError("AMBIGUOUS_LEGACY", "이전 주문 식별자가 겹칩니다. 수동 정리가 필요합니다");
    const old = exact || legacy[0];
    const legacyConflict = !old && next.orders.some(o => o.source === "coupang" && o.coupangOrderId === row.coupangOrderId && o.coupangVendorItemId === row.coupangVendorItemId && (o.purchaseBatchId || o.purchaseStatus === "발주완료"));
    if (old) row.id = old.id;
    const product = matchProduct(row, next.products);
    row.supplier = product?.supplier || "미연결";
    row.purchaseStatus = row.supplier === "미연결" ? "도매처 연결 필요" : "발주대기";
    if (legacyConflict) { row.hold=true; row.holdReason="이전 발주와 배송번호가 다릅니다. 재발주 전 확인 필요"; }
    if (old) next.orders[next.orders.indexOf(old)] = mergeSyncedOrder(old, row);
    else next.orders.push(row);
  }
  return next;
}
export function purchaseIssues(order, state, now = new Date()) {
  const p = matchProduct(order,state.products), supplier = state.suppliers.find(s => s.name === order.supplier), settings = state.settings;
  const issues = [];
  if (order.source !== "coupang") issues.push("실제 쿠팡 주문 아님");
  if (order.marketing || order.hold || order.cancelHold || csBlockedIds(state.returnCases).has(order.id) || (state.returnCases || []).some(c => (c.orderId === order.id || c.linkedOrderIds?.includes(order.id)) && !c.processed)) issues.push("보류·취소·CS 확인 필요");
  if (!["ACCEPT","INSTRUCT"].includes(order.channelStatus) || order.splitShipping) issues.push("발주 가능한 원격 주문 상태가 아님");
  if (!p || p.active === false || p.stockout || p.automationMode === "수동검토" && !order.manualApproved) issues.push("상품 연결·자동화 규칙 확인 필요");
  if (!supplier?.active || supplier.dispatchEnabled !== true || !supplier.dispatchRecipientId) issues.push("도매처 자동전송 설정 필요");
  if (String(supplier?.holidays || "").split(",").map(x=>x.trim()).includes(kstDate(now))) issues.push("도매처 휴무일");
  if (!order.customer || !order.phone || String(order.address || "").length < 8 || !order.postCode) issues.push("수취 정보 누락");
  if (!settings.senderName || !settings.senderPhone || !settings.senderAddress) issues.push("발신자 설정 필요");
  if (!Number.isSafeInteger(order.qty) || order.qty < 1) issues.push("수량 오류");
  const amount = Number(order.saleAmount) * order.qty;
  const cost = Number(p?.cost) * order.qty + Number(p?.shippingCost || 0);
  const profit = amount - cost - amount * Number(p?.feeRate ?? 10) / 100;
  if (!Number.isFinite(profit) || profit < 0 || !Number.isFinite(cost) || cost <= 0) issues.push("원가·마진 확인 필요");
  if (amount >= Number(settings.highValueThreshold || 100000) || order.qty >= Number(settings.bulkQtyThreshold || 5)) issues.push("고가·다량 수동 확인 필요");
  const limit = Number(settings.serverDailyCostLimit || 0);
  const reservations = Object.entries(settings.serverCostReservations || {}).filter(([key,r]) => key !== jobId("purchase",order.shipmentBoxId) && r.date === kstDate(now)).reduce((sum,[,r])=>sum+Number(r.cost || 0),0);
  const spent = reservations + (state.purchaseBatches || []).filter(b => b.serverCreated && b.costDate === kstDate(now) && b.status !== "취소").reduce((n,b)=>n+Number(b.purchaseCost || 0),0);
  if (!Number.isFinite(limit) || !Number.isFinite(spent) || limit <= 0 || spent + cost > limit) issues.push("일일 발주 원가 한도 확인 필요");
  if (order.purchaseBatchId || order.purchaseStatus !== "발주대기") issues.push("이미 발주했거나 대기 대상이 아님");
  if (order.qty < Number(supplier?.minOrderQty || 1) || amount < Number(supplier?.minOrderAmount || 0)) issues.push("도매처 최소 주문 기준 미달");
  if (state.orders.filter(o=>o.shipmentBoxId === order.shipmentBoxId && o.source === "coupang").length !== 1) issues.push("묶음·분리배송은 수동 확인 필요");
  return [...new Set(issues)];
}
export function planJobs(state, now = new Date()) {
  const jobs = [], blocked = [];
  for (const order of state.orders) {
    if (order.source !== "coupang" || order.purchaseStatus !== "발주대기" || order.marketing) continue;
    const issues = purchaseIssues(order,state,now);
    if (issues.length) { blocked.push({ id:order.id, issues }); continue; }
    jobs.push({ id:jobId("purchase",order.shipmentBoxId),kind:"purchase",payload:{ orderId:order.id, shipmentBoxId:order.shipmentBoxId, qty:order.qty, supplier:order.supplier } });
  }
  for (const invoice of state.invoices) {
    if (invoice.status !== "등록대기") continue;
    const order = state.orders.find(o=>o.id === invoice.id);
    const issues = fulfillmentIssues(order,invoice,state.returnCases);
    if (!order || order.source !== "coupang" || order.cancelHold || order.splitShipping || (state.returnCases || []).some(c => !c.processed && (c.orderId === order.id || c.linkedOrderIds?.includes(order.id)))) issues.push("실제 주문 상태 확인 필요");
    if (order && state.orders.filter(o=>o.source === "coupang" && o.shipmentBoxId === order.shipmentBoxId).length !== 1) issues.push("묶음·분리배송 자동등록 미지원");
    issues.push(...invoiceValueIssues(invoice.carrier,invoice.invoice));
    try { wingCourier(invoice.carrier,invoice.invoice); } catch (e) { issues.push(e.message); }
    if (issues.length) { blocked.push({id:invoice.id,issues}); continue; }
    jobs.push({id:jobId("invoice",order.shipmentBoxId),kind:"invoice",payload:{orderId:order.id,carrier:invoice.carrier,invoice:invoice.invoice}});
  }
  for (const q of state.inquiries) if (q.source === "coupang" && q.approvedAnswer && q.status !== "답변완료") jobs.push({id:jobId("reply",q.inquiryId),kind:"reply",payload:{inquiryId:q.inquiryId,answer:q.approvedAnswer}});
  for (const c of state.returnCases) if (c.source === "coupang" && c.reason === "단순변심" && c.resolution === "환불" && c.remoteApprovalReady === true && !c.processed) jobs.push({id:jobId("refund",c.receiptId),kind:"refund",payload:{caseId:c.id,receiptId:c.receiptId,cancelCount:c.cancelCount}});
  return { jobs, blocked };
}
export function supplierFile(order,state) {
  const supplier = state.suppliers.find(s=>s.name === order.supplier), product = matchProduct(order,state.products);
  const row = { 주문번호:order.id, 쿠팡주문번호:order.coupangOrderId, 주문일:order.date, 수취인:order.customer, 상품명:product?.supplierProductName || order.product, 옵션:order.option, 수량:order.qty, 연락처:order.phone, 우편번호:order.postCode, 주소:order.address, 배송메모:order.customerNote, 보내는사람:state.settings.senderName, 보내는사람연락처:state.settings.senderPhone, 보내는사람주소:state.settings.senderAddress };
  const ws = XLSX.utils.json_to_sheet([row]);
  ws["!cols"] = Object.keys(row).map(k=>({wch:k.includes("주소")?48:20}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,safeSheetName(supplier?.orderSheetName || "발주서"));
  return {fileName:safeFileName(`${order.supplier}_${order.id}_발주서`) + ".xlsx",fileBase64:XLSX.write(wb,{type:"base64",bookType:"xlsx"}),supplierName:order.supplier,recipientId:supplier.dispatchRecipientId,orderCount:1};
}
export function createSupplierSender({env=process.env,fetchImpl=fetch}={}) {
  return async (file,idempotencyKey) => {
    if (env.SELLERFLOW_SUPPLIER_DELIVERY_MODE === "portal") {
      let keys;try{keys=JSON.parse(env.SELLERFLOW_SUPPLIER_KEYS_JSON||"{}");}catch{throw new AutomationError("NOT_CONFIGURED","도매처 수신 키 설정 오류");}
      if(typeof keys[file.supplierName]!=="string"||keys[file.supplierName].length<24)throw new AutomationError("NOT_CONFIGURED","도매처 전용 키는 24자 이상으로 설정해주세요");
      return {receiptId:"portal:"+idempotencyKey,deliveryState:"portal_available"};
    }
    if (!env.SELLERFLOW_PURCHASE_WEBHOOK_URL || !env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN) throw new AutomationError("NOT_CONFIGURED","도매처 전송 어댑터 설정 필요");
    let response;
    try { response=await fetchImpl(env.SELLERFLOW_PURCHASE_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN}`,"Idempotency-Key":idempotencyKey},body:JSON.stringify({...file,idempotencyKey,batchId:`AUTO-${idempotencyKey.slice(0,20)}`}),signal:AbortSignal.timeout(10000)}); }
    catch { throw new AutomationError("DELIVERY_UNKNOWN","도매처 전달 여부 확인 필요",true); }
    let data;try{data=await response.json();}catch{throw new AutomationError("DELIVERY_UNKNOWN","도매처 응답 형식 확인 필요",true);}
    // A test receiver or a queue ack is never proof of actual supplier delivery.
    if (!response.ok || data?.ok !== true || data?.delivered !== true || !data?.receiptId || data?.test === true) throw new AutomationError("DELIVERY_UNCONFIRMED","실제 전달 확인 응답이 없습니다",true);
    return {receiptId:String(data.receiptId).slice(0,200)};
  };
}
export async function executeJob(job,state,{wing,sendSupplier,now=()=>new Date(),beforeEffect=async()=>{}}) {
  const next=init(state), p=job.payload, order=next.orders.find(o=>o.id === p.orderId);
  if (job.kind === "purchase") {
    if (!order || purchaseIssues(order,next,now()).length || order.qty !== p.qty || order.supplier !== p.supplier) throw new AutomationError("STALE_ORDER","발주 조건이 변경됐습니다");
    let box=await wing.getBox(order.shipmentBoxId);
    const before=normalizeBox(box);
    if(before.length!==1 || before[0].coupangVendorItemId!==order.coupangVendorItemId || before[0].qty!==order.qty || before[0].cancelHold || before[0].splitShipping)throw new AutomationError("ORDER_CHANGED","준비중 처리 전 원격 주문 재검증 실패");
    if (box.status === "ACCEPT") { await beforeEffect(); await wing.acknowledge(order.shipmentBoxId); box=await wing.getBox(order.shipmentBoxId); }
    if (box.status !== "INSTRUCT") throw new AutomationError("WRONG_STATUS","상품준비중 주문이 아닙니다");
    const fresh=normalizeBox(box);
    if (fresh.length !== 1 || fresh[0].coupangVendorItemId !== order.coupangVendorItemId || fresh[0].qty !== order.qty || fresh[0].saleAmount !== order.saleAmount || fresh[0].product !== order.product || fresh[0].option !== order.option || fresh[0].cancelHold || fresh[0].splitShipping) throw new AutomationError("ORDER_CHANGED","최신 주문 상품·수량·취소 상태 확인 필요");
    Object.assign(order,{customer:fresh[0].customer,phone:fresh[0].phone,address:fresh[0].address,postCode:fresh[0].postCode,customerNote:fresh[0].customerNote,channelStatus:"INSTRUCT"});
    if (purchaseIssues(order,next,now()).length) throw new AutomationError("FRESH_VALIDATION_FAILED","최신 배송지·발주 조건 검증 실패");
    await beforeEffect();
    const receipt=await sendSupplier(supplierFile(order,next),job.id);
    const batchId=`AUTO-${job.id.slice(0,20)}`, product=matchProduct(order,next.products);
    delete (next.settings.serverCostReservations || {})[job.id];
    order.purchaseBatchId=batchId;order.purchaseStatus="발주완료";order.invoiceStatus="송장대기";
    next.purchaseBatches.unshift({id:batchId,createdAt:now().toISOString(),orderIds:[order.id],suppliers:[order.supplier],status:"발주완료",serverCreated:true,supplierExport:{order:copy(order),productName:product?.supplierProductName||order.product,senderName:next.settings.senderName,senderPhone:next.settings.senderPhone,senderAddress:next.settings.senderAddress},costDate:kstDate(now()),purchaseCost:Number(product.cost)*order.qty+Number(product.shippingCost || 0),deliveries:{[order.supplier]:{status:receipt.deliveryState==="portal_available"?"도매처확인대기":"자동전송완료",sentAt:receipt.deliveryState==="portal_available"?"":now().toISOString(),receiptId:receipt.receiptId}}});
    if (!next.invoices.some(i=>i.id === order.id)) next.invoices.push({id:order.id,product:order.product,supplier:order.supplier,carrier:"",invoice:"",status:"송장대기",source:"도매처",updatedAt:now().toISOString()});
    trace(next,receipt.deliveryState==="portal_available"?"발주서 도매처 페이지 게시":"서버 발주 전달완료",`${order.id} · ${order.supplier}`,now);
    return {state:next,result:{batchId,receiptId:receipt.receiptId}};
  }
  if (job.kind === "invoice") {
    const invoice=next.invoices.find(i=>i.id === p.orderId);
    const candidate=planJobs(next,now()).jobs.find(j=>j.id === job.id);
    if (!candidate || invoice.carrier !== p.carrier || invoice.invoice !== p.invoice) throw new AutomationError("STALE_INVOICE","송장 또는 주문 상태가 바뀌었습니다");
    const box=await wing.getBox(order.shipmentBoxId), fresh=normalizeBox(box);
    if (fresh.length !== 1 || fresh[0].coupangOrderId !== order.coupangOrderId || fresh[0].coupangVendorItemId !== order.coupangVendorItemId || fresh[0].cancelHold || fresh[0].qty !== order.qty) throw new AutomationError("ORDER_CHANGED","원격 주문 변경·취소 확인 필요");
    const code=wingCourier(invoice.carrier,invoice.invoice);
    const already=["DEPARTURE","DELIVERING","FINAL_DELIVERY"].includes(box.status) && String(box.invoiceNumber) === p.invoice && box.deliveryCompanyCode === code;
    if (!already) {
      if (box.status !== "INSTRUCT" || box.invoiceNumber || box.splitShipping) throw new AutomationError("REMOTE_INVOICE_CONFLICT","원격 송장·주문 상태 확인 필요");
      await beforeEffect();await wing.registerInvoice(order,invoice);
    }
    invoice.status="등록완료";invoice.updatedAt=now().toISOString();order.invoiceStatus="등록완료";order.channelStatus="DEPARTURE";
    next.invoiceLogs.unshift({id:crypto.randomUUID(),time:now().toISOString(),orderId:order.id,type:"실제 쿠팡 등록",message:`${invoice.carrier} / ${invoice.invoice}`});
    trace(next,"서버 송장 등록완료",order.id,now);
    return {state:next,result:{orderId:order.id,reconciled:already}};
  }
  if (job.kind === "reply") {
    const q=next.inquiries.find(q=>q.inquiryId === p.inquiryId);
    if (!q || q.approvedAnswer !== p.answer || q.status === "답변완료") throw new AutomationError("STALE_REPLY","승인한 답변이 변경됐습니다");
    const qs=await wing.listInquiries({from:kstDate(new Date(now().getTime()-6*86400000)),to:kstDate(now())}), remote=qs.find(q=>String(q.inquiryId)===p.inquiryId);
    if (!remote || remote.commentDtoList?.length) throw new AutomationError("REPLY_CONFLICT","문의가 없거나 이미 답변됐습니다");
    await beforeEffect();await wing.reply(p.inquiryId,p.answer);
    q.status="답변완료";q.answer=p.answer;q.serverSentAt=now().toISOString();
    trace(next,"실제 고객문의 답변",q.id,now);return {state:next,result:{inquiryId:p.inquiryId}};
  }
  if (job.kind === "refund") {
    const c=next.returnCases.find(c=>c.id===p.caseId);
    if (!c || c.processed || c.reason !== "단순변심" || c.resolution !== "환불" || c.remoteApprovalReady !== true) throw new AutomationError("REFUND_NOT_APPROVED","환불 규칙·상태 확인 필요");
    const remote=await wing.getReturn(p.receiptId);
    if (!remote || String(remote.receiptId)!==p.receiptId || remote.receiptStatus !== "VENDOR_WAREHOUSE_CONFIRM" || remote.preRefund === true || !["단순변심","단순변심(사유없음)"].includes(remote.cancelReasonCategory2) || Number(remote.cancelCountSum ?? remote.cancelCount)!==p.cancelCount) throw new AutomationError("REFUND_NOT_READY","원격 반품이 승인 가능한 상태가 아닙니다");
    await beforeEffect();await wing.approveReturn({...remote,cancelCount:p.cancelCount});
    c.processed=true;c.status="환불승인완료";trace(next,"실제 반품 환불 승인",c.id,now);
    return {state:next,result:{receiptId:p.receiptId}};
  }
  if (job.kind === "receipt") {
    const batch=next.purchaseBatches.find(b=>b.id===p.batchId && b.serverCreated && b.status==="발주완료" && b.suppliers.includes(p.supplierName));
    if(!batch)throw new AutomationError("INVALID_RECEIPT","유효한 발주 묶음이 아닙니다");
    const info=batch.deliveries?.[p.supplierName];
    if(!info)throw new AutomationError("INVALID_RECEIPT","도매처 전달 정보가 없습니다");
    if(info.status!=="자동전송완료")Object.assign(info,{status:"전달완료",sentAt:now().toISOString(),confirmedAt:now().toISOString(),confirmationMode:"supplier-portal"});
    trace(next,"도매처 발주 수신 확인",`${batch.id} · ${p.supplierName}`,now);
    return {state:next,result:{batchId:batch.id,supplierName:p.supplierName}};
  }
  if (job.kind === "inbox") {
    const parsed={fileName:`${p.supplierName}_회신`,fileSupplier:p.supplierName,detectedSupplier:p.supplierName,entries:p.rows.map((r,i)=>({...r,rowNo:i+1}))};
    const result=planInvoiceImport([parsed],next.orders,next.invoices,next.returnCases);
    const values=new Map(result.valid.map(r=>[r.id,r]));
    for(const row of next.invoices) if(values.has(row.id)) Object.assign(row,{carrier:values.get(row.id).carrier,invoice:values.get(row.id).invoice,status:"등록대기",updatedAt:now().toISOString()});
    for(const o of next.orders)if(values.has(o.id))o.invoiceStatus="쿠팡 등록 가능";
    trace(next,"도매처 송장 자동 수신",`${p.supplierName} · ${result.valid.length}건 반영`,now);
    return {state:next,result:result.results[0]};
  }
  throw new AutomationError("UNSUPPORTED_JOB","지원하지 않는 작업");
}
export async function runAutomation({store,wing,sendSupplier,env=process.env,now=()=>new Date(),dryRun=false,syncOnly=false,maxJobs=3}) {
  const owner=crypto.randomUUID(); await store.rpc("lease",{owner});
  try {
    let loaded=await store.load();
    if (!loaded.exists) throw new AutomationError("NO_STATE","먼저 현재 데이터를 서버에 저장하세요");
    let state=init(loaded.state), revision=loaded.revision;
    if (state.settings.apiOutage) return {ok:true,paused:true,reason:"API 장애모드"};
    if (!dryRun && !syncOnly && (!state.settings.serverAutomationEnabled || env.SELLERFLOW_LIVE_AUTOMATION !== "true")) return {ok:true,paused:true,reason:"서버 자동화 꺼짐"};
    if (!dryRun && !syncOnly && state.settings.systemMode !== "실운영") return {ok:true,paused:true,reason:"실운영 모드가 아님"};
    const last=state.settings.serverLastCompleteSyncAt;
    if(last && (!Number.isFinite(Date.parse(last)) || now().getTime()-Date.parse(last)>6*86400000)) throw new AutomationError("SYNC_GAP","마지막 수집 후 6일 이상 지났습니다. 누락 기간을 수동으로 조회한 뒤 수집 기준을 설정하세요");
    const from=kstDate(last?new Date(Date.parse(last)-86400000):new Date(now().getTime()-3*86400000)),to=kstDate(now());
    // Complete reads before committing any snapshot. Failure never erases orders.
    const boxes=[...await wing.listOrders({from,to,status:"ACCEPT"}),...await wing.listOrders({from,to,status:"INSTRUCT"})];
    state=mergeBoxes(state,boxes);
    const inquiries=await wing.listInquiries({from,to});
    for(const q of inquiries){const id=String(q.inquiryId),old=state.inquiries.find(x=>x.inquiryId===id);const mapped={id:`CQ-${id}`,inquiryId:id,source:"coupang",content:String(q.content||""),createdAt:q.inquiryAt,status:q.commentDtoList?.length?"답변완료":"답변대기",orderId:state.orders.find(o=>(q.orderIds||[]).map(String).includes(o.coupangOrderId))?.id||"",product:state.orders.find(o=>o.coupangVendorItemId===String(q.vendorItemId))?.product||"상품문의",deadline:"확인 필요"};if(old){if(old.serverSentAt&&!q.commentDtoList?.length)mapped.status="답변완료";Object.assign(old,mapped);}else state.inquiries.push(mapped);}
    state.settings.apiLastSyncAt=now().toISOString();state.settings.wingStatus="실제 주문·문의 수집";
    const returns=await wing.listReturns({from,to});
    for(const r of returns) {
      const receiptId=String(r.receiptId), old=state.returnCases.find(c=>c.receiptId===receiptId);
      const linked=state.orders.filter(o=>o.coupangOrderId===String(r.orderId) && (r.returnItems||[]).some(i=>String(i.vendorItemId)===o.coupangVendorItemId));
      const simple=["단순변심(사유없음)","단순변심"].includes(r.cancelReasonCategory2);
      const finished=r.receiptStatus==="RETURNS_COMPLETED";
      const mapped={id:old?.id||`CR-${receiptId}`,receiptId,source:"coupang",orderId:linked.length===1?linked[0].id:"",linkedOrderIds:linked.map(o=>o.id),product:linked.map(o=>o.product).join(", "),customer:r.requesterName||"",caseType:r.receiptType==="CANCEL"?"취소":"반품",reason:simple?"단순변심":"수동검토",remoteStatus:r.receiptStatus,cancelCount:Number(r.cancelCountSum),createdAt:r.createdAt,status:finished?"환불완료":"실제 반품 확인 필요",processed:finished,supplier:linked.length===1?linked[0].supplier:"수동 확인",remoteApprovalReady:simple && linked.length===1 && r.receiptStatus==="VENDOR_WAREHOUSE_CONFIRM" && !r.preRefund && state.settings.serverSimpleRefund===true,resolution:simple?"환불":""};
      if(old){const preserve={evidence:old.evidence,evidenceImages:old.evidenceImages,reviewNote:old.reviewNote};if(old.processed && old.status==="환불승인완료"&&!finished){mapped.processed=true;mapped.status=old.status;}Object.assign(old,mapped,preserve);}else state.returnCases.push(mapped);
    }
    state.settings.serverLastCompleteSyncAt=now().toISOString();
    const plan=planJobs(state,now());
    if(syncOnly){const saved=await store.save(state,revision,owner);return{ok:true,synced:true,revision:saved.revision};}
    if(dryRun)return{ok:true,dryRun:true,planned:plan.jobs.map(j=>({kind:j.kind,orderId:j.payload.orderId||j.payload.inquiryId||j.payload.caseId})),blocked:plan.blocked};
    revision=(await store.save(state,revision,owner)).revision;
    for(const job of plan.jobs){try{await store.rpc("enqueue",{owner,job});}catch(e){if(e.code!=="INTENT_CONFLICT")throw e;plan.blocked.push({id:job.payload.orderId||job.payload.inquiryId||job.payload.caseId,issues:["기존 작업과 요청 내용이 다릅니다. 이전 처리 결과 확인 필요"]});}}
    const priority={receipt:0,inbox:1,refund:2,reply:3,invoice:4,purchase:5};
    const pending=(await store.jobs(true)).filter(j=>j.status==="queued").sort((a,b)=>priority[a.kind]-priority[b.kind]);
    const completed=[];const started=Date.now();
    for(const candidate of pending.slice(0,Math.min(5,maxJobs))){
      if(Date.now()-started>20000)break;
      const job=(await store.rpc("claim",{owner,job:{id:candidate.id}})).job;if(!job)continue;
      // DB lease is rechecked immediately before each external write.
      const beforeEffect=()=>store.rpc("renew",{owner});
      try {
        if (job.kind === "purchase") {
          const order=state.orders.find(o=>o.id===job.payload.orderId),product=order&&matchProduct(order,state.products);
          if(!order||purchaseIssues(order,state,now()).length)throw new AutomationError("STALE_ORDER","최신 발주 조건 확인 필요");
          state.settings.serverCostReservations ||= {};
          state.settings.serverCostReservations[job.id]={date:kstDate(now()),cost:Number(product.cost)*order.qty+Number(product.shippingCost||0)};
          revision=(await store.save(state,revision,owner)).revision;
        }
        const output=await executeJob(job,state,{wing,sendSupplier,now,beforeEffect});
        const finished=await store.rpc("finish",{owner,revision,data:output.state,job:{id:job.id,status:"succeeded",result:output.result}});
        state=output.state;revision=finished.revision;completed.push({id:job.id,status:"succeeded"});
      } catch(error) {
        const status=error.ambiguous || !error.code || /^DB_|LEASE_|REVISION_/.test(error.code)?"needs_review":"failed";
        // If success was sent but the DB acknowledgement was lost, finish cannot be repeated as a write to Coupang.
        try {
          if (status === "failed" && job.kind === "purchase") {
            const released=copy(state);delete (released.settings.serverCostReservations || {})[job.id];
            const result=await store.rpc("finish",{owner,revision,data:released,job:{id:job.id,status,result:{code:error.code,message:String(error.message).slice(0,240)}}});state=released;revision=result.revision;
          } else await store.rpc("finish",{owner,job:{id:job.id,status,result:{code:error.code||"UNEXPECTED_ERROR",message:String(error.message).slice(0,240)}}});
        } catch { throw new AutomationError("PERSISTENCE_UNKNOWN","처리 결과 저장 확인 필요"); }
        completed.push({id:job.id,status});
      }
    }
    return{ok:true,dryRun:false,completed,blocked:plan.blocked,revision};
  } finally { await store.rpc("release",{owner}).catch(()=>{}); }
}
