// Strip Arabic diacritics (harakat, Quranic marks) and normalize letter variants.
// Used ONLY for searching. The displayed text_arabic is never modified.
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;

export function normalizeArabic(s = '') {
  return s
    .replace(MARKS, '')
    .replace(/[ٱآأإ]/g, 'ا') // ٱ آ أ إ → ا
    .replace(/ى/g, 'ي')                      // ى → ي
    .replace(/ة/g, 'ه')                      // ة → ه
    .replace(/\s+/g, ' ')
    .trim();
}
