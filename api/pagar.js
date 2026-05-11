import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { token, monto, cuotas, email, payment_method_id, issuer_id } = req.body;

  if (!token || !monto || !email) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const payment = new Payment(client);
    const r = await payment.create({
      body: {
        transaction_amount: Number(monto),
        token,
        description: "Compra Ambar Joyas",
        installments: Number(cuotas) || 1,
        payment_method_id,
        issuer_id,
        payer: { email },
      },
    });

    if (r.status === "approved") {
      return res.json({ ok: true, estado: "aprobado", id: r.id });
    }
    if (r.status === "pending") {
      return res.json({ ok: true, estado: "pendiente", id: r.id });
    }
    return res.json({ ok: false, estado: "rechazado", motivo: r.status_detail });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
