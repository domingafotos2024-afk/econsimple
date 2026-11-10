// api/_compartidas.js — Explicaciones compartidas: cuando alguien toca "Explicar", la respuesta de
// Claude se guarda en Vercel Blob y todos los demás visitantes la reciben gratis, sin volver a llamar a Claude.
// Si Blob no está conectado al proyecto (falta BLOB_READ_WRITE_TOKEN), todo sigue funcionando sin compartir.
import { put, head, list } from '@vercel/blob';
import { idFor } from './_feeds.js';

const PREFIX = 'econsimple/explicaciones/';
export const blobActivo = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const keyFor = link => PREFIX + idFor(link) + '.json';
const compartible = link => /^https?:\/\//.test(String(link || ''));   // las pegadas a mano no se comparten

export async function leerCompartida(link) {
  if (!blobActivo() || !compartible(link)) return null;
  try {
    const meta = await head(keyFor(link));
    const r = await fetch(meta.url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }                                            // no existe todavía
}

export async function guardarCompartida(link, data) {
  if (!blobActivo() || !compartible(link)) return;
  try {
    await put(keyFor(link), JSON.stringify(data), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
    });
  } catch (e) { console.error('No se pudo guardar la explicación compartida:', e.message); }
}

// Ids (los mismos de idFor) de las noticias que ya tienen explicación guardada.
export async function idsCompartidos() {
  const ids = new Set();
  if (!blobActivo()) return ids;
  try {
    let cursor;
    do {
      const r = await list({ prefix: PREFIX, limit: 1000, cursor });
      r.blobs.forEach(b => ids.add(b.pathname.slice(PREFIX.length).replace(/\.json$/, '')));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
  } catch (e) { console.error('No se pudo listar explicaciones:', e.message); }
  return ids;
}
