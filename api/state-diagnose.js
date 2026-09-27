import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "");

  if (!url || !key) {
    return res.status(200).json({
      ok: false,
      step: "environment",
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
    });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/sellerflow_state?on_conflict=id`,
      {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([{
          id: "__diagnose__",
          data: { test: true },
          version: 1,
          updated_at: new Date().toISOString(),
        }]),
      }
    );

    const text = await response.text();

    return res.status(200).json({
      ok: response.ok,
      step: "database-write",
      status: response.status,
      result: text.slice(0, 500),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      step: "request-error",
      message: error?.message || String(error),
    });
  }
}
