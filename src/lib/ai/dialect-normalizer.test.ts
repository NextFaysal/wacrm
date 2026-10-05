import { describe, it, expect } from 'vitest';
import { normalizeRegionalDialect } from './dialect-normalizer';

describe('normalizeRegionalDialect', () => {
  it('detects and extracts clues from Banglish inquiries', () => {
    const res = normalizeRegionalDialect('bhaiya dam koto? order korbo');
    expect(res.detectedDialect).toBe('BANGLISH');
    expect(res.intentClues).toContain('মূল্য জিজ্ঞাসা');
    expect(res.intentClues).toContain('অর্ডার ক্রয় ইচ্ছা');
  });

  it('detects Chittagong dialect terms', () => {
    const res = normalizeRegionalDialect('অনারে কেংকরি পামু?');
    expect(res.detectedDialect).toBe('CHITTAGONG');
    expect(res.normalizedText).toContain('আপনাকে');
  });

  it('detects Sylheti dialect terms', () => {
    const res = normalizeRegionalDialect('খিতা খবর ভাই? কুন্তা নাই');
    expect(res.detectedDialect).toBe('SYLHETI');
    expect(res.normalizedText).toContain('কী');
    expect(res.normalizedText).toContain('কিছু');
  });

  it('detects Noakhali dialect terms', () => {
    const res = normalizeRegionalDialect('আন্নে কেমন আছেন?');
    expect(res.detectedDialect).toBe('NOAKHALI');
    expect(res.normalizedText).toContain('আপনি');
  });
});
