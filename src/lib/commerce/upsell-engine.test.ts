import { describe, it, expect, vi } from 'vitest';
import { getSmartUpsellRecommendation } from './upsell-engine';

describe('getSmartUpsellRecommendation', () => {
  it('returns hasUpsell: false when no products found', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };

    const res = await getSmartUpsellRecommendation(mockDb, 'acc-1', 'prod-1');
    expect(res.hasUpsell).toBe(false);
  });

  it('calculates bundle discount and combo text for matching product', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prod-2',
            name: 'প্রিমিয়াম বক্স ও এক্সট্রা বেল্ট',
            price: 500,
            image_url: 'https://example.com/box.jpg',
          },
        ],
      }),
    };

    const res = await getSmartUpsellRecommendation(mockDb, 'acc-1', 'prod-1');
    expect(res.hasUpsell).toBe(true);
    expect(res.upsellProduct?.name).toBe('প্রিমিয়াম বক্স ও এক্সট্রা বেল্ট');
    expect(res.bundleDiscountAmount).toBe(75); // 15% of 500
    expect(res.comboOfferText).toContain('স্পেশাল কম্বো অফার');
  });
});
