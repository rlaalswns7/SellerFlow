import crypto from "node:crypto";

const COOKIE_NAME = "sellerflow_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

function secret() {
  return process.env.SELLERFLOW_SESSION_SECRET || process.env.SELLERFLOW_ADMIN_PASSWORD || "";
}

export function authConfigured() {
  return Boolean(process.env.SELLERFLOW_ADMIN_PASSWORD && secret());
}

function sameText(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function signature(expires) {
  return crypto.createHmac("sha256", secret()).update(String(expires)).digest("base64url");
}

function parseCookies(req) {
  const raw = String(req.headers?.cookie || "");
  return Object.fromEntries(raw.split(";").map((part) => {
    const i = part.indexOf("=");
    if (i < 0) return ["", ""];
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([key]) => key));
}

export function validPassword(value) {
  const expected = process.env.SELLERFLOW_ADMIN_PASSWORD || "";
  return Boolean(expected) && sameText(value, expected);
}

export function createSessionValue() {
  const expires = Date.now() + SESSION_MS;
  return `${expires}.${signature(expires)}`;
}

export function verifySession(req) {
  if (!authConfigured()) return false;
  const value = parseCookies(req)[COOKIE_NAME] || "";
  const [expiresRaw, sig = ""] = value.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;
  return sameText(sig, signature(expires));
}

export function sessionCookie(value, req, maxAge = 43200) {
  const host = String(req.headers?.host || "");
  const secure = host.includes("localhost") ? "" : "; Secure";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function requireAuth(req, res) {
  if (!authConfigured()) {
    res.status(503).json({ ok: false, code: "AUTH_NOT_CONFIGURED", message: "SellerFlow 관리자 비밀번호 환경변수가 설정되지 않았습니다." });
    return false;
  }
  if (!verifySession(req)) {
    res.status(401).json({ ok: false, code: "AUTH_REQUIRED", message: "자동전송 잠금 해제가 필요합니다." });
    return false;
  }
  return true;
}

export function sameOrigin(req) {
  const origin = String(req.headers?.origin || "");
  if (!origin) return true;
  const host = String(req.headers?.host || "");
  try { return new URL(origin).host === host; } catch { return false; }
}
