// api/_claude.js — Llama a la API de Claude para explicar una noticia (lo usan el cron y /api/explicar).
import { SYSTEM_PROMPT, USER_TEMPLATE, SCHEMA } from './_prompt.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function explicarNoticia({ title, source, date, summary, link }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error('Falta ANTHROPIC_API_KEY'); e.status = 500; throw e; }

  const userMsg = USER_TEMPLATE
    .replace('{{title}}', () => clean(title, 300))
    .replace('{{source_name}}', () => clean(source, 80) || '—')
    .replace('{{published_at}}', () => clean(date, 40) || '—')
    .replace('{{feed_category}}', '—')
    .replace('{{link}}', () => clean(link, 500) || '—')
    .replace('{{summary}}', () => clean(summary, 2500) || '(el medio no publicó resumen; explica a partir del título)');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }], // caché del prompt: más barato en lotes
      tools: [{ name: 'guardar_analisis', description: 'Guarda la explicación estructurada de la noticia.', input_schema: SCHEMA }],
      tool_choice: { type: 'tool', name: 'guardar_analisis' },
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const e = new Error(`Claude API ${r.status}: ${detail.slice(0, 300)}`); e.status = r.status; throw e;
  }
  const data = await r.json();
  const block = (data.content || []).find(b => b.type === 'tool_use');
  if (!block) throw new Error('Respuesta inesperada de Claude');
  return block.input;
}
