// api/titulares.js — Titulares al minuto: lee todos los medios en el servidor (sin rss2json, que guarda
// copias de hasta 1 hora). Vercel guarda la respuesta solo 60 segundos, así siempre está fresca.
import { readAll, SOURCES } from './_feeds.js';
import { idsCompartidos } from './_compartidas.js';

export default async function handler(req, res) {
  try {
    const [{ items: base, okSources }, ya] = await Promise.all([readAll(10), idsCompartidos()]);
    const items = base.map(i => ({ ...i, explicada: ya.has(i.id) }));   // ya explicada por otro visitante
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ updated_at: new Date().toISOString(), ok_sources: okSources, total_sources: SOURCES.length, items });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudieron leer los medios', items: [] });
  }
}
