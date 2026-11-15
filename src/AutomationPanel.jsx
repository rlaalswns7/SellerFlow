import React,{useEffect,useState} from "react";

export default function AutomationPanel({settings,setSettings}) {
  const [status,setStatus]=useState({}),[jobs,setJobs]=useState([]),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const refresh=async()=>{const bridge=window.SellerFlowRuntime;setStatus(bridge?.getStatus()||{error:window.__sellerFlowSyncError||"서버 런타임 설정 전입니다"});if(!bridge?.enabled)return;try{const r=await fetch("/api/automation?action=status",{credentials:"same-origin"});const d=await r.json();if(r.ok&&d.ok)setJobs(d.jobs||[]);}catch{}};
  useEffect(()=>{refresh();const handler=()=>refresh();window.addEventListener("sellerflow-runtime-status",handler);return()=>window.removeEventListener("sellerflow-runtime-status",handler);},[]);
  const work=async(fn)=>{if(busy)return;setBusy(true);setMessage("");try{await fn();await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
  const bridge=window.SellerFlowRuntime;
  return <div className="panel"><h2>서버 자동화</h2><p>서버에서 주문·문의·반품을 수집하고 발주·송장·승인한 답변을 처리합니다. 화면을 닫아도 예약 작업은 서버에서 실행됩니다.</p>
    <p role="status">{status.error||`서버 동기화 ${status.paused?"일시 중지":"연결됨"} · 버전 ${status.revision??"-"}`}</p>
    <div className="formGrid">
      <label>서버 자동화<select value={settings.serverAutomationEnabled?"켜기":"끄기"} onChange={e=>setSettings(s=>({...s,serverAutomationEnabled:e.target.value==="켜기"}))}><option>끄기</option><option>켜기</option></select></label>
      <label>일일 발주 원가 한도(원)<input type="number" min="0" value={settings.serverDailyCostLimit||0} onChange={e=>setSettings(s=>({...s,serverDailyCostLimit:Number(e.target.value)}))}/></label>
      <label>단순변심 환불 승인<select value={settings.serverSimpleRefund?"입고완료 건 자동 승인":"수동 확인"} onChange={e=>setSettings(s=>({...s,serverSimpleRefund:e.target.value==="입고완료 건 자동 승인"}))}><option>수동 확인</option><option>입고완료 건 자동 승인</option></select></label>
    </div>
    <div className="formActions left">
      <button className="secondary" disabled={busy} onClick={()=>work(refresh)}>상태 새로고침</button>
      <button className="secondary" disabled={busy||!bridge?.enabled} onClick={()=>work(()=>bridge.saveNow({initialize:true}))}>현재 데이터를 서버에 저장</button>
      <button className="secondary" disabled={busy||!bridge?.enabled} onClick={()=>work(()=>bridge.restoreNow())}>최신 서버 데이터 불러오기</button>
      <button className="primary" disabled={busy||!bridge?.enabled} onClick={()=>work(async()=>setReport(await bridge.run(true)))}>외부 전송 없이 점검</button>
    </div>
    {message&&<p className="dangerText" role="alert">{message}</p>}
    {report&&<div><p>처리 예정 {report.planned?.length||0}건 · 확인 필요 {report.blocked?.length||0}건</p>{report.blocked?.slice(0,10).map(r=><p key={r.id}>{r.id}: {r.issues.join(" · ")}</p>)}</div>}
    <p><a href="/supplier.html" target="_blank" rel="noopener noreferrer">도매처 전용 페이지 열기</a> · 도매처가 이 페이지를 사용하기로 한 경우 주소와 전용 접속 키를 따로 전달하세요.</p>
    <p className="securityNote">일일 한도 0원은 자동발주 중지입니다. 실제 동작에는 서버 환경변수와 예약 실행 설정이 필요합니다. ‘결과확인필요’ 작업은 중복 전송을 막기 위해 자동 재시도하지 않습니다.</p>
    {jobs.length>0&&<div className="table"><table><thead><tr><th>작업</th><th>상태</th><th>시도</th><th>결과</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id}><td>{j.kind}</td><td>{({needs_review:"결과확인필요",failed:"실패",queued:"대기",running:"처리 중",succeeded:"성공",cancelled:"취소"})[j.status]||j.status}</td><td>{j.attempts}</td><td>{j.result?.message||j.result?.code||"-"}</td></tr>)}</tbody></table></div>}
  </div>;
}
