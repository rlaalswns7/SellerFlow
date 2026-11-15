import { validateBackup } from "../src/reliability.js";
import { requireAuth, sameOrigin } from "./_auth.js";

const STATE_ID = "main";
const MAX_STATE_BYTES = 2500000;

function config() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    key: String(process.env.SUPABASE_SECRET_KEY || ""),
  };
}

function headers(key, extra = {}) {
  const base = {
    apikey: key,
    "Content-Type": "application/json",
    ...extra,
  };

  // 구형 service_role JWT일 때만 Authorization 사용
  if (!String(key).startsWith("sb_secret_")) {
    base.Authorization = `Bearer ${key}`;
  }

  return base;
}

export default async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "GET/PUT만 지원합니다.",
    });
  }

  if (!requireAuth(req, res)) return;
  if (process.env.SELLERFLOW_RUNTIME_ENABLED === "true") return res.status(409).json({ ok: false, code: "USE_RUNTIME", message: "서버 자동화 모드에서는 최신 화면과 런타임 API를 사용하세요." });

  if (req.method === "PUT" && !sameOrigin(req)) {
    return res.status(403).json({
      ok: false,
      code: "BAD_ORIGIN",
      message: "허용되지 않은 요청입니다.",
    });
  }

  const { url, key } = config();

  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      code: "DB_NOT_CONFIGURED",
      message: "Supabase 환경변수가 아직 연결되지 않았습니다.",
    });
  }

  try {
    if (req.method === "GET") {
      const upstream = await fetch(
        `${url}/rest/v1/sellerflow_state?id=eq.${STATE_ID}&select=data,version,updated_at&limit=1`,
        { headers: headers(key) }
      );

      const raw = await upstream.text();
      let rows = [];

      try {
        rows = raw ? JSON.parse(raw) : [];
      } catch { throw new Error("서버 백업 응답이 JSON이 아닙니다"); }

      if (!upstream.ok) {
        return res.status(502).json({
          ok: false,
          code: "DB_READ_FAILED",
          message: "서버 저장 데이터를 읽지 못했습니다.",
        });
      }

      if (!Array.isArray(rows)) throw new Error("서버 백업 목록 형식 오류");
      const row = rows[0];
      if (row) validateBackup(row.data);

      return res.status(200).json({
        ok: true,
        exists: Boolean(row),
        state: row?.data || null,
        version: Number(row?.version || 0),
        updatedAt: row?.updated_at || "",
      });
    }

       const data = req.body?.data;
    const version = Number(req.body?.version || 1);
    try { validateBackup(data); if (!Number.isSafeInteger(version) || version < 1 || version > 7) throw new Error(); }
    catch { return res.status(400).json({ ok: false, code: "INVALID_STATE", message: "백업 데이터 또는 버전 형식 오류" }); }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_STATE",
        message: "저장할 SellerFlow 데이터가 올바르지 않습니다.",
      });
    }

    const serialized = JSON.stringify(data);

    if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
      return res.status(413).json({
        ok: false,
        code: "STATE_TOO_LARGE",
        message: "서버 백업 데이터가 너무 큽니다.",
      });
    }

    const updatedAt = new Date().toISOString();

    const upstream = await fetch(
      `${url}/rest/v1/sellerflow_state?on_conflict=id`,
      {
        method: "POST",
        headers: headers(key, {
          Prefer: "resolution=merge-duplicates,return=representation",
        }),
        body: JSON.stringify([
          {
            id: STATE_ID,
            data,
            version,
            updated_at: updatedAt,
          },
        ]),
      }
    );

    if (!upstream.ok) {
      const raw = await upstream.text();

      return res.status(502).json({
        ok: false,
        code: "DB_WRITE_FAILED",
        message: "서버 백업 저장에 실패했습니다.",
        detail: raw.slice(0, 300),
      });
    }

    return res.status(200).json({
      ok: true,
      message: "서버 백업 저장 완료",
      updatedAt,
      version,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: "DB_ERROR",
      message: error?.message || "데이터베이스 연결 오류",
    });
  }
}

