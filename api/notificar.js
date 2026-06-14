const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_TIENDA = process.env.EMAIL_TIENDA || "ambarjoyascl@gmail.com";

async function enviarEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.log(`[notificar] RESEND_API_KEY no configurado. Email omitido: ${subject} → ${to}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Ámbar Joyas <pedidos@ambarjoyas.cl>", to, subject, html }),
  });
  if (!r.ok) console.error("[notificar] Resend error:", await r.text());
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();

  const { nombre, email, productos, total, id_pago } = req.body;

  if (!email || !total) {
    return res.status(422).json({ ok: false, error: "Faltan campos: email, total." });
  }

  const productosHtml = Array.isArray(productos)
    ? productos.map((p) => `<li>${p.nombre || p.title} × ${p.cantidad || p.quantity || 1} — $${Number(p.precio || p.price || 0).toLocaleString("es-CL")}</li>`).join("")
    : "<li>Productos no especificados</li>";

  const totalFormato = `$${Number(total).toLocaleString("es-CL")}`;

  await Promise.all([
    enviarEmail({
      to: EMAIL_TIENDA,
      subject: `🛍️ Nuevo pedido de ${nombre || email} — ${totalFormato}`,
      html: `
        <h2>Nuevo pedido recibido</h2>
        <p><b>Cliente:</b> ${nombre || "—"} (${email})</p>
        ${id_pago ? `<p><b>ID pago:</b> ${id_pago}</p>` : ""}
        <p><b>Productos:</b></p><ul>${productosHtml}</ul>
        <p><b>Total:</b> ${totalFormato}</p>
      `,
    }),
    enviarEmail({
      to: email,
      subject: "¡Tu pedido en Ámbar Joyas fue recibido! ✨",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <img src="https://www.ambarjoyas.cl/cdn/shop/files/Logo_Ambar.png" alt="Ámbar Joyas" style="height:48px;margin-bottom:16px"/>
          <h2 style="color:#1a1a1a">¡Gracias por tu compra, ${nombre || ""}! 🎉</h2>
          <p style="color:#555">Recibimos tu pedido y lo estamos preparando con cariño.</p>
          <h3 style="color:#1a1a1a">Tu pedido</h3>
          <ul style="color:#333">${productosHtml}</ul>
          <p style="font-size:18px;color:#1a1a1a"><b>Total: ${totalFormato}</b></p>
          <p style="color:#555">Si tienes preguntas, escríbenos a <a href="mailto:${EMAIL_TIENDA}">${EMAIL_TIENDA}</a> o por Instagram <a href="https://www.instagram.com/ambarjoyas.cl">@ambarjoyas.cl</a></p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">Ámbar Joyas · ambarjoyas.cl</p>
        </div>
      `,
    }),
  ]);

  console.log(`[notificar] Pedido de ${email} — ${totalFormato}`);
  return res.json({ ok: true });
}
