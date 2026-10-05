export interface DialectNormalizationResult {
  normalizedText: string;
  detectedDialect: 'BANGLISH' | 'CHITTAGONG' | 'SYLHETI' | 'NOAKHALI' | 'STANDARD_BANGLA';
  intentClues: string[];
}

/**
 * Normalizes regional dialects (Chittagonian, Sylheti, Noakhali) and Banglish
 * phrases into standard Bengali semantics for the AI reasoning pipeline.
 */
export function normalizeRegionalDialect(text: string): DialectNormalizationResult {
  let normalized = text;
  let dialect: DialectNormalizationResult['detectedDialect'] = 'STANDARD_BANGLA';
  const clues: string[] = [];

  // 1. Detect Chittagong Dialect (চাটগাঁইয়া)
  if (/আই গম|হিয়ান|হনত|আইয়ের|অনারে|কেংকরি|কেনেক্কা|খবইচ্চাল/i.test(text)) {
    dialect = 'CHITTAGONG';
    clues.push('চাটগাঁইয়া আঞ্চলিক ভাষা');
    normalized = normalized
      .replace(/অনারে/g, 'আপনাকে')
      .replace(/আই গম/g, 'আমি ভালো')
      .replace(/হনত/g, 'কোথায়')
      .replace(/কেংকরি/g, 'কেমন');
  }

  // 2. Detect Sylheti Dialect (সিলেটি)
  if (/খানির|খিতা|খেন্তায়|খররায়|আউক্কা|কুন্তা/i.test(text)) {
    dialect = 'SYLHETI';
    clues.push('সিলেটি আঞ্চলিক ভাষা');
    normalized = normalized
      .replace(/খিতা/g, 'কী')
      .replace(/কুন্তা/g, 'কিছু')
      .replace(/খররায়/g, 'করছেন');
  }

  // 3. Detect Noakhali Dialect (নোয়াখালী)
  if (/হানি|আন্নে|আইতাম|হালাই|বেয়াগতে|হন/i.test(text)) {
    dialect = 'NOAKHALI';
    clues.push('নোয়াখালী আঞ্চলিক ভাষা');
    normalized = normalized
      .replace(/আন্নে/g, 'আপনি')
      .replace(/বেয়াগতে/g, 'সবাই');
  }

  // 4. Detect Banglish (English letters for Bengali words)
  if (/^[a-zA-Z0-9\s.,?!'"-:;]*$/.test(text) && text.trim().length > 0) {
    dialect = 'BANGLISH';
    clues.push('বাংলিশ (English alphabet)');
    if (/dam koto|price|koto taka/i.test(text)) clues.push('মূল্য জিজ্ঞাসা');
    if (/kobe pabo|delivery kobe|delivery charge/i.test(text)) clues.push('ডেলিভারি তথ্য');
    if (/order confirm|order korbo|nite chai/i.test(text)) clues.push('অর্ডার ক্রয় ইচ্ছা');
  }

  return {
    normalizedText: normalized,
    detectedDialect: dialect,
    intentClues: clues,
  };
}
