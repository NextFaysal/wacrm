import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toInternationalBdPhone,
  getAccountFollowupSettings,
  runAccountFollowupQueue,
  DEFAULT_FOLLOWUP_SETTINGS,
} from './dispatcher';

vi.mock('@/lib/ai/business-context', () => ({
  loadBusinessContext: vi.fn().mockResolvedValue({
    storeName: 'টেস্ট শপ',
    supportPhone: '01700000000',
    whatsappNumber: '01700000000',
    advanceDeliveryFee: 150,
  }),
}));

vi.mock('@/lib/whatsapp/resolve-conversation', () => ({
  resolveConversationByPhone: vi.fn().mockResolvedValue({
    conversationId: 'mock-conv-123',
    contactId: 'mock-contact-123',
    contactCreated: false,
  }),
}));

vi.mock('@/lib/whatsapp/send-message', () => ({
  sendMessageToConversation: vi.fn().mockResolvedValue({
    messageId: 'msg-123',
    whatsappMessageId: 'wamid-123',
  }),
}));

vi.mock('@/lib/ai/agent/abandoned-recovery', () => ({
  runAbandonedCartRecovery: vi.fn().mockResolvedValue({
    processed: 2,
    recoveredSent: 1,
    skipped: 1,
  }),
}));

describe('Automated Followup Dispatcher', () => {
  describe('toInternationalBdPhone', () => {
    it('normalizes 11-digit BD mobile starting with 01', () => {
      expect(toInternationalBdPhone('01712345678')).toBe('+8801712345678');
      expect(toInternationalBdPhone('01899887766')).toBe('+8801899887766');
    });

    it('normalizes 880 prefix', () => {
      expect(toInternationalBdPhone('8801712345678')).toBe('+8801712345678');
    });

    it('preserves existing +880 format', () => {
      expect(toInternationalBdPhone('+8801712345678')).toBe('+8801712345678');
    });
  });

  describe('getAccountFollowupSettings', () => {
    it('returns default settings when database returns null', async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      };

      const settings = await getAccountFollowupSettings(mockDb, 'acc-123');
      expect(settings.account_id).toBe('acc-123');
      expect(settings.abandoned_checkout_enabled).toBe(true);
      expect(settings.abandoned_checkout_delay_minutes).toBe(45);
      expect(settings.advance_payment_enabled).toBe(true);
      expect(settings.advance_payment_delay_hours).toBe(2);
    });
  });

  describe('runAccountFollowupQueue', () => {
    it('returns 0 processed if whatsapp_config is missing', async () => {
      const mockDb: any = {
        from: vi.fn((table: string) => {
          if (table === 'whatsapp_config') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await runAccountFollowupQueue(mockDb, 'acc-123');
      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
    });
  });
});
