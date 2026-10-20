// Imports the Quran (Arabic Uthmani + Bangla translations) from AlQuran.cloud into SQLite.
// Run once:  npm run import
// Downloads surah by surah (small requests) with retries, so a flaky connection won't kill it.
import { db, initSchema, transaction } from '../src/db.js';
import { normalizeArabic } from '../src/arabic.js';

const BASE = 'https://api.alquran.cloud/v1';
const ARABIC = 'quran-uthmani';
const TRANSLATIONS = [
  { edition: 'bn.bengali', translator: 'Muhiuddin Khan' },
  { edition: 'bn.hoque', translator: 'Zohurul Hoque' },
];
const EDITIONS = [ARABIC, ...TRANSLATIONS.map((t) => t.edition)];
const CONCURRENCY = 3;
const ATTEMPTS = 8;
// Bismillah is 4 words. AlQuran.cloud prepends it to ayah 1 of every surah except 1 and 9.
const BISMILLAH_WORDS = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  for (let i = 1; i <= ATTEMPTS; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === ATTEMPTS) throw e;
      const wait = Math.min(1000 * 2 ** (i - 1), 15000);
      console.log(`\n  retry ${i}/${ATTEMPTS - 1} (${e.cause?.code ?? e.message}), waiting ${wait / 1000}s`);
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function fetchSurah(n) {
  const json = await fetchJson(`${BASE}/surah/${n}/editions/${EDITIONS.join(',')}`);
  if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(`surah ${n}: bad response`);
  const byEdition = {};
  for (const ed of json.data) byEdition[ed.edition.identifier] = ed;
  for (const e of EDITIONS) if (!byEdition[e]) throw new Error(`surah ${n}: missing ${e}`);
  return byEdition;
}

function stripBismillah(text, surahNo, ayahNo) {
  if (ayahNo !== 1 || surahNo === 1 || surahNo === 9) return text;
  return text.split(' ').slice(BISMILLAH_WORDS).join(' ').trim();
}

async function main() {
  initSchema();

  console.log('Downloading 114 surahs (Arabic + Bangla)...');
  const results = new Array(115);
  let next = 1;
  let done = 0;
  async function worker() {
    while (next <= 114) {
      const n = next++;
      results[n] = await fetchSurah(n);
      process.stdout.write(`\r  ${++done}/114`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('\nSaving to database...');

  const insSurah = db.prepare(
    `INSERT OR REPLACE INTO surahs (id, name_arabic, name_english, name_translation, revelation_type, ayah_count)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insAyah = db.prepare(
    `INSERT OR REPLACE INTO ayahs (id, surah_id, ayah_number, text_arabic, text_plain, juz, page)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insTr = db.prepare(
    `INSERT OR REPLACE INTO translations (ayah_id, language, translator, text) VALUES (?, 'bn', ?, ?)`
  );

  transaction(() => {
    for (let n = 1; n <= 114; n++) {
      const s = results[n][ARABIC];
      insSurah.run(s.number, s.name, s.englishName, s.englishNameTranslation, s.revelationType, s.ayahs.length);
      for (const a of s.ayahs) {
        const text = stripBismillah(a.text, s.number, a.numberInSurah);
        insAyah.run(a.number, s.number, a.numberInSurah, text, normalizeArabic(text), a.juz, a.page);
      }
      for (const t of TRANSLATIONS) {
        for (const a of results[n][t.edition].ayahs) insTr.run(a.number, t.translator, a.text);
      }
    }
  });

  const surahs = db.prepare('SELECT COUNT(*) c FROM surahs').get().c;
  const ayahs = db.prepare('SELECT COUNT(*) c FROM ayahs').get().c;
  const trs = db.prepare('SELECT COUNT(*) c FROM translations').get().c;
  console.log(`Done. ${surahs} surahs, ${ayahs} ayahs, ${trs} translations.`);
}

main().catch((e) => {
  console.error('\nImport failed:', e.cause?.code ?? e.message);
  process.exit(1);
});