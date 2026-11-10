// api/_feeds.js — Lista de medios y lectura de sus feeds RSS (lo usan el cron y /api/rss).
// Los archivos que empiezan con "_" no se publican como URL en Vercel.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';

// Archivo en Vercel Blob donde el cron guarda las noticias explicadas.
export const BLOB_PATH = 'econsimple/noticias.json';

const ECO = 'economía OR bolsa OR dólar OR IPC OR inflación OR fondos OR IPSA OR acciones OR AFP';
const POL = 'gobierno OR Congreso OR Senado OR Cámara OR ministro OR ministra OR Presupuesto OR acusación OR "La Moneda" OR partido';

// Mantén esta lista igual a LIVE_SOURCES de index.html (mismos "id").
export const SOURCES = [
  // ---- Economía ----
  { id: 'df',        topic: 'eco', name: 'Diario Financiero',   site: 'df.cl',          rss: 'https://www.df.cl/noticias/site/list/port/rss.xml', query: '' },
  { id: 'emol',      topic: 'eco', name: 'Emol Economía',       site: 'emol.com',       rss: '', query: ECO },
  { id: 'lt',        topic: 'eco', name: 'La Tercera · Pulso',  site: 'latercera.com',  rss: 'https://www.latercera.com/arc/outboundfeeds/rss/category/pulso/?outputType=xml', query: ECO },
  { id: 'cnn',       topic: 'eco', name: 'CNN Chile Economía',  site: 'cnnchile.com',   rss: 'https://www.cnnchile.com/feed/', query: ECO },
  { id: 'bcch',      topic: 'eco', name: 'Banco Central',       site: 'bcentral.cl',    rss: '', query: '' },
  // ---- Política ----
  { id: 'emolpol',   topic: 'pol', name: 'Emol Nacional',       site: 'emol.com',       rss: '', query: POL },
  { id: 'ltpol',     topic: 'pol', name: 'La Tercera Política', site: 'latercera.com',  rss: 'https://www.latercera.com/arc/outboundfeeds/rss/category/politica/?outputType=xml', query: POL },
  { id: 'cnnpol',    topic: 'pol', name: 'CNN Chile Política',  site: 'cnnchile.com',   rss: 'https://www.cnnchile.com/feed/', query: POL },
  { id: 'biobio',    topic: 'pol', name: 'BioBioChile',         site: 'biobiochile.cl', rss: '', query: POL },
  { id: 'mostrador', topic: 'pol', name: 'El Mostrador',        site: 'elmostrador.cl', rss: 'https://www.elmostrador.cl/feed/', query: POL },
  { id: 'exante',    topic: 'pol', name: 'Ex-Ante',             site: 'ex-ante.cl',     rss: 'https://www.ex-ante.cl/feed/', query: POL },
];

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'EconSimpleBot/1.0 (agregador de noticias económicas)' },
});

export const googleNewsUrl = s =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${s.site}${s.query ? ` (${s.query})` : ''} when:2d`)}&hl=es-419&gl=CL&ceid=CL:es-419`;

export const idFor = link => createHash('sha1').update(String(link)).digest('hex').slice(0, 16);

const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export async function parseFeed(url) {
  const feed = await parser.parseURL(url);
  return (feed.items || []).map(i => ({
    title: i.title || '',
    link: i.link || '',
    pubDate: i.isoDate || i.pubDate || '',
    description: (i.contentSnippet || i.content || '').slice(0, 600),
  }));
}

// Convierte "economía OR bolsa OR \"La Moneda\"" en una expresión para filtrar feeds generales por tema.
const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const queryRegex = q => q ? new RegExp('\\b(' + q.split(/\s+OR\s+/).map(w => fold(w.replace(/"/g, '')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i') : null;

// Lee un medio: su feed directo (lo más rápido, sale apenas el diario publica) y además Google News
// filtrado por su dominio. Se juntan ambos, se quitan duplicados y se ordena de la más nueva a la más antigua.
export async function readSource(s, max = 8) {
  const [direct, google] = await Promise.all([
    s.rss ? parseFeed(s.rss).catch(() => []) : Promise.resolve([]),
    parseFeed(googleNewsUrl(s)).catch(() => []),
  ]);
  const re = queryRegex(s.query);
  const directOk = direct.filter(i => !re || re.test(fold(i.title + ' ' + i.description)));
  const clean = (i, fromGoogle) => {
    let title = strip(i.title);
    if (fromGoogle) title = title.replace(/\s[-–|]\s[^-–|]+$/, '');      // Google News agrega " - Medio"
    let summary = strip(i.description);
    if (fromGoogle || summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = '';
    return { id: idFor(i.link || title), src: s.id, topic: s.topic, source_name: s.name, title, link: i.link, date: i.pubDate, summary: summary.slice(0, 400) };
  };
  const seen = new Set(), out = [];
  [...directOk.map(i => clean(i, false)), ...google.map(i => clean(i, true))]
    .filter(i => i.title && i.link)
    .sort((a, b) => (new Date(b.date) || 0) - (new Date(a.date) || 0))
    .forEach(i => { const k = fold(i.title).slice(0, 70); if (!seen.has(k)) { seen.add(k); out.push(i); } });
  return out.slice(0, max);
}

export async function readAll(max = 8) {
  const results = await Promise.all(SOURCES.map(s => readSource(s, max).catch(() => [])));
  const seen = new Set(), all = [];
  results.flat().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(i => {
    const k = i.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 70);
    if (!seen.has(k)) { seen.add(k); all.push(i); }
  });
  return { items: all, okSources: results.filter(r => r.length).length };
}
