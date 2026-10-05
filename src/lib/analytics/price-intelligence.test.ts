import { describe, it, expect, vi } from 'vitest';
import { calculatePriceIntelligence } from './price-intelligence';

describe('calculatePriceIntelligence', () => {
  it('returns empty array when no products found', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };

    const res = await calculatePriceIntelligence(mockDb, 'acc-1');
    expect(res).toEqual([]);
  });

  it('suggests LOWER_PRICE for high margin product to drive volume', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'p-1',
            name: 'Luxury Watch',
            price: 3000,
            cost_price: 1000, // ~66% margin
            stock_quantity: 10,
          },
        ],
      }),
    };

    const res = await calculatePriceIntelligence(mockDb, 'acc-1');
    expect(res).toHaveLength(1);
    expect(res[0].recommendation).toBe('LOWER_PRICE');
    expect(res[0].currentMarginPercent).toBe(67);
    expect(res[0].insightText).toContain('অর্ডার ভলিউম');
  });

  it('suggests INCREASE_PRICE for low margin products (< 25%)', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'p-2',
            name: 'Low Margin Item',
            price: 1000,
            cost_price: 850, // 15% margin
            stock_quantity: 5,
          },
        ],
      }),
    };

    const res = await calculatePriceIntelligence(mockDb, 'acc-1');
    expect(res).toHaveLength(1);
    expect(res[0].recommendation).toBe('INCREASE_PRICE');
    expect(res[0].marketSuggestedPrice).toBeGreaterThan(1000);
  });
});
