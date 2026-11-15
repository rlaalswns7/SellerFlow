async function requestJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error("서버가 JSON 대신 잘못된 응답을 보냈습니다. 로그인·배포 상태를 확인하세요."); }
    if (!response.ok || data?.ok !== true) {
      const error = new Error(data?.message || `쿠팡 API 요청 실패 (${response.status})`);
      error.code = data?.code || "COUPANG_REQUEST_FAILED";
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}
export async function getCoupangHealth() { return requestJson("/api/coupang-health"); }

export async function fetchCoupangOrders({ createdAtFrom = "", createdAtTo = "", status = "", maxPerPage = 50 } = {}) {
  const params = new URLSearchParams();
  if (createdAtFrom) params.set("createdAtFrom", createdAtFrom);
  if (createdAtTo) params.set("createdAtTo", createdAtTo);
  if (status) params.set("status", status);
  params.set("maxPerPage", String(maxPerPage));

  const data = await requestJson(`/api/coupang-orders?${params.toString()}`);
  if (!Array.isArray(data.orders) || data.orders.some(o => !o || typeof o.id !== "string" || !o.id)) throw new Error("주문 응답 형식이 올바르지 않습니다");
  return data;
}

