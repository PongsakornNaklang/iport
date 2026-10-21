/**
 * VoiceOver for the iPod shuffle, built on the Web Speech API.
 *
 * `speak()` always resolves — when the speech ends, is cancelled, or (when the
 * browser has no voices, e.g. headless) after an estimated speaking time — so
 * callers can chain menu items and keep the on-screen caption in sync even
 * with the sound off.
 */

let generation = 0;
let voicesReady = false;
let warmedAt = 0;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Ask the browser to load its voice list early (Chrome loads it lazily). */
export function warmUpSpeech(): void {
  const s = synth();
  if (!s) return;
  warmedAt = performance.now();
  try {
    if (s.getVoices().length) voicesReady = true;
    s.addEventListener?.('voiceschanged', () => {
      if (s.getVoices().length) voicesReady = true;
    });
  } catch {
    /* ignore */
  }
}

/** Rough speaking time so captions/menus pace naturally without audio. */
export function estimateMs(text: string): number {
  return 650 + text.length * 62;
}

/** Pick the language from the script so Thai/Japanese/… titles are read properly. */
export function detectLang(text: string): string {
  if (/[฀-๿]/.test(text)) return 'th-TH';
  if (/[぀-ヿ]/.test(text)) return 'ja-JP';
  if (/[가-힯]/.test(text)) return 'ko-KR';
  if (/[一-鿿]/.test(text)) return 'zh-CN';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru-RU';
  return 'en-US';
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const s = synth();
  if (!s) return undefined;
  const voices = s.getVoices();
  if (!voices.length) return undefined;
  const base = lang.slice(0, 2);
  const same = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base));
  if (base === 'en') {
    // The 2010 shuffle's VoiceOver sounded like Apple's "Samantha".
    const fav = same.find((v) => /samantha/i.test(v.name)) ?? same.find((v) => /^(alex|karen|daniel)/i.test(v.name));
    if (fav) return fav;
    return same.find((v) => /en-us/i.test(v.lang) && v.localService) ?? same.find((v) => /en-us/i.test(v.lang)) ?? same[0];
  }
  return same.find((v) => v.localService) ?? same[0];
}

/** Stop whatever is being spoken (the pending promise resolves with false). */
export function stopSpeech(): void {
  generation++;
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak `text`. Resolves `true` when it finished normally, `false` when it was
 * interrupted by another `speak()` / `stopSpeech()`.
 */
export function speak(text: string, volume = 1): Promise<boolean> {
  stopSpeech();
  const gen = generation;
  const est = estimateMs(text);
  const t0 = performance.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(safety);
      resolve(gen === generation);
    };
    // After an error (no voice, blocked audio) still give the caption time to be read.
    const finishPaced = () => {
      const left = est - (performance.now() - t0);
      if (left > 30) window.setTimeout(finish, left);
      else finish();
    };
    const s = synth();
    const noVoices = !s || (!voicesReady && s.getVoices().length === 0 && performance.now() - warmedAt > 1200);
    let safety = window.setTimeout(finish, noVoices ? est : est * 2.4 + 1200);
    if (!s || noVoices) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = detectLang(text);
      const v = pickVoice(u.lang);
      if (v) u.voice = v;
      u.rate = 1.04;
      u.pitch = 1;
      u.volume = Math.max(0.15, Math.min(1, volume));
      u.onend = finish;
      u.onerror = finishPaced;
      // Chrome sometimes leaves the queue paused.
      s.resume();
      s.speak(u);
    } catch {
      window.clearTimeout(safety);
      safety = window.setTimeout(finish, est);
    }
  });
}
