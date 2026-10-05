import { describe, it, expect } from 'vitest';
import { analyzeCustomerObjection } from './objection-learner';

describe('analyzeCustomerObjection', () => {
  it('identifies price objection and gives discount pitch', () => {
    const res = analyzeCustomerObjection('ভাই দাম একটু বেশি মনে হচ্ছে, কিছু কমান');
    expect(res.type).toBe('PRICE_TOO_HIGH');
    expect(res.confidence).toBeGreaterThan(0.8);
    expect(res.adaptiveCounterPitch).toContain('কোয়ালিটি বিবেচনায়');
  });

  it('identifies originality doubts and gives COD check assurance', () => {
    const res = analyzeCustomerObjection('এটা আসল তো ভাই নাকি নকল প্রোডাক্ট?');
    expect(res.type).toBe('DOUBT_ORIGINALITY');
    expect(res.adaptiveCounterPitch).toContain('১০০% অরিজিনাল');
    expect(res.adaptiveCounterPitch).toContain('খুলে চেক করে দেখে');
  });

  it('identifies delivery charge hesitation', () => {
    const res = analyzeCustomerObjection('ডেলিভারি চার্জ বেশি ভাইয়া');
    expect(res.type).toBe('DELIVERY_CHARGE_ISSUE');
    expect(res.adaptiveCounterPitch).toContain('২টি পণ্য একসাথে');
  });

  it('returns UNKNOWN for neutral text', () => {
    const res = analyzeCustomerObjection('ঠিকানা ঢাকা উত্তরা');
    expect(res.type).toBe('UNKNOWN');
  });
});
