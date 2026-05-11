async function enviarEmail({ apiKey, de, para, asunto, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: de, to: [para], subject: asunto, html }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Error enviando email");
  }
  return response.json();
}

function construirTablaProductos(productos) {
  if (!Array.isArray(productos)) {
    return `<tr><td colspan="3" style="padding:8px">${productos}</td></tr>`;
  }
  return productos
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee">${p.nombre || p.name || "Producto"}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center">${p.cantidad || p.qty || 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">$${(p.precio || p.price || 0).toLocaleString("es-CL")}</td>
      </tr>`
    )
    .join("");
}

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

  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL || "hola@ambarjoyas.cl";
  const totalFormateado = `$${Number(total).toLocaleString("es-CL")}`;
  const tablaProductos = construirTablaProductos(productos);

  const estiloTabla = `width:100%;border-collapse:collapse;margin:16px 0`;
  const estiloEncabezado = `background:#8B6914;color:#fff`;
  const estiloCelda = `padding:10px 8px;text-align:left`;

  // Email al dueño de la tienda
  const htmlDueno = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#8B6914;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">Nuevo pedido recibido</h1>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 8px"><strong>Cliente:</strong> ${nombre}</p>
        <p style="margin:0 0 20px"><strong>Email:</strong> ${email}</p>
        <table style="${estiloTabla}">
          <thead>
            <tr style="${estiloEncabezado}">
              <th style="${estiloCelda}">Producto</th>
              <th style="${estiloCelda};text-align:center">Cant.</th>
              <th style="${estiloCelda};text-align:right">Precio</th>
            </tr>
          </thead>
          <tbody>${tablaProductos}</tbody>
        </table>
        <p style="font-size:20px;font-weight:bold;text-align:right;color:#8B6914;margin:8px 0">
          Total: ${totalFormateado}
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999">
        Ambar Joyas — www.ambarjoyas.cl
      </div>
    </div>
  `;

  // Email de confirmación al cliente
  const htmlCliente = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#8B6914;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">Gracias por tu compra, ${nombre}</h1>
      </div>
      <div style="padding:24px">
        <p style="color:#555;line-height:1.6">
          Hemos recibido tu pedido con exito. Nos pondremos en contacto contigo a la brevedad
          para coordinar el envio.
        </p>
        <table style="${estiloTabla}">
          <thead>
            <tr style="${estiloEncabezado}">
              <th style="${estiloCelda}">Producto</th>
              <th style="${estiloCelda};text-align:center">Cant.</th>
              <th style="${estiloCelda};text-align:right">Precio</th>
            </tr>
          </thead>
          <tbody>${tablaProductos}</tbody>
        </table>
        <p style="font-size:20px;font-weight:bold;text-align:right;color:#8B6914;margin:8px 0">
          Total: ${totalFormateado}
        </p>
        <p style="color:#555;line-height:1.6;margin-top:20px">
          Si tienes alguna pregunta, escribenos a <a href="mailto:${ownerEmail}" style="color:#8B6914">${ownerEmail}</a>.
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999">
        Ambar Joyas — www.ambarjoyas.cl
      </div>
    </div>
  `;

  try {
    await Promise.all([
      enviarEmail({
        apiKey,
        de: "Ambar Joyas <pedidos@ambarjoyas.cl>",
        para: ownerEmail,
        asunto: `Nuevo pedido de ${nombre} — ${totalFormateado}`,
        html: htmlDueno,
      }),
      enviarEmail({
        apiKey,
        de: "Ambar Joyas <pedidos@ambarjoyas.cl>",
        para: email,
        asunto: `Confirmacion de tu pedido — ${totalFormateado}`,
        html: htmlCliente,
      }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    console.error("Error notificar:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
