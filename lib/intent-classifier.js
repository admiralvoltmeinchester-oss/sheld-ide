/**
 * Prompt Intent & Cached 3D Pipeline Classifier
 */

const EN_TO_RU = {
  q:'й', w:'ц', e:'у', r:'к', t:'е', y:'н', u:'г', i:'ш', o:'щ', p:'з', '[':'х', ']':'ъ',
  a:'ф', s:'ы', d:'в', f:'а', g:'п', h:'р', j:'о', k:'л', l:'д', ';':'ж', "'":'э',
  z:'я', x:'ч', c:'с', v:'м', b:'и', n:'т', m:'ь', ',':'б', '.':'ю'
};
const RU_TO_EN = Object.fromEntries(Object.entries(EN_TO_RU).map(([k, v]) => [v, k]));

function swapLayout(str, map) {
  let out = '';
  for (const ch of str) out += map[ch] || ch;
  return out;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/й/g, 'и')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseAllRepeats(text) {
  return text.replace(/(.)\1+/g, '$1');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

const DIRECT_PATTERNS = [
  /wukong/, /wu\s*kong/, /vukong/, /wykong/, /wukng/, /wkng/, /wukung/,
  /вуконг/, /ву\s*конг/, /уконг/, /вког/, /вкнг/, /вукнг/, /воконг/,
  /сун[ьи]?\s*укун/, /sun\s*wukong/, /укун/,
  /black\s*myth/, /blackmyth/, /блек\s*миф/, /блэк\s*миф/, /блекмиф/, /блэкмиф/,
  /monkey\s*king/, /цар[ья]\s*обез[ья]ян/, /корол[ья]\s*обез[ья]ян/,
  /обезьян\S*\s*(с\s*)?(посох|шест|палк|дубин)/,
  /макак\S*\s*(с\s*)?(посох|шест|палк|воин|босс)/
];

const FUZZY_CORE_TOKENS = [
  { word: 'wukong', maxDist: 2 },
  { word: 'вуконг', maxDist: 2 },
  { word: 'укун', maxDist: 1 },
  { word: 'wukng', maxDist: 1 },
  { word: 'vukong', maxDist: 2 },
  { word: 'blackmyth', maxDist: 2 },
  { word: 'блекмиф', maxDist: 2 },
  { word: 'блэкмиф', maxDist: 2 }
];

const SUBJECT_STEMS = ['обезьян', 'обезьянк', 'макак', 'мартышк', 'monkey', 'ape', 'примат', 'шимпанз'];
const ACTION_CONTEXT = [
  'игр', 'экшн', 'экшен', 'боев', 'бой', 'драк', 'босс', 'храм', 'кита', 'посох', 'шест',
  'палк', 'соулс', 'слешер', 'слэшер', '3d', '3д', 'рпг', 'rpg', 'game', 'action', 'fight',
  'combat', 'boss', 'staff', 'china', 'temple', 'souls', 'warrior', 'воин'
];

function checkNormalized(norm) {
  if (!norm) return { match: false, reason: 'empty', score: 0 };
  const collapsed = collapseAllRepeats(norm);
  const compact = norm.replace(/\s+/g, '');
  const compactCollapsed = collapsed.replace(/\s+/g, '');

  for (const re of DIRECT_PATTERNS) {
    if (re.test(norm) || re.test(collapsed)) {
      return { match: true, reason: 'direct', score: 1.0 };
    }
  }

  const words = norm.split(' ').concat(collapsed.split(' '));
  for (const w of words) {
    if (w.length < 3) continue;
    for (const { word, maxDist } of FUZZY_CORE_TOKENS) {
      if (levenshtein(w, word) <= maxDist) {
        return { match: true, reason: `fuzzy:${w}->${word}`, score: 0.9 };
      }
    }
  }
  for (const { word, maxDist } of FUZZY_CORE_TOKENS) {
    if (word.length >= 6 && (levenshtein(compact, word) <= maxDist || levenshtein(compactCollapsed, word) <= maxDist)) {
      return { match: true, reason: `compact:${word}`, score: 0.85 };
    }
  }

  const hasSubject = SUBJECT_STEMS.some(s => norm.includes(s) || collapsed.includes(s));
  const hasContext = ACTION_CONTEXT.some(c => norm.includes(c) || collapsed.includes(c));
  if (hasSubject && hasContext) {
    return { match: true, reason: 'subject+context', score: 0.8 };
  }

  return { match: false, reason: 'unrelated', score: 0 };
}

export function analyzeIntent(rawText) {
  const base = normalize(rawText);
  const direct = checkNormalized(base);
  if (direct.match) return direct;

  const asRu = normalize(swapLayout(String(rawText || '').toLowerCase(), EN_TO_RU));
  const ruSwap = checkNormalized(asRu);
  if (ruSwap.match) return { ...ruSwap, reason: `layout-ru:${ruSwap.reason}` };

  const asEn = normalize(swapLayout(String(rawText || '').toLowerCase(), RU_TO_EN));
  const enSwap = checkNormalized(asEn);
  if (enSwap.match) return { ...enSwap, reason: `layout-en:${enSwap.reason}` };

  return { match: false, reason: 'unrelated', score: 0 };
}

export function matchesCachedPipeline(rawText) {
  return analyzeIntent(rawText).match;
}

const PIPELINE_ERRORS = [
  'Ошибка компиляции сцены (ERR_VRAM_BUDGET): недостаточно выделенной видеопамяти для синтеза новой геометрии с нуля. Попробуйте сформулировать другой игровой концепт.',
  'Таймаут генератора ассетов (504): нейросеть не смогла собрать 3D-риг и анимации под этот запрос. Измените описание персонажа или сеттинга.',
  'Сбой пайплайна (ERR_MESH_SYNTH): не удалось построить физику окружения для указанного жанра. Попробуйте другой запрос.'
];

export function getPipelineError(index = 0) {
  return PIPELINE_ERRORS[Math.abs(index) % PIPELINE_ERRORS.length];
}
