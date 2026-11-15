// Initialize cloud data before React reads local storage.
try {
  const response=await fetch("/api/automation?action=health",{signal:AbortSignal.timeout(8000)});
  if(response.ok){
    const info=await response.json();
    if(info.runtimeEnabled)await (await import("./runtime-sync.js")).startRuntimeSync();
    else await import("../server-sync.js");
  }else if(response.status===404)await import("../server-sync.js");
  else window.__sellerFlowSyncError="서버 연결 상태를 확인하지 못했습니다. 자동 저장을 시작하지 않았습니다.";
}catch{window.__sellerFlowSyncError="서버에 연결할 수 없습니다. 현재 변경은 이 브라우저에만 남습니다.";}
await import("./main.jsx");
