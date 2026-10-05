import { describe, it, expect, vi } from 'vitest';
import { getSmartCourierRoute } from './smart-router';

describe('Smart Courier Router', () => {
  it('selects Pathao or highest scoring provider for Dhaka city address when both active', async () => {
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { provider: 'steadfast', is_active: true },
                { provider: 'pathao', is_active: true },
              ],
            }),
          }),
        }),
      }),
    };

    const result = await getSmartCourierRoute(mockSupabase, {
      accountId: 'acc-1',
      customerAddress: 'House 42, Road 11, Dhanmondi, Dhaka',
      city: 'Dhaka',
    });

    expect(result.isInsideDhaka).toBe(true);
    expect(result.recommendedProvider).toBe('pathao');
    expect(result.estimatedDeliveryFee).toBe(60);
  });

  it('selects Steadfast for outside Dhaka district address when both active', async () => {
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { provider: 'steadfast', is_active: true },
                { provider: 'pathao', is_active: true },
              ],
            }),
          }),
        }),
      }),
    };

    const result = await getSmartCourierRoute(mockSupabase, {
      accountId: 'acc-1',
      customerAddress: 'Zindabazar, Sylhet Sadar',
      city: 'Sylhet',
    });

    expect(result.isInsideDhaka).toBe(false);
    expect(result.recommendedProvider).toBe('steadfast');
    expect(result.estimatedDeliveryFee).toBe(120);
  });
});
