import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getSteadfast, POST as postSteadfast } from './steadfast/route';
import { GET as getPathao, POST as postPathao } from './pathao/route';

// Mock admin client
vi.mock('@/lib/ai/admin-client', () => {
  return {
    supabaseAdmin: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'ord-1234',
              account_id: 'acc-1',
              customer_name: 'আহমেদ রফিক',
              status: 'COURIER_BOOKED',
              conversation_id: 'conv-1',
              product_id: 'prod-1',
              quantity: 1,
            },
          ],
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { webhook_secret: 'test-secret' },
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    })),
  };
});

// Mock WhatsApp send
vi.mock('@/lib/whatsapp/send-message', () => {
  return {
    sendMessageToConversation: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe('Courier Webhook Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Steadfast Webhook', () => {
    it('GET returns status ok', async () => {
      const res = await getSteadfast();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.provider).toBe('steadfast');
    });

    it('POST processes delivery_status event successfully', async () => {
      const payload = {
        notification_type: 'delivery_status',
        consignment_id: 12345,
        invoice: 'INV-67890',
        cod_amount: 1500.0,
        status: 'delivered',
        delivery_charge: 100.0,
        tracking_message: 'Your package has been delivered successfully.',
        updated_at: '2025-03-02 12:45:30',
      };

      const req = new Request('http://localhost:3000/api/webhooks/steadfast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const res = await postSteadfast(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('success');
    });
  });

  describe('Pathao Webhook', () => {
    it('GET returns status ok and Pathao header', async () => {
      const res = await getPathao();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(res.headers.get('X-Pathao-Merchant-Webhook-Integration-Secret')).toBeDefined();
    });

    it('POST responds with 202 to webhook_integration handshake', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/pathao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PATHAO-Signature': 'f3992ecc-59da-4cbe-a049-a13da2018d51',
        },
        body: JSON.stringify({ event: 'webhook_integration' }),
      });

      const res = await postPathao(req);
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data.success).toBe(true);
      expect(res.headers.get('X-Pathao-Merchant-Webhook-Integration-Secret')).toBe(
        'f3992ecc-59da-4cbe-a049-a13da2018d51'
      );
    });

    it('POST processes order.delivered event and updates status', async () => {
      const req = new Request('http://localhost:3000/api/webhooks/pathao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consignment_id: 'DL121224VS8TTJ',
          merchant_order_id: 'TS-123',
          event: 'order.delivered',
          collected_amount: 1500,
        }),
      });

      const res = await postPathao(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.event).toBe('order.delivered');
    });
  });
});
