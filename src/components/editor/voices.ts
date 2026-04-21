export interface Voice {
  id: string;
  name: string;
  tone: string;
}

// Curated voices that work well with eleven_multilingual_v2 (PT-BR friendly)
export const VOICES: Voice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tone: "clara, conversacional" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", tone: "grave, narrador" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tone: "autoritária, séria" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", tone: "amigável, doce" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", tone: "confiante, jovem" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tone: "calma, profissional" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", tone: "energético, direto" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", tone: "calorosa, envolvente" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;

export const getVoice = (id: string): Voice =>
  VOICES.find((v) => v.id === id) || VOICES[0];
