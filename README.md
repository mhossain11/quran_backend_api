# Quran API (Arabic + Bangla)

Node.js (22.13+) + Fastify + built-in node:sqlite (no native build, works on Windows). Arabic Uthmani text with full tashkeel, Bangla translations by Muhiuddin Khan and Zohurul Hoque.

## Run

```bash
npm install
npm run import   # one-time: downloads data from api.alquran.cloud into quran.db (needs internet)
npm start        # http://localhost:3000   (npm run dev for auto-reload)
```

Set `PORT` to change the port, `DB_PATH` to change the database location.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /surahs` | all 114 surahs |
| `GET /surahs/:id` | full surah, Arabic + Bangla |
| `GET /ayahs/:surah/:ayah` | single ayah |
| `GET /juz/:n` | all ayahs of a juz (1-30) |
| `GET /search?q=...&lang=bn\|ar&limit=20` | search Bangla translations or Arabic (ignores harakat) |
| `GET /translators` | available translators |

Add `?translator=Muhiuddin Khan` to any endpoint to get only one translation.

## Notes

- `text_arabic` is stored unmodified. `text_plain` (no harakat) is used only for search.
- The Bismillah is removed from the start of ayah 1 of each surah (except Al-Fatiha) so it isn't duplicated; show it separately in your UI.
- Data source: AlQuran.cloud (Tanzil text). If you republish the text, keep attribution to Tanzil.net and do not alter the Arabic text.

-বাংলা সার্চ (অনুবাদে খুঁজবে):
 http://localhost:3000/search?q=ধৈর্য&lang=bn

-আরবি সার্চ (হরকত ছাড়া লিখলেও চলবে):
 http://localhost:3000/search?q=الصبر&lang=ar

-অতিরিক্ত অপশন:
&limit=50 দিলে বেশি ফলাফল পাবেন (সর্বোচ্চ ১০০, ডিফল্ট ২০)
&translator=Muhiuddin Khan দিলে শুধু ওই অনুবাদক দেখাবে

-কমপক্ষে ২ অক্ষর লিখতে হবে।

-অন্যান্য এন্ডপয়েন্টের উদাহরণ:

-পুরো সূরা বাকারা: http://localhost:3000/surahs/2

-আয়াতুল কুরসি: http://localhost:3000/ayahs/2/255

-৩০ নম্বর পারা: http://localhost:3000/juz/30

-https://api.alquran.cloud/v1/quran
