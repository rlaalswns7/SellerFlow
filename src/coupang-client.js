export async function getCoupangHealth() {
  const response = await fetch("/api/coupang-health", { credentials: "same-origin" });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.message || `쿠팡 API 상태 확인 실패 (${response.status})`);
    error.code = data?.code || "COUPANG_HEALTH_FAILED";
    throw error;
  }
  return data;
}

export async function fetchCoupangOrders({ createdAtFrom = "", createdAtTo = "", status = "", maxPerPage = 50 } = {}) {
  const params = new URLSearchParams();
  if (createdAtFrom) params.set("createdAtFrom", createdAtFrom);
  if (createdAtTo) params.set("createdAtTo", createdAtTo);
  if (status) params.set("status", status);
  params.set("maxPerPage", String(maxPerPage));

  const response = await fetch(`/api/coupang-orders?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.message || `쿠팡 주문 조회 실패 (${response.status})`);
    error.code = data?.code || "COUPANG_ORDER_SYNC_FAILED";
    throw error;
  }
  return data;
}
