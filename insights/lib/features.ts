/** Alati iz Folio-a (vrednosti `feature` u događaju `feature_used`). */
export const FEATURES = [
  "search", "annotate", "sign", "fill_form", "ocr", "redact",
  "compare", "merge", "compress", "export_text", "ai_summary",
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABEL: Record<string, string> = {
  search: "Pretraga",
  annotate: "Komentar",
  sign: "Potpis",
  fill_form: "Formular",
  ocr: "OCR",
  redact: "Zacrnjivanje",
  compare: "Poređenje verzija",
  merge: "Spajanje",
  compress: "Kompresija",
  export_text: "Izvoz u tekst",
  ai_summary: "AI sažetak",
};

export const label = (f: string) => FEATURE_LABEL[f] ?? f;
