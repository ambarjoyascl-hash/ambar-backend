export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const { bin, monto } = req.query;

  if (!bin || !monto) {
    return res.status(422).json({ ok: false, error: "Parámetros requeridos: bin, monto." });
  }

  if (!/^\d{6}$/.test(bin)) {
    return res.status(422).json({ ok: false, error: "El bin debe ser de 6 dígitos." });
  }

  try {
    const url = new URL("https://api.mercadopago.com/v1/payment_methods/installments");
    url.searchParams.set("bin", bin);
    url.searchParams.set("amount", monto);
    url.searchParams.set("locale", "es-CL");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!r.ok) throw new Error(`MercadoPago respondió con ${r.status}`);

    const data = await r.json();

    const cuotas = (data[0]?.payer_costs ?? []).map((c) => ({
      cuotas: c.installments,
      label: c.recommended_message,
      total: c.total_amount,
      monto_cuota: c.installment_amount,
      sin_interes: c.installment_rate === 0,
    }));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.json({ ok: true, cuotas });
  } catch (e) {
    console.error("[cuotas] error:", e.message);
    return res.status(500).json({ ok: false, error: "No se pudo obtener el plan de cuotas." });
  }
}
