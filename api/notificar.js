export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { nombre, email, productos, total } = req.body;

  if (!nombre || !email || !productos || !total) {
    return res.status(400).json({ error: "Faltan datos del pedido" });
  }

  const productosHtml = Array.isArray(productos)
    ? productos
        .map(
          (p) =>
            `<tr>
              <td style="padding:8px;border-bottom:1px solid #eee">${p.nombre || p.name}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.cantidad || p.qty || 1}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(p.precio || p.price || 0).toLocaleString("es-CL")}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:8px">${productos}</td></tr>`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#8B6914;border-bottom:2px solid #8B6914;padding-bottom:8px">
        Nuevo pedido — Ambar Joyas
      </h2>
      <p><strong>Cliente:</strong> ${nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#8B6914;color:#fff">
            <th style="padding:8px;text-align:left">Producto</th>
            <th style="padding:8px;text-align:center">Cantidad</th>
            <th style="padding:8px;text-align:right">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${productosHtml}
        </tbody>
      </table>
      <p style="font-size:18px;font-weight:bold;text-align:right;color:#8B6914">
        Total: $${Number(total).toLocaleString("es-CL")}
      </p>
      <hr style="margin-top:24px;border:none;border-top:1px solid #eee"/>
      <p style="font-size:12px;color:#999">Ambar Joyas — www.ambarjoyas.cl</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ambar Joyas <pedidos@ambarjoyas.cl>",
        to: [process.env.OWNER_EMAIL || "hola@ambarjoyas.cl"],
        subject: `Nuevo pedido de ${nombre} — $${Number(total).toLocaleString("es-CL")}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Error Resend:", err);
      return res.status(500).json({ ok: false, error: "No se pudo enviar el email" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Error notificar:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
