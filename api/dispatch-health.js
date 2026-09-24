export default function handler(req, res) {
  const configured = Boolean(process.env.SELLERFLOW_PURCHASE_WEBHOOK_URL);
  res.status(200).json({
    ok: true,
    configured,
    provider: configured ? "webhook" : "none"
  });
}
