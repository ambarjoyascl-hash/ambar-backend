export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  if (!process.env.MP_PUBLIC_KEY) {
    return res.status(500).json({ error: "Configuración incompleta" });
  }

  return res.json({
    publicKey: process.env.MP_PUBLIC_KEY,
  });
}
