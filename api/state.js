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
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
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
      } catch {}

      if (!upstream.ok) {
        return res.status(502).json({
          ok: false,
          code: "DB_READ_FAILED",
          message: "서버 저장 데이터를 읽지 못했습니다.",
        });
      }

      const row = Array.isArray(rows) ? rows[0] : null;

      return res.status(200).json({
        ok: true,
        exists: Boolean(row),
        state: row?.data || null,
        version: Number(row?.version || 0),
        updatedAt: row?.updated_at || "",
      });
    }

    const data = req.body?.data;
    const version =
