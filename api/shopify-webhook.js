import crypto from "crypto";

function verificarFirma(req, rawBody) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  const firma = req.headers["x-shopify-hmac-sha256"];
  if (!firma) return false;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(firma));
}

async function enviarEmail({ apiKey, de, para, asunto, html }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: de, to: [para], subject: asunto, html }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.message || "Error Resend");
  }
}

function formatearPeso(valor) {
  return `$${Number(valor).toLocaleString("es-CL")}`;
}

function construirTabla(items) {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee">${item.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">${formatearPeso(item.price)}</td>
      </tr>`
    )
    .join("");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // Leer body crudo para verificar firma
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!verificarFirma(req, rawBody)) {
    console.warn("Firma Shopify invalida");
    return res.status(401).json({ error: "No autorizado" });
  }

  const topic = req.headers["x-shopify-topic"];
  const order = JSON.parse(rawBody);

  // Solo procesar pedidos pagados o creados
  if (topic !== "orders/paid" && topic !== "orders/create") {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL || "hola@ambarjoyas.cl";

  const nombre = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || "Cliente";
  const emailCliente = order.customer?.email || order.email;
  const total = formatearPeso(order.total_price);
  const numeroPedido = order.order_number || order.name;
  const items = order.line_items || [];
  const tabla = construirTabla(items);

  const estiloEncabezado = `background:#8B6914;color:#fff`;
  const estiloCelda = `padding:10px 8px;text-align:left`;

  const tablaHtml = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="${estiloEncabezado}">
          <th style="${estiloCelda}">Producto</th>
          <th style="${estiloCelda};text-align:center">Cant.</th>
          <th style="${estiloCelda};text-align:right">Precio</th>
        </tr>
      </thead>
      <tbody>${tabla}</tbody>
    </table>
    <p style="font-size:20px;font-weight:bold;text-align:right;color:#8B6914">
      Total: ${total}
    </p>
  `;

  const pie = `
    <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999;margin-top:16px">
      Ambar Joyas — www.ambarjoyas.cl
    </div>
  `;

  const htmlDueno = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#8B6914;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">Nuevo pedido #${numeroPedido}</h1>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 8px"><strong>Cliente:</strong> ${nombre}</p>
        <p style="margin:0 0 20px"><strong>Email:</strong> ${emailCliente}</p>
        ${tablaHtml}
      </div>
      ${pie}
    </div>
  `;

  const htmlCliente = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#8B6914;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">Gracias por tu compra, ${nombre}</h1>
      </div>
      <div style="padding:24px">
        <p style="color:#555;line-height:1.6">
          Hemos recibido tu pedido <strong>#${numeroPedido}</strong> con exito.
          Nos pondremos en contacto a la brevedad para coordinar el envio.
        </p>
        ${tablaHtml}
        <p style="color:#555;line-height:1.6;margin-top:20px">
          Preguntas: <a href="mailto:${ownerEmail}" style="color:#8B6914">${ownerEmail}</a>
        </p>
      </div>
      ${pie}
    </div>
  `;

  try {
    const envios = [
      enviarEmail({
        apiKey,
        de: "Ambar Joyas <pedidos@ambarjoyas.cl>",
        para: ownerEmail,
        asunto: `Nuevo pedido #${numeroPedido} de ${nombre} — ${total}`,
        html: htmlDueno,
      }),
    ];

    if (emailCliente) {
      envios.push(
        enviarEmail({
          apiKey,
          de: "Ambar Joyas <pedidos@ambarjoyas.cl>",
          para: emailCliente,
          asunto: `Confirmacion de tu pedido #${numeroPedido} — ${total}`,
          html: htmlCliente,
        })
      );
    }

    await Promise.all(envios);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error shopify-webhook:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
