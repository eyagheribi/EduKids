// French typography helpers for child names (« l’espace d’Adam », « l’espace de Sarah »).

const ELIDING_INITIALS = 'aeiouhæœ';
const VOWELS = 'aeiouyæœ';

/** First letters of a word, lower-cased and without diacritics (« Élodie » → « elodie »). */
function baseLetters(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * True when « de » / « le » must be elided before this word: vowels and mute « h » (« d’Adam »,
 * « d’Hugo », « d’Élodie »), and « y » followed by a consonant (« d’Yves »). A « y » followed by a
 * vowel is a consonant sound and is not elided (« de Yassine »).
 */
export function elidesBefore(word: string): boolean {
  const letters = baseLetters(word.trim());
  const first = letters.charAt(0);
  if (!first) return false;
  if (ELIDING_INITIALS.includes(first)) return true;
  if (first === 'y') {
    const second = letters.charAt(1);
    return second !== '' && /[a-z]/.test(second) && !VOWELS.includes(second);
  }
  return false;
}

/** « d’Adam » / « de Sarah » (« de votre enfant » when the name is empty). */
export function deNom(name: string | null | undefined): string {
  const value = (name ?? '').trim();
  if (!value) return 'de votre enfant';
  return elidesBefore(value) ? `d’${value}` : `de ${value}`;
}

/** « Espace d’Adam » / « Espace de Sarah ». */
export function espaceDe(name: string | null | undefined): string {
  return `Espace ${deNom(name)}`;
}

/** « l’espace d’Adam » / « l’espace de Sarah ». */
export function lEspaceDe(name: string | null | undefined): string {
  return `l’espace ${deNom(name)}`;
}
