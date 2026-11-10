// api/rss.js — Lee un feed RSS en el servidor y lo devuelve como JSON (respaldo del navegador).
// Vercel guarda la respuesta 5 minutos en su CDN, así cada medio se consulta pocas veces.
import { parseFeed } from './_feeds.js';

// Solo se permiten estos dominios (evita que alguien use tu función como proxy para cualquier sitio).
const ALLOWED = ['df.cl', 'emol.com', 'latercera.com', 'cnnchile.com', 'bcentral.cl', 'news.google.com',
  'elmercurio.com', 'pauta.cl', 'cmfchile.cl', 'aafp.cl', 'forbes.cl', 'mch.cl', 'bloomberglinea.com',
  'biobiochile.cl', 'elmostrador.cl', 'ex-ante.cl', 'theclinic.cl'];

export default async function handler(req, res) {
  const url = String(req.query.url || '');
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return res.status(400).json({ error: 'URL inválida' }); }
  if (!ALLOWED.some(d => host === d || host.endsWith('.' + d))) return res.status(403).json({ error: 'Dominio no permitido' });
  try {
    const items = (await parseFeed(url)).slice(0, 25);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el feed', items: [] });
  }
}
