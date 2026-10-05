import { describe, it, expect } from 'vitest';
import { matchFastStoreFaq } from './fast-faq';
import { normalizeBdLocation } from '@/lib/courier/bd-geo';

describe('High-Volume Scale Optimizations (1000+ Customers/Day)', () => {
  describe('Ultra-Fast Store FAQ Matcher (< 5ms response, 0 LLM Cost)', () => {
    const watchCtx = {
      businessType: 'watches' as const,
      productNoun: 'ঘড়ি',
      warrantyPolicy: 'এক বছরে মেশিন এবং কালারের ওয়ারেন্টি থাকবে',
      insideDhakaCharge: 60,
      outsideDhakaCharge: 120,
      freeDeliveryMinQty: 2,
    };

    it('matches warranty questions instantly with exact store policy', () => {
      const result = matchFastStoreFaq('ঘড়ির ওয়ারেন্টি কতদিন থাকবে ভাই?', watchCtx);
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('WARRANTY');
      expect(result.replyText).toContain('এক বছরে মেশিন এবং কালারের ওয়ারেন্টি থাকবে');
    });

    it('matches delivery time questions with exact Dhaka vs Outside timeline', () => {
      const result = matchFastStoreFaq('অর্ডার করলে কবে পাবো? কতদিন লাগবে?');
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('DELIVERY_TIME');
      expect(result.replyText).toContain('ঢাকার ভিতরে ২৪ থেকে ৪৮ ঘন্টা');
    });

    it('matches delivery fee questions with free shipping incentive', () => {
      const result = matchFastStoreFaq('আপনাদের ডেলিভারি চার্জ কত?', watchCtx);
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('DELIVERY_CHARGE');
      expect(result.replyText).toContain('ঢাকার ভিতরে মাত্র ৳60');
      expect(result.replyText).toContain('2টি বা ততোধিক ঘড়ি');
    });

    it('matches cash on delivery and open-box checking inquiries', () => {
      const result = matchFastStoreFaq('পার্সেল কি খুলে দেখে টাকা দেওয়া যাবে?');
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('COD_VERIFICATION');
      expect(result.replyText).toContain('ক্যাশ অন ডেলিভারি');
    });

    it('matches water resistance inquiries with clear instructions', () => {
      const result = matchFastStoreFaq('ঘড়িটা কি ওয়াটারপ্রুফ? পানি লাগলে কি নষ্ট হবে?', watchCtx);
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('WATER_RESISTANCE');
      expect(result.replyText).toContain('Water resistant');
    });

    it('matches battery and extra gift inquiries', () => {
      const result = matchFastStoreFaq('ঘড়ির ব্যাটারি কেমন থাকবে?', watchCtx);
      expect(result.matched).toBe(true);
      expect(result.intent).toBe('BATTERY_AND_GIFT');
      expect(result.replyText).toContain('হাই-কোয়ালিটি লং-লাস্টিং ব্যাটারি');
    });

    it('matches polite decline / future purchase gracefully', () => {
      const result1 = matchFastStoreFaq('আমি এখন নিব না, পরে নিব');
      expect(result1.matched).toBe(true);
      expect(result1.intent).toBe('FUTURE_PURCHASE');
      expect(result1.replyText).toContain('কোন ব্যাপার না');

      const result2 = matchFastStoreFaq('এখন নেব না');
      expect(result2.matched).toBe(true);
      expect(result2.intent).toBe('FUTURE_PURCHASE');

      const result3 = matchFastStoreFaq('আর লাগবে না cancel');
      expect(result3.matched).toBe(true);
      expect(result3.intent).toBe('FUTURE_PURCHASE');
    });
  });

  describe('Bangladesh 64 Districts & Thana Auto-Correction Engine', () => {
    it('normalizes informal Dhaka metro addresses', () => {
      const loc = normalizeBdLocation('House 12, Road 4, Mirpur 10, Dhaka');
      expect(loc.district).toBe('Dhaka');
      expect(loc.isInsideDhaka).toBe(true);
      expect(loc.suggestedDeliveryFee).toBe(70);
    });

    it('corrects misspelled and abbreviated Chattogram (ctg, chittagong)', () => {
      const loc = normalizeBdLocation('GEC Circle, Ctg');
      expect(loc.district).toBe('Chattogram');
      expect(loc.isInsideDhaka).toBe(false);
      expect(loc.suggestedDeliveryFee).toBe(120);
    });

    it('corrects Gazipur / Tongi addresses', () => {
      const loc = normalizeBdLocation('Board Bazar, Gazipor');
      expect(loc.district).toBe('Gazipur');
      expect(loc.isInsideDhaka).toBe(false);
    });

    it('corrects Sylhet / Sylet variations', () => {
      const loc = normalizeBdLocation('Zindabazar, shylet');
      expect(loc.district).toBe('Sylhet');
      expect(loc.isInsideDhaka).toBe(false);
    });

    it('corrects Cumilla / Comilla variations', () => {
      const loc = normalizeBdLocation('Kandirpar, comilla');
      expect(loc.district).toBe('Cumilla');
      expect(loc.isInsideDhaka).toBe(false);
    });
  });

  describe('Human-Like E-Commerce Intelligence (Order Tracking, Complaints & Upsell)', () => {
    it('detects order status inquiries and extracts invoice number', async () => {
      const { extractCustomerEntities } = await import('./extractor');
      const ext1 = extractCustomerEntities('আমার অর্ডার কোথায়? invoice WG-1042');
      expect(ext1.detectedIntent).toBe('ORDER_STATUS_INQUIRY');
      expect(ext1.invoiceNo).toBe('WG-1042');

      const ext2 = extractCustomerEntities('পার্সেল কি পাঠাইছেন? ট্র্যাকিং কোড দেন');
      expect(ext2.detectedIntent).toBe('ORDER_STATUS_INQUIRY');
    });

    it('detects product defect or exchange requests gracefully', async () => {
      const { extractCustomerEntities } = await import('./extractor');
      const ext = extractCustomerEntities('ঘড়িটা কাজ করে না, সমস্যা আছে। কালার চেঞ্জ করতে চাই');
      expect(ext.detectedIntent).toBe('RETURN_OR_COMPLAINT');
    });

    it('detects alternate watch recommendations request', async () => {
      const { extractCustomerEntities } = await import('./extractor');
      const ext = extractCustomerEntities('আপনাদের আর কি কি ঘড়ি আছে? অন্য মডেল দেখান');
      expect(ext.detectedIntent).toBe('RECOMMENDATION_INQUIRY');
    });
  });
});
