import { validateBackup } from "./reliability.js";
const PREFIX = "sellerflow_v2_";
const KEYS = {orders:"orders",products:"products",suppliers:"suppliers",invoices:"invoices",purchaseBatches:"purchase_batches",purchaseDispatches:"purchase_dispatches",inquiries:"cs_inquiries",returnCases:"cs_returns",csLogs:"cs_logs",invoiceLogs:"invoice_logs",activityLogs:"activity_logs",notifications:"notifications",marketingLogs:"marketing_logs",settings:"settings"};
export function fingerprint(data) {
  const pick=Object.fromEntries(Object.keys(KEYS).map(k=>[k,data[k]??(k==="settings"?{}:[])]));
  // Ignore timestamps added during export, but preserve all operational data and evidence.
  return JSON.stringify(pick);
}
export async function startRuntimeSync() {
  const originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
  const snapshot=()=>{const d={version:7};for(const [key,local]of Object.entries(KEYS)){const raw=localStorage.getItem(PREFIX+local);d[key]=raw?JSON.parse(raw):(key==="settings"?{}:[]);}return d;};
  let revision=null,accepted="",saving=false,paused=true,suppress=false,timer,error="서버 연결 확인 중",health={runtimeEnabled:true};
  const notify=()=>window.dispatchEvent(new CustomEvent("sellerflow-runtime-status"));
  const bridge={enabled:true,getStatus:()=>({revision,paused,saving,error,health}),saveNow,restoreNow,run,check,syncNow};
  window.SellerFlowRuntime=bridge;
  async function request(action,method="GET",body){
    const response=await fetch(`/api/automation?action=${action}`,{method,credentials:"same-origin",headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(70000)});
    let d;try{d=await response.json();}catch{throw new Error("서버 JSON 응답 확인 필요");}
    if(!response.ok||d?.ok!==true){const e=new Error(d?.message||`서버 연결 오류 (${response.status})`);e.code=d?.code;throw e;}return d;
  }
  function backupLocal(){
    const key="sellerflow_runtime_before_restore_"+Date.now();
    // A quota failure stops restoration instead of discarding unsaved work.
    originalSet.call(localStorage,key,JSON.stringify(snapshot()));
  }
  function adopt(remote){
    validateBackup(remote.state);
    const previous=snapshot();suppress=true;
    try{for(const [key,local]of Object.entries(KEYS))originalSet.call(localStorage,PREFIX+local,JSON.stringify(remote.state[key]??(key==="settings"?{}:[])));}
    catch(e){for(const [key,local]of Object.entries(KEYS))originalSet.call(localStorage,PREFIX+local,JSON.stringify(previous[key]));throw e;}
    revision=remote.revision;accepted=fingerprint(snapshot());paused=false;error="";
    window.dispatchEvent(new CustomEvent("sellerflow-server-state",{detail:remote.state}));
    // Effects produced by the remote state must not turn into an immediate overwrite.
    setTimeout(()=>{suppress=false;notify();},0);
  }
  async function check(){
    try{
      health=await request("health");
      if(!health.runtimeEnabled){bridge.enabled=false;paused=true;error="서버 자동화 설정 전입니다";notify();return false;}
      const remote=await request("state");
      if(!remote.exists){revision=remote.revision;paused=true;error="초기 설정: 현재 데이터를 서버에 저장해주세요";notify();return false;}
      const local=snapshot(),hasLocal=localStorage.getItem(PREFIX+"orders")!==null;
      if(!hasLocal){adopt(remote);return true;}
      if(revision===null){
        if(fingerprint(local)===fingerprint(remote.state)){revision=remote.revision;accepted=fingerprint(local);paused=false;error="";}
        else{paused=true;error="브라우저와 서버 데이터가 다릅니다. 백업 후 사용할 데이터를 선택해주세요";}
      }else if(remote.revision!==revision){
        if(fingerprint(local)!==accepted||saving){paused=true;error="동시 편집 충돌입니다. 현재 JSON을 백업하고 최신 서버 데이터를 불러오세요";}
        else adopt(remote);
      }
      notify();return !paused;
    }catch(e){error=e.message;notify();return false;}
  }
  async function saveNow({initialize=false}={}){
    if(saving)throw new Error("서버에 저장 중입니다");
    if(paused&&!initialize)throw new Error(error||"서버 동기화가 중지됐습니다");
    if(initialize){const remote=await request("state");if(remote.exists&&!window.confirm("현재 브라우저 데이터로 서버 데이터를 교체할까요? 서버 변경 내용을 먼저 백업해주세요."))return false;revision=remote.revision;}
    const state=snapshot(),serialized=fingerprint(state);
    if(serialized===accepted&&!paused)return true;
    saving=true;notify();
    try{const saved=await request("state","PUT",{data:state,revision});revision=saved.revision;accepted=serialized;paused=false;error="";return true;}
    catch(e){paused=true;error=e.message;throw e;}
    finally{saving=false;notify();}
  }
  async function restoreNow(){
    if(!window.confirm("현재 브라우저 데이터를 백업하고 최신 서버 데이터를 불러올까요?"))return false;
    backupLocal();const remote=await request("state");if(!remote.exists)throw new Error("서버 데이터가 없습니다");adopt(remote);return true;
  }
  async function syncNow(){await saveNow();const result=await request("sync","POST",{});await check();return result;}
  async function run(dryRun=true){await saveNow();const result=await request("run","POST",{dryRun});await check();return result;}
  function schedule(){if(paused||suppress)return;clearTimeout(timer);timer=setTimeout(()=>saveNow().catch(()=>{}),1200);}
  Storage.prototype.setItem=function(key,value){originalSet.call(this,key,value);if(this===localStorage&&Object.values(KEYS).some(k=>PREFIX+k===key))schedule();};
  Storage.prototype.removeItem=function(key){originalRemove.call(this,key);if(this===localStorage&&Object.values(KEYS).some(k=>PREFIX+k===key))schedule();};
  window.addEventListener("storage",event=>{if(event.key?.startsWith(PREFIX)){paused=true;error="다른 탭에서 변경됐습니다. 백업 후 최신 상태를 불러오세요";notify();}});
  setInterval(()=>{if(document.visibilityState!=="hidden")check();},10000);
  await check();return bridge;
}
