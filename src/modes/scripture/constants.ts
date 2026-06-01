export const TRANSLATIONS = [
  { value: 'KJV',  label: 'King James Version (KJV)' },
  { value: 'NKJV', label: 'New King James Version (NKJV)' },
  { value: 'ESV',  label: 'English Standard Version (ESV)' },
  { value: 'NIV',  label: 'New International Version (NIV)' },
  { value: 'NLT',  label: 'New Living Translation (NLT)' },
  { value: 'AMP',  label: 'Amplified Bible (AMP)' },
  { value: 'NET',  label: 'New English Translation (NET)' },
] as const;

export type TranslationCode = typeof TRANSLATIONS[number]['value'];

export interface MoodCategory {
  id: string;
  label: string;
  keywords: string[];
  query: string;
}

// Maps scripture keywords → Unsplash search query for semantic background selection
export const DEFAULT_MOOD_CATEGORIES: MoodCategory[] = [
  {
    id: 'love',
    label: 'Love & Grace',
    keywords: ['love', 'beloved', 'heart', 'compassion', 'mercy', 'grace', 'kindness', 'charity', 'tender', 'affection'],
    query: 'wildflower meadow golden grass valley pastoral',
  },
  {
    id: 'strength',
    label: 'Strength & Power',
    keywords: ['strength', 'mighty', 'power', 'rock', 'fortress', 'shield', 'armor', 'strong', 'courage', 'bold', 'conquer', 'victory'],
    query: 'mountain peak valley rocky landscape nature',
  },
  {
    id: 'peace',
    label: 'Peace & Rest',
    keywords: ['peace', 'rest', 'still', 'quiet', 'calm', 'tranquil', 'comfort', 'gentle', 'stillness', 'solace', 'ease'],
    query: 'green valley lake reflection serene nature',
  },
  {
    id: 'light',
    label: 'Light & Glory',
    keywords: ['light', 'shine', 'glory', 'radiant', 'bright', 'lamp', 'beacon', 'gleam', 'luminous', 'glow', 'illuminate'],
    query: 'sunlight through trees forest green nature',
  },
  {
    id: 'water',
    label: 'Waters',
    keywords: ['water', 'river', 'sea', 'ocean', 'waves', 'spring', 'rain', 'flood', 'well', 'stream', 'brook', 'fountain'],
    query: 'mountain river stream valley green nature',
  },
  {
    id: 'pastoral',
    label: 'Shepherd & Pasture',
    keywords: ['shepherd', 'sheep', 'pasture', 'flock', 'lamb', 'valley', 'green', 'fold', 'meadow'],
    query: 'rolling green hills pastoral countryside sheep meadow',
  },
  {
    id: 'spirit',
    label: 'Spirit & Fire',
    keywords: ['fire', 'spirit', 'wind', 'breath', 'flames', 'zeal', 'anointing', 'burning', 'holy'],
    query: 'mountain valley mist dramatic nature landscape',
  },
  {
    id: 'joy',
    label: 'Joy & Praise',
    keywords: ['joy', 'praise', 'worship', 'rejoice', 'sing', 'thanksgiving', 'celebrate', 'glad', 'delight', 'jubilee'],
    query: 'flower field wildflowers valley sunlight nature',
  },
  {
    id: 'wisdom',
    label: 'Wisdom & Truth',
    keywords: ['wisdom', 'knowledge', 'understanding', 'counsel', 'truth', 'discern', 'teach', 'righteous', 'instruction'],
    query: 'ancient forest tall trees green peaceful nature',
  },
  {
    id: 'heaven',
    label: 'Heaven & Eternity',
    keywords: ['heaven', 'eternal', 'kingdom', 'throne', 'angel', 'paradise', 'glory', 'exalt', 'celestial', 'everlasting', 'above'],
    query: 'mountain top clouds above valley landscape nature',
  },
  {
    id: 'growth',
    label: 'Growth & Harvest',
    keywords: ['tree', 'fruit', 'vine', 'branch', 'harvest', 'garden', 'seed', 'plant', 'bloom', 'grow', 'field', 'sow'],
    query: 'lush green forest trees nature lily valley',
  },
  {
    id: 'dawn',
    label: 'New Day & Renewal',
    keywords: ['morning', 'dawn', 'new', 'rise', 'awaken', 'renewal', 'restore', 'refresh', 'born', 'beginning', 'fresh'],
    query: 'morning mist green valley sunrise meadow nature',
  },
  {
    id: 'journey',
    label: 'Journey & Way',
    keywords: ['desert', 'wilderness', 'journey', 'path', 'way', 'road', 'walk', 'guide', 'lead', 'follow', 'seek', 'wander'],
    query: 'trail path through valley mountains nature landscape',
  },
  {
    id: 'default',
    label: 'Default (Peaceful Nature)',
    keywords: [],
    query: 'green valley mountains nature peaceful grass landscape',
  },
];

// Words to render in gold when highlight mode is on
export const SACRED_WORDS = new Set([
  'god', 'lord', 'jesus', 'christ', 'spirit', 'holy', 'father', 'son',
  'savior', 'saviour', 'messiah', 'almighty', 'kingdom', 'heaven', 'eternal',
  'righteousness', 'salvation', 'grace', 'truth', 'light', 'life',
  'love', 'word', 'faith', 'hope', 'glory', 'blessed', 'amen',
  'redeemer', 'emmanuel', 'immanuel',
]);
