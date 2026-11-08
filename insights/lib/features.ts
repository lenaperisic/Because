/** Folio tools (values of `feature` in the `feature_used` event). */
export const FEATURES = [
  "search", "annotate", "sign", "fill_form", "ocr", "redact",
  "compare", "merge", "compress", "export_text", "ai_summary",
] as const;
export type Feature = (typeof FEATURES)[number];

/** Same names as the Folio toolbar, so the interviewer uses the words the user sees. */
export const FEATURE_LABEL: Record<string, string> = {
  search: "Search",
  annotate: "Comment",
  sign: "Sign",
  fill_form: "Fill form",
  ocr: "OCR",
  redact: "Redact",
  compare: "Compare versions",
  merge: "Merge",
  compress: "Compress",
  export_text: "Export text",
  ai_summary: "AI summary",
};

export const label = (f: string) => FEATURE_LABEL[f] ?? f;
