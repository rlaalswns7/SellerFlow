export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "POST만 지원합니다."
    });
  }

  const {
    batchId,
    supplierName,
    recipientId,
    channel,
    fileName,
    message,
    orderCount
  } = req.body || {};

  if (!batchId || !supplierName || !fileName) {
    return res.status(400).json({
      ok: false,
      message: "필수 정보가 없습니다."
    });
  }

  return res.status(200).json({
    ok: true,
    message: "테스트 발주서 수신 성공",
    received: {
      batchId,
      supplierName,
      recipientId: recipientId || "",
      channel: channel || "",
      fileName,
      orderCount: Number(orderCount || 0),
      hasMessage: Boolean(message)
    }
  });
}
