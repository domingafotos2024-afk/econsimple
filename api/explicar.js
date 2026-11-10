// api/explicar.js — Explica bajo demanda una noticia que el cron aún no procesó
// (o una que el visitante pega en "✨ Explica una noticia").
// La clave de Claude NUNCA viaja al navegador: se lee de ANTHROPIC_API_KEY en Vercel.
import { explicarNoticia } from './_claude.js';

const MAX_INPUT = 3000; // caracteres máximos de título + resumen (evita abusos y costos altos)
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });

  // Opcional: solo aceptar pedidos desde tu propio sitio (ej. https://econsimple.vercel.app)
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin && req.headers.origin !== allowed) return res.status(403).json({ error: 'Origen no permitido' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const title = clean(body.title, 300), summary = clean(body.summary, 2500);
  if (!title) return res.status(400).json({ error: 'Falta el título' });
  if ((title + summary).length > MAX_INPUT) return res.status(400).json({ error: 'Texto demasiado largo' });

  try {
    const data = await explicarNoticia({ title, summary, source: clean(body.source, 80), date: clean(body.date, 40), link: clean(body.link, 500) });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (e) {
    console.error(e.message);
    if (e.status === 429) return res.status(429).json({ error: 'Demasiadas solicitudes, intenta en un minuto' });
    return res.status(502).json({ error: 'No se pudo generar la explicación' });
  }
}
function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
