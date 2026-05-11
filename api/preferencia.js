import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { items, nombre, email, telefono } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Se requiere al menos un producto" });
  }

  if (!email) {
    return res.status(400).json({ error: "Se requiere el email del comprador" });
  }

  const itemsMP = items.map((item) => ({
    id: item.id || String(Math.random()),
    title: item.nombre || item.name || "Producto Ambar Joyas",
    quantity: Number(item.cantidad || item.qty || 1),
    unit_price: Number(item.precio || item.price || 0),
    currency_id: "CLP",
  }));

  const siteUrl = process.env.SITE_URL || "https://www.ambarjoyas.cl";

  try {
    const preference = new Preference(client);
    const r = await preference.create({
      body: {
        items: itemsMP,
        payer: {
          name: nombre || "",
          email,
          phone: telefono ? { number: telefono } : undefined,
        },
        back_urls: {
          success: `${siteUrl}/gracias`,
          failure: `${siteUrl}/pago-fallido`,
          pending: `${siteUrl}/pago-pendiente`,
        },
        auto_return: "approved",
        notification_url: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : siteUrl}/api/webhook`,
        statement_descriptor: "AMBAR JOYAS",
        payment_methods: {
          installments: 12,
        },
      },
    });

    return res.json({
      ok: true,
      id: r.id,
      url: r.init_point,
    });
  } catch (e) {
    console.error("Error preferencia:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
