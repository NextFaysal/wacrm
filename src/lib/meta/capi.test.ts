import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hashMetaField,
  normalizePhoneForMeta,
  sendMetaCapiEvent,
  trackOrderPurchaseCapi,
} from './capi';

describe('Meta Conversions API (CAPI)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('hashMetaField', () => {
    it('returns SHA-256 hash of normalized lowercased string', () => {
      // "test" sha256 is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      expect(hashMetaField('  TEST  ')).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });

    it('returns undefined for empty input', () => {
      expect(hashMetaField(undefined)).toBeUndefined();
      expect(hashMetaField('')).toBeUndefined();
      expect(hashMetaField('   ')).toBeUndefined();
    });
  });

  describe('normalizePhoneForMeta', () => {
    it('prepends 88 to 11-digit Bangladeshi mobile numbers', () => {
      expect(normalizePhoneForMeta('01712345678')).toBe('8801712345678');
      expect(normalizePhoneForMeta('+8801712345678')).toBe('8801712345678');
      expect(normalizePhoneForMeta('8801712345678')).toBe('8801712345678');
    });

    it('returns undefined for null or too short phone numbers', () => {
      expect(normalizePhoneForMeta(undefined)).toBeUndefined();
      expect(normalizePhoneForMeta('123')).toBeUndefined();
    });
  });

  describe('sendMetaCapiEvent', () => {
    it('returns error if pixelId or accessToken are missing', async () => {
      const res = await sendMetaCapiEvent({}, {
        eventName: 'Purchase',
        userData: {},
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Meta Pixel ID or CAPI Access Token is not configured');
    });

    it('sends correctly hashed user data and payload to Meta Graph API', async () => {
      let capturedUrl = '';
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ events_received: 1, fbtrace_id: 'TRACE-123' }),
        };
      });

      const res = await sendMetaCapiEvent(
        {
          pixelId: '987654321',
          accessToken: 'EAAtesttoken123',
          testEventCode: 'TEST999',
        },
        {
          eventName: 'Purchase',
          eventId: 'ORD-1001',
          userData: {
            phone: '01711223344',
            name: 'Faysal Molla',
            city: 'Dhaka',
          },
          customData: {
            value: 1250,
            currency: 'BDT',
            orderId: 'INV-1001',
          },
        }
      );

      expect(res.success).toBe(true);
      expect(res.eventsReceived).toBe(1);
      expect(res.fbtraceId).toBe('TRACE-123');

      expect(capturedUrl).toContain('987654321/events');
      expect(capturedUrl).toContain('access_token=EAAtesttoken123');

      expect(capturedBody.test_event_code).toBe('TEST999');
      expect(capturedBody.data).toHaveLength(1);

      const event = capturedBody.data[0];
      expect(event.event_name).toBe('Purchase');
      expect(event.event_id).toBe('ORD-1001');
      expect(event.action_source).toBe('chat');
      expect(event.custom_data.value).toBe(1250);
      expect(event.custom_data.currency).toBe('BDT');

      // Check that phone was hashed
      const expectedPhoneHash = hashMetaField('8801711223344');
      expect(event.user_data.ph).toEqual([expectedPhoneHash]);
    });
  });

  describe('trackOrderPurchaseCapi', () => {
    it('creates and sends Purchase event from order model', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1, fbtrace_id: 'TRACE-ORDER' }),
      });

      const res = await trackOrderPurchaseCapi(
        { pixelId: '123', accessToken: 'token' },
        {
          id: 'ord-xyz',
          invoice_no: 'INV-555',
          total_amount: 3200,
          customer_phone: '01812345678',
          customer_name: 'Karim Rahman',
          items: [{ id: 'prod-1', name: 'Smart Watch', quantity: 2, price: 1600 }],
        }
      );

      expect(res.success).toBe(true);
    });
  });

  describe('getMetaCapiConfig', () => {
    it('retrieves config from database when available', async () => {
      const { getMetaCapiConfig } = await import('./capi');
      const mockDb = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  meta_pixel_id: 'DB-PIXEL-777',
                  meta_capi_access_token: 'DB-TOKEN-888',
                  meta_capi_test_code: 'TEST-CODE',
                },
              }),
            }),
          }),
        }),
      };

      const cfg = await getMetaCapiConfig('acc-123', mockDb);
      expect(cfg.pixelId).toBe('DB-PIXEL-777');
      expect(cfg.accessToken).toBe('DB-TOKEN-888');
      expect(cfg.testEventCode).toBe('TEST-CODE');
    });
  });
});
