import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db, initSchema } from './db.js';
import { normalizeArabic } from './arabic.js';

initSchema();
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// ---------- helpers ----------
const bnName = {}; // optional Bangla surah names could be added here later

function attachTranslations(ayahs, translator) {
  if (!ayahs.length) return ayahs;
  const ids = ayahs.map((a) => a.id);
  const marks = ids.map(() => '?').join(',');
  const params = translator ? [...ids, translator] : ids;
  const rows = db
    .prepare(
      `SELECT ayah_id, translator, text FROM translations
       WHERE language='bn' AND ayah_id IN (${marks}) ${translator ? 'AND translator = ?' : ''}`
    )
    .all(...params);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.ayah_id)) map.set(r.ayah_id, []);
    map.get(r.ayah_id).push({ translator: r.translator, text: r.text });
  }
  return ayahs.map((a) => ({ ...a, translations: map.get(a.id) ?? [] }));
}

const AYAH_COLS = 'id, surah_id, ayah_number, text_arabic, juz, page';

// ---------- routes ----------
app.get('/', async () => ({
  name: 'Quran API (Arabic + Bangla)',
  endpoints: ['/surahs', '/surahs/:id', '/ayahs/:surah/:ayah', '/juz/:n', '/search?q=&lang=bn|ar', '/translators'],
}));

app.get('/translators', async () =>
  db.prepare(`SELECT DISTINCT translator, language FROM translations`).all()
);

app.get('/surahs', async () =>
  db.prepare('SELECT * FROM surahs ORDER BY id').all()
);

app.get('/surahs/:id', async (req, reply) => {
  const id = Number(req.params.id);
  const surah = db.prepare('SELECT * FROM surahs WHERE id = ?').get(id);
  if (!surah) return reply.code(404).send({ error: 'Surah not found' });
  const ayahs = db
    .prepare(`SELECT ${AYAH_COLS} FROM ayahs WHERE surah_id = ? ORDER BY ayah_number`)
    .all(id);
  return { ...surah, ayahs: attachTranslations(ayahs, req.query.translator) };
});

app.get('/ayahs/:surah/:ayah', async (req, reply) => {
  const { surah, ayah } = req.params;
  const row = db
    .prepare(`SELECT ${AYAH_COLS} FROM ayahs WHERE surah_id = ? AND ayah_number = ?`)
    .get(Number(surah), Number(ayah));
  if (!row) return reply.code(404).send({ error: 'Ayah not found' });
  return attachTranslations([row], req.query.translator)[0];
});

app.get('/juz/:n', async (req, reply) => {
  const n = Number(req.params.n);
  if (!(n >= 1 && n <= 30)) return reply.code(400).send({ error: 'juz must be 1-30' });
  const ayahs = db
    .prepare(`SELECT ${AYAH_COLS} FROM ayahs WHERE juz = ? ORDER BY id`)
    .all(n);
  return { juz: n, count: ayahs.length, ayahs: attachTranslations(ayahs, req.query.translator) };
});

app.get('/search', async (req, reply) => {
  const q = (req.query.q ?? '').trim();
  const lang = req.query.lang === 'ar' ? 'ar' : 'bn';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  if (q.length < 2) return reply.code(400).send({ error: 'q must be at least 2 characters' });

  const esc = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
  let ids;
  if (lang === 'ar') {
    ids = db
      .prepare(`SELECT id FROM ayahs WHERE text_plain LIKE ? ESCAPE '\\' ORDER BY id LIMIT ?`)
      .all(`%${esc(normalizeArabic(q))}%`, limit);
  } else {
    ids = db
      .prepare(
        `SELECT DISTINCT ayah_id AS id FROM translations
         WHERE language='bn' AND text LIKE ? ESCAPE '\\' ORDER BY ayah_id LIMIT ?`
      )
      .all(`%${esc(q)}%`, limit);
  }
  if (!ids.length) return { q, lang, count: 0, results: [] };
  const marks = ids.map(() => '?').join(',');
  const ayahs = db
    .prepare(`SELECT ${AYAH_COLS} FROM ayahs WHERE id IN (${marks}) ORDER BY id`)
    .all(...ids.map((r) => r.id));
  return { q, lang, count: ayahs.length, results: attachTranslations(ayahs, req.query.translator) };
});

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
