// api/cron/actualizar.js — Tarea programada de EconSimple.
// 1) Lee los feeds RSS de todos los medios.
// 2) Explica con Claude las noticias nuevas (las ya explicadas se reutilizan).
// 3) Guarda el resultado en Vercel Blob (econsimple/noticias.json), que la web lee en /api/noticias.
//
// La llama Vercel Cron (ver vercel.json) y, opcionalmente, GitHub Actions cada 30 min.
// Protegida con CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>" automáticamente.
import { put, head } from '@vercel/blob';
import { readAll, SOURCES, BLOB_PATH } from '../_feeds.js';
import { explicarNoticia } from '../_claude.js';

const MAX_NUEVAS   = Number(process.env.MAX_NUEVAS_POR_CORRIDA || 15); // tope de llamadas a Claude por corrida (controla el costo)
const POR_MEDIO    = Number(process.env.NOTICIAS_POR_MEDIO || 8);
const GUARDAR_HORAS = 72;      // se conservan noticias de los últimos 3 días
const MAX_GUARDADAS = 150;
const CONCURRENCIA = 5;
const TIEMPO_MAX_MS = 45e3;    // vercel.json da 60 s a esta función; se deja margen para guardar

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  const t0 = Date.now();

  // 1) Lo que ya teníamos guardado (para no volver a pagar explicaciones)
  const previo = await leerGuardado();
  const explicadas = new Map((previo.items || []).filter(i => i.explanation).map(i => [i.id, i]));

  // 2) Titulares frescos de todos los medios
  const { items: frescos, okSources } = await readAll(POR_MEDIO);

  // 3) Unir frescos + anteriores recientes, sin duplicados
  const limite = Date.now() - GUARDAR_HORAS * 3600e3;
  const porId = new Map();
  for (const i of frescos) porId.set(i.id, { ...i, explanation: explicadas.get(i.id)?.explanation || null, explained_at: explicadas.get(i.id)?.explained_at || null });
  for (const i of previo.items || []) if (!porId.has(i.id) && new Date(i.date).getTime() > limite) porId.set(i.id, i);
  let items = [...porId.values()].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, MAX_GUARDADAS);

  // 4) Explicar con Claude las más recientes que aún no tienen explicación
  const pendientes = items.filter(i => !i.explanation).slice(0, MAX_NUEVAS);
  let ok = 0, fallidas = 0;
  for (let k = 0; k < pendientes.length; k += CONCURRENCIA) {
    await Promise.all(pendientes.slice(k, k + CONCURRENCIA).map(async i => {
      try {
        i.explanation = await explicarNoticia({ title: i.title, source: i.source_name, date: i.date, summary: i.summary, link: i.link });
        i.explained_at = new Date().toISOString(); ok++;
      } catch (e) { fallidas++; console.error('No se pudo explicar:', i.title, e.message); }
    }));
    if (Date.now() - t0 > TIEMPO_MAX_MS) break;     // lo que falte se explica en la próxima corrida
  }

  // 5) Guardar en Vercel Blob
  const data = {
    updated_at: new Date().toISOString(),
    ok_sources: okSources,
    total_sources: SOURCES.length,
    sources: SOURCES.map(({ id, topic, name }) => ({ id, topic, name })),
    items,
  };
  await put(BLOB_PATH, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });

  return res.status(200).json({
    ok: true, segundos: Math.round((Date.now() - t0) / 1000), medios_ok: okSources,
    noticias: items.length, explicadas_ahora: ok, fallidas, pendientes_restantes: items.filter(i => !i.explanation).length,
  });
}

async function leerGuardado() {
  try {
    const meta = await head(BLOB_PATH);
    const r = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.json() : { items: [] };
  } catch { return { items: [] }; }   // primera corrida: aún no existe
}
