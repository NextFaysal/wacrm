import { describe, it, expect, vi } from 'vitest';
import { triggerOrderCallVerification } from './call-verification';

describe('triggerOrderCallVerification', () => {
  it('fails gracefully when parameters are missing', async () => {
    const mockDb: any = {};
    const res = await triggerOrderCallVerification(mockDb, '', '', '', 0);
    expect(res.callInitiated).toBe(false);
  });

  it('generates 4-digit OTP and initiates call log', async () => {
    const mockDb: any = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    const res = await triggerOrderCallVerification(mockDb, 'acc-1', 'order-123', '01711111111', 1500);
    expect(res.callInitiated).toBe(true);
    expect(res.status).toBe('PENDING');
    expect(res.otpCode).toHaveLength(4);
    expect(res.message).toContain('01711111111');
  });
});
