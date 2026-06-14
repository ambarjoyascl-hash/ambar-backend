import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const MENSAJES_RECHAZO = {
  cc_rejected_insufficient_amount: "Fondos insuficientes en la tarjeta.",
  cc_rejected_bad_filled_card_number: "Número de tarjeta incorrecto.",
  cc_rejected_bad_filled_date: "Fecha de vencimiento incorrecta.",
  cc_rejected_bad_filled_security_code: "Código de seguridad incorrecto.",
  cc_rejected_bad_filled_other: "Datos de la tarjeta incorrectos.",
  cc_rejected_blacklist: "Tarjeta rechazada. Contacta a tu banco.",
  cc_rejected_call_for_authorize: "Debes autorizar el pago con tu banco.",
  cc_rejected_card_disabled: "Tarjeta deshabilitada. Contacta a tu banco.",
  cc_rejected_duplicated_payment: "Pago duplicado detectado.",
  cc_rejected_high_risk: "Pago rechazado por seguridad.",
  cc_rejected_max_attempts: "Máximo de intentos alcanzado. Espera 10 minutos.",
  pending_contingency: "El pago está siendo procesado. Te avisaremos pronto.",
  pending_review_manual: "El pago está en revisión. Te confirmaremos en breve.",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const {
    token,
    monto,
    cuotas,
    email,
    nombre,
    apellido,
    tipo_doc,
    num_doc,
    payment_method_id,
    issuer_id,
    productos,
    idempotency_key,
  } = req.body;

  if (!token || !monto || !email || !payment_method_id) {
    return res.status(422).json({ ok: false, error: "Faltan campos obligatorios: token, monto, email, payment_method_id." });
  }

  try {
    const payment = new Payment(client);
    const r = await payment.create({
      body: {
        transaction_amount: Number(monto),
        token,
        description: "Ámbar Joyas",
        installments: Number(cuotas) || 1,
        payment_method_id,
        issuer_id,
        statement_descriptor: "AMBAR JOYAS",
        payer: {
          email,
          first_name: nombre || "",
          last_name: apellido || "",
          identification: tipo_doc && num_doc
            ? { type: tipo_doc, number: String(num_doc) }
            : undefined,
        },
        additional_info: {
          items: Array.isArray(productos)
            ? productos.map((p) => ({
                id: String(p.id || ""),
                title: p.nombre || p.title || "Producto",
                quantity: Number(p.cantidad || p.quantity || 1),
                unit_price: Number(p.precio || p.price || monto),
              }))
            : [],
        },
        metadata: { fuente: "ambarjoyas_cl", email },
        notification_url: process.env.MP_WEBHOOK_URL || undefined,
      },
      requestOptions: idempotency_key
        ? { idempotencyKey: idempotency_key }
        : undefined,
    });

    console.log(`[pagar] id=${r.id} status=${r.status} detail=${r.status_detail} email=${email}`);

    if (r.status === "approved") {
      return res.json({ ok: true, estado: "aprobado", id: r.id });
    }

    if (r.status === "pending" || r.status === "in_process") {
      return res.json({ ok: true, estado: "pendiente", id: r.id });
    }

    const mensaje = MENSAJES_RECHAZO[r.status_detail] || "Pago rechazado. Intenta con otra tarjeta.";
    return res.status(402).json({ ok: false, estado: "rechazado", motivo: r.status_detail, mensaje });
  } catch (e) {
    console.error("[pagar] error:", e.message);
    return res.status(500).json({ ok: false, error: "Error procesando el pago. Intenta nuevamente." });
  }
}
