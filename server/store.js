import { AutomationError, parseLosslessJson } from "./wing.js";
import { validateBackup } from "../src/reliability.js";

export function createStore({ env = process.env, fetchImpl = fetch } = {}) {
  async function request(resource, body) {
    const base = String(env.SUPABASE_URL || "").replace(/\/+$/, ""), key = env.SUPABASE_SECRET_KEY;
    if (!base.startsWith("https://") || !key) throw new AutomationError("DB_NOT_CONFIGURED", "Supabase 서버 설정이 필요합니다");
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
    const response = await fetchImpl(`${base}/rest/v1/${resource}`, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    let data;
    try { data = parseLosslessJson(await response.text()); } catch { throw new AutomationError("DB_BAD_RESPONSE", "DB 응답 형식 오류"); }
    if (!response.ok) throw new AutomationError("DB_FAILED", "DB 연결 또는 런타임 SQL 적용 상태를 확인하세요");
    return data;
  }
  async function rpc(action, { owner = null, revision = null, data = null, job = null } = {}) {
    if (data !== null) validateBackup(data);
    const value = await request("rpc/sf_runtime_rpc", { p_action: action, p_owner: owner, p_revision: revision, p_data: data, p_job: job });
    if (value?.ok !== true) throw new AutomationError(value?.code || "DB_FAILED", value?.code === "REVISION_CONFLICT" ? "서버 데이터가 변경됐습니다. 최신 상태를 불러오세요" : "런타임 작업을 잠시 실행할 수 없습니다: " + (value?.code || "응답 확인 필요"));
    return value;
  }
  return {
    rpc,
    async load() { const r = await rpc("load"); if (r.exists) validateBackup(r.state); return r; },
    save: (data, revision, owner = null) => rpc("save", { data, revision, owner }),
    jobs: async (pendingOnly = false) => { const data = await request("sellerflow_jobs?select=id,kind,status,payload,result,attempts,updated_at,created_at&" + (pendingOnly ? "status=eq.queued&order=created_at.asc&limit=100" : "order=created_at.desc&limit=50")); if (!Array.isArray(data)) throw new AutomationError("DB_BAD_RESPONSE", "작업 목록 형식 오류"); return data; }
  };
}
