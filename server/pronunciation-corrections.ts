/**
 * Pronunciation Corrections for Hindi Words in TTS
 * This file contains word replacements to fix pronunciation issues in Cartesia TTS
 * Optimized by AJ to read courses and common words naturally.
 */

export const pronunciationCorrections: Record<string, string> = {
  // Add custom word-by-word corrections here if needed
  // Example:
  // "NeuraXon": "Nyu Raak Son"
};

/**
 * Apply pronunciation corrections to text before sending to TTS
 * @param text - The original text
 * @returns text with pronunciation corrections applied
 */
export function applyPronunciationCorrections(text: string): string {
  let correctedText = text;

  /**
   * 🎓 Fix degree/course abbreviations
   */
  // Degree/course abbreviations - TTS-friendly phonetics
  correctedText = correctedText.replace(/\bB\.?A\b/gi, "Bee A");
  correctedText = correctedText.replace(/\bM\.?A\b/gi, "Em A");
  correctedText = correctedText.replace(/\bBCA\b/gi, "Bee See A");
  correctedText = correctedText.replace(/\bPGDCA\b/gi, "Pee Jee Dee See A");
  correctedText = correctedText.replace(/\bB\.?Sc\b/gi, "Bee Ess See");
  correctedText = correctedText.replace(/\bM\.?Sc\b/gi, "Em Ess See");
  correctedText = correctedText.replace(/\bPh\.?D\b/gi, "Pee Aych Dee");
  correctedText = correctedText.replace(/\bB\.?Com\b/gi, "Bee Kom");
  correctedText = correctedText.replace(/\bM\.?Com\b/gi, "Em Kom");

  /**
   * 🗣️ Hindi-like pronunciation for "me"
   */
  correctedText = correctedText.replace(/\bme\b/gi, "mai");

  /**
   * 🔤 Technical abbreviation cleanup
   */
  correctedText = correctedText.replace(/AI\/ML/gi, "AI ML");
  correctedText = correctedText.replace(/A\.I\./gi, "AI");
  correctedText = correctedText.replace(/M\.L\./gi, "ML");

  /**
   * 📖 Apply dictionary-based pronunciation corrections
   */
  Object.entries(pronunciationCorrections).forEach(([original, corrected]) => {
    const regex = new RegExp(`\\b${original}\\b`, "gi");
    correctedText = correctedText.replace(regex, corrected);
  });

  return correctedText;
}

/**
 * Add a new pronunciation correction dynamically
 * @param original - The original word that needs correction
 * @param corrected - The corrected pronunciation
 */
export function addPronunciationCorrection(
  original: string,
  corrected: string
): void {
  pronunciationCorrections[original.toLowerCase()] = corrected;
}

/**
 * Get all current pronunciation corrections
 * @returns Object containing all corrections
 */
export function getPronunciationCorrections(): Record<string, string> {
  return { ...pronunciationCorrections };
}
