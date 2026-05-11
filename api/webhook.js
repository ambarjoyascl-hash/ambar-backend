import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { type, data } = req.body;

  if (type !== "payment") return res.status(200).json({ ok: true });

  try {
    const payment = new Payment(client);
    const pago = await payment.get({ id: data.id });

    const estado = pago.status;
    const monto = pago.transaction_amount;
    const email = pago.payer?.email;
    const id = pago.id;

    console.log(`Webhook MP — id:${id} estado:${estado} monto:${monto} email:${email}`);

    if (estado === "approved") {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Ambar Joyas <pagos@ambarjoyas.cl>",
          to: [process.env.OWNER_EMAIL || "hola@ambarjoyas.cl"],
          subject: `Pago aprobado #${id} — $${Number(monto).toLocaleString("es-CL")}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#2e7d32">Pago aprobado</h2>
              <p><strong>ID de pago:</strong> ${id}</p>
              <p><strong>Monto:</strong> $${Number(monto).toLocaleString("es-CL")}</p>
              <p><strong>Email pagador:</strong> ${email}</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="font-size:12px;color:#999">Ambar Joyas — www.ambarjoyas.cl</p>
            </div>
          `,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error webhook:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
