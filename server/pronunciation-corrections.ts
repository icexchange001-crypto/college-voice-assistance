/**
 * Pronunciation Corrections for Hindi Words in TTS
 * This file contains word replacements to fix pronunciation issues in Cartesia TTS
 */

export const pronunciationCorrections: Record<string, string> = {
  // Fix common Hindi word pronunciation issues
  "hai": "hain",
  "ke": "kے",
  "ke ": "kay ", // Handle with space
  " ke": " kay", // Handle with leading space
  " ke ": " kay ", // Handle with both spaces
  
  // Add more corrections as needed
  // "word": "corrected_pronunciation"
};

/**
 * Apply pronunciation corrections to text before sending to TTS
 * @param text - The original text
 * @returns text with pronunciation corrections applied
 */
export function applyPronunciationCorrections(text: string): string {
  let correctedText = text;
  
  // Apply word-by-word corrections
  Object.entries(pronunciationCorrections).forEach(([original, corrected]) => {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    correctedText = correctedText.replace(regex, corrected);
  });
  
  return correctedText;
}

/**
 * Add a new pronunciation correction
 * @param original - The original word that needs correction
 * @param corrected - The corrected pronunciation
 */
export function addPronunciationCorrection(original: string, corrected: string): void {
  pronunciationCorrections[original.toLowerCase()] = corrected;
}

/**
 * Get all current pronunciation corrections
 * @returns Object containing all corrections
 */
export function getPronunciationCorrections(): Record<string, string> {
  return { ...pronunciationCorrections };
}