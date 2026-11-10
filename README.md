# EconSimple — Guía (versión combinada: motor gratuito + Claude)

**EconSimple** muestra noticias económicas y políticas de Chile explicadas en simple. Cada noticia responde tres preguntas: ¿qué pasó, en palabras simples?, ¿cómo afecta a Chile? y ¿cómo afecta a tu bolsillo? Siempre incluye el enlace al medio original.

## Cómo funciona: dos capas

| Capa | Qué hace | Costo | Dónde funciona |
|---|---|---|---|
| ⚙️ **Motor de plantillas** (base) | Explica al instante en el navegador, a partir de palabras clave, cifras y dirección (sube / baja) | Gratis | En todas partes: Netlify, Vercel o abriendo el archivo |
| **Claude** (mejora) | Un cron explica en segundo plano las noticias del día. El visitante puede tocar **"Explicar"** en las que falten | ~US$0,0006 por noticia | Solo en Vercel, con tu clave |

Cuando una noticia ya tiene su explicación de Claude, se muestra esa con la etiqueta **"Explicado con IA"**. Si no la tiene, se muestra la del motor con la etiqueta **"⚙️ Explicación automática"**. **Si Claude falla o se acaba el crédito, la página sigue funcionando con el motor.**

```
Visitante abre la URL
   │
   ├─ ¿Hay /api/noticias? (Vercel)  ──sí──► titulares + explicaciones de Claude ya listas
   │                                 └─no─► lee los RSS desde el navegador (rss2json)
   │
   └─ Toca una noticia
        ├─ tiene explicación de Claude → la muestra
        └─ no la tiene → motor gratuito al instante + botón "Explicar" (si hay Vercel)
```

## Archivos

```
econsimple/
├── index.html                    ← el sitio completo (incluye el motor de plantillas)
├── vercel.json                   ← cron diario + duración de la función
├── package.json                  ← dependencias del servidor (rss-parser, @vercel/blob)
├── api/
│   ├── cron/actualizar.js        ← lee los RSS, explica con Claude solo lo NUEVO y guarda en Vercel Blob
│   ├── noticias.js               ← entrega a la web las noticias ya explicadas
│   ├── explicar.js               ← botón "Explicar"
│   ├── rss.js                    ← lector de RSS de respaldo
│   ├── _feeds.js / _claude.js / _prompt.js   ← medios, llamada a Claude e instrucciones
└── .github/workflows/actualizar.yml   ← corre el cron cada 30 min gratis (opcional)
```

---

## Opción A — Solo gratis (2 minutos)
1. Crea una cuenta en **https://app.netlify.com** y entra a **https://app.netlify.com/drop**.
2. Arrastra la carpeta `econsimple`. Netlify ignora la carpeta `api`, que no hace falta en esta opción.
3. Listo: titulares en vivo y explicaciones con el motor gratuito.

## Opción B — Gratis + Claude en Vercel (25 minutos, sin terminal)

**1. GitHub:** crea un repositorio **público** `econsimple` y, con **uploading an existing file**, sube todo el contenido de la carpeta, incluidas `api` y `.github`. Si no ves `.github` porque está oculta, créala con **Add file → Create new file** usando el nombre `.github/workflows/actualizar.yml`.

**2. Clave de Claude:** en **https://console.anthropic.com**, ve a **API Keys → Create Key**. En **Limits**, fija un tope mensual (por ejemplo, US$5).

**3. Vercel:** entra a **https://vercel.com** con GitHub, toca **Add New → Project**, importa `econsimple` y elige el preset **Other**. Agrega estas variables de entorno:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave `sk-ant-…` (obligatoria) |
| `CRON_SECRET` | una contraseña larga inventada (obligatoria) |
| `ALLOWED_ORIGIN` | `https://econsimple.vercel.app`, tu URL final (recomendada: protege el botón "Explicar") |
| `MAX_NUEVAS_POR_CORRIDA` | `15` (opcional: cuántas noticias explica cada corrida) |

Luego toca **Deploy**.

**4. Vercel Blob:** en tu proyecto ve a **Storage → Create Database → Blob**, conéctalo al proyecto y luego haz **Deployments → … → Redeploy**.

**5. Primera corrida:** en **Settings → Cron Jobs**, toca **Run** junto a `/api/cron/actualizar`. En **Logs** deberías ver `"ok":true` y cuántas noticias se explicaron.

**6. Cada 30 minutos (plan gratuito):** en el plan Hobby, Vercel Cron corre solo una vez al día, así que GitHub Actions lo complementa. En GitHub ve a **Settings → Secrets and variables → Actions** y crea `CRON_SECRET` (el mismo valor que en Vercel) y `SITE_URL` (`https://econsimple.vercel.app`, sin `/` al final). Si tienes Vercel Pro, puedes cambiar el horario en `vercel.json` a `"*/15 * * * *"` y borrar el workflow.

---

## Costo estimado con Claude (Haiku 5.5)
- ~US$0,0006 por noticia explicada, y cada noticia se explica **una sola vez**, aunque la vean miles de personas.
- Unas 200 noticias nuevas al día cuestan ~US$0,12 al día, unos US$3–4 al mes.
- El botón "Explicar" suma un costo similar por cada uso. Las mejoras quedan guardadas en el navegador del visitante.
- Para gastar menos, baja `MAX_NUEVAS_POR_CORRIDA` o la frecuencia del cron.

## Personalizar
| Qué | Dónde |
|---|---|
| Medios y temas | `LIVE_SOURCES` en `index.html` **y** `SOURCES` en `api/_feeds.js`, con los mismos `id` |
| Conceptos y textos del motor gratuito | `CONCEPTOS` dentro de `Motor` en `index.html` |
| Instrucciones de Claude | `api/_prompt.js` |
| Frecuencia de refresco de la página | `CONFIG.REFRESH_MIN` en `index.html` |

## Problemas frecuentes
- **No aparece el botón "Explicar":** estás en Netlify o abriendo el archivo local. Es normal: ahí solo funciona el motor gratuito.
- **"No se pudo explicar ahora":** revisa `ANTHROPIC_API_KEY` y tu crédito en la consola de Anthropic; el detalle aparece en **Vercel → Logs**. La explicación del motor sigue visible.
- **El cron responde 401:** `CRON_SECRET` no coincide entre Vercel y GitHub.
- **Error de Blob en el cron:** falta conectar Blob (paso 4) o hacer Redeploy.
- **"Hobby accounts are limited to daily cron jobs":** deja `0 10 * * *` en `vercel.json` y usa GitHub Actions.

## Buenas prácticas y aspectos legales
- Se muestra **solo título, resumen y enlace** de cada medio, más una explicación propia.
- Las noticias políticas se explican de forma neutral, sin tomar partido.
- Cada explicación indica si viene de la IA o del motor automático. EconSimple no entrega asesoría financiera ni de inversión.
