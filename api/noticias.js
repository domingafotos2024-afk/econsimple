// api/noticias.js — Entrega a la web las noticias ya leídas y explicadas por el cron.
// Vercel guarda la respuesta 60 s en su CDN, así miles de visitas no hacen miles de lecturas.
import { head } from '@vercel/blob';
import { BLOB_PATH } from './_feeds.js';

export default async function handler(req, res) {
  try {
    const meta = await head(BLOB_PATH);
    const r = await fetch(`${meta.url}?t=${Math.floor(Date.now() / 60000)}`);
    if (!r.ok) throw new Error('blob ' + r.status);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch {
    // Aún no corre el cron (o no hay Blob conectado): la web usará su lectura de respaldo en el navegador.
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(404).json({ items: [], error: 'Sin datos todavía' });
  }
}
