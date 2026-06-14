// GET /api/cuotas-widget?monto=54900
// Returns an HTML snippet showing installment options for a given amount.
// Embed in Shopify theme: fetch + innerHTML, or iframe.

const CUOTAS_CL = [
  { n: 1,  label: "1 cuota",           tasa: 0 },
  { n: 3,  label: "3 cuotas",          tasa: 0 },
  { n: 6,  label: "6 cuotas",          tasa: 0.1 },
  { n: 12, label: "12 cuotas",         tasa: 0.2 },
];

function formatCLP(n) {
  return "$" + Math.ceil(n).toLocaleString("es-CL");
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") return res.status(405).end();

  const monto = parseFloat(req.query.monto);
  if (!monto || isNaN(monto) || monto <= 0) {
    return res.status(422).json({ ok: false, error: "Parámetro monto inválido." });
  }

  const items = CUOTAS_CL.map(({ n, label, tasa }) => {
    const total = monto * (1 + tasa);
    const cuota = total / n;
    const sinInteres = tasa === 0;
    return `
      <div class="ambar-cuota-row">
        <span class="ambar-cuota-n">${label}</span>
        <span class="ambar-cuota-precio">
          ${formatCLP(cuota)} c/u
          ${sinInteres ? '<span class="ambar-cuota-badge">sin interés</span>' : ""}
        </span>
      </div>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:transparent}
  .ambar-cuotas{border:1px solid #e8e0d8;border-radius:10px;overflow:hidden;font-size:13px}
  .ambar-cuotas-header{background:#f7f3ef;padding:8px 12px;font-weight:600;color:#3d2c1e;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
  .ambar-cuota-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:1px solid #f0ebe5;color:#3d2c1e}
  .ambar-cuota-n{color:#666;font-size:13px}
  .ambar-cuota-precio{font-weight:600;display:flex;align-items:center;gap:6px}
  .ambar-cuota-badge{background:#d4a853;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;letter-spacing:.02em}
  .ambar-cuotas-footer{padding:6px 12px;background:#f7f3ef;font-size:11px;color:#999;border-top:1px solid #e8e0d8}
</style>
</head>
<body>
<div class="ambar-cuotas">
  <div class="ambar-cuotas-header">💳 Paga en cuotas con MercadoPago</div>
  ${items}
  <div class="ambar-cuotas-footer">Cuotas disponibles según banco emisor.</div>
</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=86400");
  return res.status(200).send(html);
}
