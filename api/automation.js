import crypto from "node:crypto";
import XLSX from "xlsx-js-style";
import { requireAuth, sameOrigin } from "./_auth.js";
import { createStore } from "../server/store.js";
import { createWing, AutomationError } from "../server/wing.js";
import { runAutomation, createSupplierSender, jobId, supplierFile } from "../server/engine.js";
import { parseInvoiceFile, validateBackup } from "../src/reliability.js";

export const config = { maxDuration: 60 };
const equalSecret = (a,b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length > 1024 || !b) return false;
  const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && crypto.timingSafeEqual(x,y);
};
export function createAutomationHandler({env=process.env,store=createStore({env}),wing=createWing({env}),sender=createSupplierSender({env})}={}) {
  return async (req,res) => {
    res.setHeader?.("Cache-Control","no-store");
    const action=String(req.query?.action || "status");
    if(req.method==="GET" && action==="health") return res.status(200).json({ok:true,runtimeEnabled:env.SELLERFLOW_RUNTIME_ENABLED==="true",liveEnabled:env.SELLERFLOW_LIVE_AUTOMATION==="true",dbConfigured:Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY),wingConfigured:Boolean(env.COUPANG_VENDOR_ID&&env.COUPANG_ACCESS_KEY&&env.COUPANG_SECRET_KEY),supplierConfigured:env.SELLERFLOW_SUPPLIER_DELIVERY_MODE==="portal"?Boolean(env.SELLERFLOW_SUPPLIER_KEYS_JSON):Boolean(env.SELLERFLOW_PURCHASE_WEBHOOK_URL&&env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN)});
    if(env.SELLERFLOW_RUNTIME_ENABLED!=="true")return res.status(503).json({ok:false,code:"RUNTIME_DISABLED",message:"서버 자동화 런타임이 꺼져 있습니다"});
    const isCron=action==="run" && req.method==="POST" && equalSecret(String(req.headers?.authorization||""),`Bearer ${env.SELLERFLOW_CRON_SECRET||""}`) && Boolean(env.SELLERFLOW_CRON_SECRET);
    const isInbox=["inbox","supplier-list","supplier-file","supplier-ack"].includes(action) && req.method==="POST";
    if(!isCron && !isInbox){if(!sameOrigin(req))return res.status(403).json({ok:false,code:"BAD_ORIGIN"});if(!requireAuth(req,res))return;}
    try {
      if(action==="state" && req.method==="GET")return res.status(200).json(await store.load());
      if(action==="state" && req.method==="PUT"){
        const {data,revision}=req.body||{};validateBackup(data);
        if(!Number.isSafeInteger(revision)||revision<0)throw new AutomationError("INVALID_REVISION","서버 버전이 필요합니다");
        const saved=await store.save(data,revision);return res.status(200).json({ok:true,...saved});
      }
      if(action==="status" && req.method==="GET"){
        const loaded=await store.load(),jobs=await store.jobs();
        return res.status(200).json({ok:true,exists:loaded.exists,revision:loaded.revision,updatedAt:loaded.updatedAt,lastSyncAt:loaded.state?.settings?.apiLastSyncAt||"",enabled:Boolean(loaded.state?.settings?.serverAutomationEnabled),jobs:jobs.slice(0,50).map(({id,kind,status,result,attempts,updated_at})=>({id,kind,status,result,attempts,updated_at}))});
      }
      if(action==="sync" && req.method==="POST")return res.status(200).json(await runAutomation({store,wing,sendSupplier:sender,env,syncOnly:true}));
      if(action==="run" && req.method==="POST")return res.status(200).json(await runAutomation({store,wing,sendSupplier:sender,env,dryRun:!isCron && req.body?.dryRun!==false,maxJobs:2}));
      if(action==="retry" && req.method==="POST"){
        if(!/^[a-f0-9]{64}$/.test(req.body?.id||""))throw new AutomationError("INVALID_JOB","작업 ID 오류");
        const owner=crypto.randomUUID();await store.rpc("lease",{owner});
        try{return res.status(200).json(await store.rpc("retry_failed",{owner,job:{id:req.body.id}}));}finally{await store.rpc("release",{owner}).catch(()=>{});}
      }
      if(isInbox){
        const body=req.body||{};
        let keys;try{keys=JSON.parse(env.SELLERFLOW_SUPPLIER_KEYS_JSON||"{}");}catch{throw new AutomationError("NOT_CONFIGURED","도매처 수신 키 설정 오류");}
        if(typeof body.supplierName!=="string" || !equalSecret(req.headers?.["x-sellerflow-supplier-key"],keys[body.supplierName]))return res.status(401).json({ok:false,code:"SUPPLIER_AUTH_REQUIRED"});

        const current=await store.load();if(!current.exists)throw new AutomationError("NO_STATE","서버 데이터가 없습니다");
        if(!current.state.suppliers.some(s=>s.name===body.supplierName&&s.active))throw new AutomationError("INVALID_SUPPLIER","활성 도매처가 아닙니다");
        if(action==="supplier-list") {
          const batches=current.state.purchaseBatches.filter(b=>b.serverCreated&&b.status==="발주완료"&&b.suppliers?.includes(body.supplierName)).slice(0,100).map(b=>({id:b.id,createdAt:b.createdAt,status:b.deliveries?.[body.supplierName]?.status||"도매처확인대기",orderCount:b.orderIds.length}));
          const uploads=(await store.jobs()).filter(j=>j.kind==="inbox"&&j.payload?.supplierName===body.supplierName).map(({status,result})=>({status,result}));
          return res.status(200).json({ok:true,batches,uploads});
        }
        if(action==="supplier-file" || action==="supplier-ack") {
          const batch=current.state.purchaseBatches.find(b=>b.id===body.batchId&&b.serverCreated&&b.status==="발주완료"&&b.suppliers?.includes(body.supplierName));
          if(!batch)throw new AutomationError("INVALID_BATCH","접근할 수 없는 발주입니다");
          if(action==="supplier-file") {
            if(!batch.supplierExport || batch.supplierExport.order.supplier!==body.supplierName)throw new AutomationError("INVALID_BATCH","보관한 발주서 정보가 없습니다");
            const frozen=batch.supplierExport;
            const exported=supplierFile(frozen.order,{suppliers:current.state.suppliers.filter(s=>s.name===body.supplierName),products:[{name:frozen.order.product,option:frozen.order.option,supplierProductName:frozen.productName}],settings:{senderName:frozen.senderName,senderPhone:frozen.senderPhone,senderAddress:frozen.senderAddress}});
            return res.status(200).json({ok:true,fileName:exported.fileName,fileBase64:exported.fileBase64});
          }
          const owner=crypto.randomUUID();await store.rpc("lease",{owner});
          try {await store.rpc("enqueue",{owner,job:{id:jobId("receipt",`${batch.id}:${body.supplierName}`),kind:"receipt",payload:{batchId:batch.id,supplierName:body.supplierName}}});return res.status(202).json({ok:true,accepted:true});}finally{await store.rpc("release",{owner}).catch(()=>{});}
        }
        if(typeof body.eventId!=="string"||!body.eventId||body.eventId.length>160)throw new AutomationError("INVALID_EVENT","고유 회신 eventId가 필요합니다");
        let rows;
        if(body.fileBase64){
          if(typeof body.fileBase64!=="string"||body.fileBase64.length>3*1024*1024)throw new AutomationError("FILE_TOO_LARGE","송장 파일 크기 초과");
          const bytes=Buffer.from(body.fileBase64,"base64");
          const parsed=await parseInvoiceFile({name:String(body.fileName||"송장.xlsx"),size:bytes.length,arrayBuffer:async()=>bytes},XLSX,current.state.suppliers.filter(s=>s.name===body.supplierName));
          rows=parsed.entries.map(r=>({id:r.id,carrier:r.carrier,invoice:r.invoice,...(r.parseError?{parseError:r.parseError}:{})}));
        }else{
          if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>1000)throw new AutomationError("INVALID_ROWS","송장 행은 1~1000개여야 합니다");
          rows=body.rows.map(r=>{if(!r||typeof r.id!=="string"||typeof r.carrier!=="string"||typeof r.invoice!=="string")throw new AutomationError("INVALID_ROWS","송장 ID·택배사·번호는 텍스트여야 합니다");return{id:r.id,carrier:r.carrier,invoice:r.invoice};});
        }
        const owner=crypto.randomUUID();await store.rpc("lease",{owner});
        try{const queued=await store.rpc("enqueue",{owner,job:{id:jobId("inbox",`${body.supplierName}:${body.eventId}`),kind:"inbox",payload:{supplierName:body.supplierName,rows}}});return res.status(202).json({ok:true,accepted:true,eventId:body.eventId,status:queued.job.status});}finally{await store.rpc("release",{owner}).catch(()=>{});}
      }
      return res.status(405).json({ok:false,code:"METHOD_NOT_ALLOWED"});
    }catch(error){
      const code=error.code||"AUTOMATION_FAILED";
      const status=["BUSY","REVISION_CONFLICT","LEASE_LOST","INTENT_CONFLICT","NOT_RETRYABLE"].includes(code)?409:/^INVALID_|FILE_TOO|BAD_ORDER/.test(code)?400:503;
      return res.status(status).json({ok:false,code,message:error instanceof AutomationError?error.message:"데이터 형식·서버 설정·작업 기록을 확인하세요"});
    }
  };
}
export default createAutomationHandler();
