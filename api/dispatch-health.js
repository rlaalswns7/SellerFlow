import { authConfigured } from "./_auth.js";

export default function handler(req, res) {
  const configured = Boolean(process.env.SELLERFLOW_PURCHASE_WEBHOOK_URL);
  const webhookTokenConfigured = Boolean(process.env.SELLERFLOW_PURCHASE_WEBHOOK_TOKEN);
  res.status(200).json({
    ok: true,
    configured,
    provider: configured ? "webhook" : "none",
    authConfigured: authConfigured(),
    webhookTokenConfigured,
    secure: configured && authConfigured() && webhookTokenConfigured,
  });
}
