import { describe, it, expect, vi } from 'vitest';
import { matchProductFromImage } from './visual-matcher';

describe('matchProductFromImage', () => {
  it('returns false when no keywords provided', async () => {
    const mockDb: any = {};
    const res = await matchProductFromImage(mockDb, 'acc-1', '');
    expect(res.matched).toBe(false);
  });

  it('matches product by name in visual text', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prod-1',
            name: 'Rolex Submariner Black',
            price: 2500,
            stock_quantity: 5,
          },
        ],
      }),
    };

    const res = await matchProductFromImage(mockDb, 'acc-1', 'I want this Rolex Submariner Black');
    expect(res.matched).toBe(true);
    expect(res.product?.name).toBe('Rolex Submariner Black');
    expect(res.confidence).toBe(0.95);
    expect(res.message).toContain('Rolex Submariner Black');
  });
});
