import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_COMMERCE_TOOLS, type ToolContext } from './tools';
import { buildBanglaSalesPrompt } from './sales-prompt';

describe('AI Commerce Agent Tools', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      db: {
        from: vi.fn(),
        rpc: vi.fn(),
      } as any,
      accountId: 'account-test-123',
      conversationId: 'conv-test-123',
      contactId: 'contact-test-123',
      configOwnerUserId: 'user-test-123',
      memory: {
        customer_name: 'Faysal',
        customer_phone: '01712345678',
      },
      currentState: 'NEW',
    };
  });

  describe('get_delivery_pricing', () => {
    it('calculates inside Dhaka delivery charge correctly', async () => {
      const mockSettings = { free_delivery_global: false, free_delivery_min_qty: 2 };
      const mockZones = [
        { code: 'inside_dhaka', name: 'ঢাকার ভেতরে', charge: 100, is_free: false, sort_order: 1 },
        { code: 'outside_dhaka', name: 'ঢাকার বাইরে', charge: 150, is_free: false, sort_order: 2 },
      ];

      (mockContext.db.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_settings') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockSettings }) }) }),
          };
        }
        if (table === 'delivery_zones') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: mockZones }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = (await AI_COMMERCE_TOOLS.get_delivery_pricing.handler(
        { address: 'Mirpur-10, Dhaka', district: 'Dhaka', quantity: 1 },
        mockContext
      )) as any;

      expect(res.deliveryCharge).toBe(100);
      expect(res.zoneName).toBe('ঢাকার ভেতরে');
      expect(res.isFree).toBe(false);
    });

    it('grants free delivery when order quantity meets threshold', async () => {
      const mockSettings = { free_delivery_global: false, free_delivery_min_qty: 2 };
      const mockZones = [
        { code: 'outside_dhaka', name: 'ঢাকার বাইরে', charge: 150, is_free: false, sort_order: 2 },
      ];

      (mockContext.db.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_settings') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockSettings }) }) }),
          };
        }
        if (table === 'delivery_zones') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: mockZones }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = (await AI_COMMERCE_TOOLS.get_delivery_pricing.handler(
        { address: 'Chittagong GEC', district: 'Chittagong', quantity: 2 },
        mockContext
      )) as any;

      expect(res.deliveryCharge).toBe(0);
      expect(res.isFree).toBe(true);
      expect(res.freeReason).toContain('বা ততোধিক পিস');
    });
  });

  describe('get_order_status', () => {
    it('returns order details with Bengali status translation', async () => {
      const mockOrder = {
        id: 'ord-12345678-uuid',
        invoice_no: 'INV-TEST-001',
        product_name: 'Curren Chronograph',
        variant: 'Black',
        quantity: 1,
        total_amount: 1950,
        advance_paid: 0,
        status: 'COURIER_BOOKED',
        courier_provider: 'steadfast',
        courier_tracking_code: 'SF12345678',
        customer_address: 'Dhanmondi, Dhaka',
        created_at: new Date().toISOString(),
      };

      (mockContext.db.from as any).mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => ({ data: [mockOrder] }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = (await AI_COMMERCE_TOOLS.get_order_status.handler(
        { phone: '01712345678' },
        mockContext
      )) as any;

      expect(res.found).toBe(true);
      expect(res.order.invoiceNo).toBe('INV-TEST-001');
      expect(res.order.statusBangla).toBe('কুরিয়ারে হস্তান্তর করা হয়েছে');
      expect(res.order.courierTrackingCode).toBe('SF12345678');
    });
  });

  describe('get_customer_profile', () => {
    it('detects returning customer with order history', async () => {
      const mockContact = { name: 'Faysal Molla', phone: '01712345678' };
      const mockOrders = [
        { id: '1', product_name: 'Poedagar Classic', total_amount: 2200, status: 'DELIVERED', created_at: '2026-01-01' },
      ];

      (mockContext.db.from as any).mockImplementation((table: string) => {
        if (table === 'contacts') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockContact }) }) }),
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: mockOrders }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = (await AI_COMMERCE_TOOLS.get_customer_profile.handler(
        { phone: '01712345678' },
        mockContext
      )) as any;

      expect(res.isReturningCustomer).toBe(true);
      expect(res.name).toBe('Faysal Molla');
      expect(res.lastPurchasedProduct).toBe('Poedagar Classic');
    });
  });

  describe('buildBanglaSalesPrompt', () => {
    it('generates a rich Bengali sales agent prompt with catalog and customer context', () => {
      const prompt = buildBanglaSalesPrompt({
        storeName: 'Watch Premium BD',
        customerName: 'Shakil',
        isReturningCustomer: true,
        activeProducts: [
          {
            id: 'p-1',
            account_id: 'a-1',
            name: 'Naviforce 9024',
            price: 2450,
            stock_quantity: 15,
            water_resistance: '3ATM',
            strap_type: 'Stainless Steel',
            colors: ['Black', 'Silver'],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
        ],
        currentState: 'COLLECTING_ORDER_INFORMATION',
      });

      expect(prompt).toContain('Watch Premium BD');
      expect(prompt).toContain('Shakil');
      expect(prompt).toContain('Naviforce 9024');
      expect(prompt).toContain('2450');
      expect(prompt).toContain('create_order');
      expect(prompt).toContain('book_courier');
    });
  });

  describe('record_advance_payment', () => {
    it('records advance payment and recalculates COD due', async () => {
      const mockOrder = {
        id: 'ord-adv-123',
        invoice_no: 'INV-ADV-999',
        total_amount: 2500,
        advance_paid: 0,
      };

      const mockQuery: any = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockOrder] }),
      };

      (mockContext.db.from as any).mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => mockQuery,
            update: () => ({
              eq: () => Promise.resolve({ data: null, error: null }),
            }),
          };
        }
        return {};
      });

      const res = (await AI_COMMERCE_TOOLS.record_advance_payment.handler(
        { phone: '01712345678', amount: 200, trxId: 'BL92K8XZ', method: 'bKash' },
        mockContext
      )) as any;

      expect(res.success).toBe(true);
      expect(res.advancePaid).toBe(200);
      expect(res.trxId).toBe('BL92K8XZ');
      expect(res.codDue).toBe(2300);
    });
  });

  describe('extractCustomerEntities with TrxID', () => {
    it('extracts bKash TrxID from Bengali customer message', async () => {
      const { extractCustomerEntities } = await import('./extractor');
      const text = 'ভাই আমি বিকাশ এ ২০০ টাকা পাঠাইছি TrxID: 9K37XZL2 ডেলিভারি দিয়েন';
      const extracted = extractCustomerEntities(text);

      expect(extracted.trxId).toBe('9K37XZL2');
      expect(extracted.paymentMethod).toBe('bKash');
    });
  });

  describe('splitIntoHumanBubbles', () => {
    it('splits long paragraph text into conversational WhatsApp bubbles', async () => {
      const { splitIntoHumanBubbles } = await import('@/lib/ai/human-simulation');
      const text = `জি ভাইয়া, এই মডেলটি আমাদের স্টকে আছে! 😊\n\nঅফার প্রাইস মাত্র ৳১৯৫০। সাথে ১ বছরের অফিসিয়াল ওয়ারেন্টি পাবেন।\n\nঅর্ডার করতে আপনার ঠিকানা ও ফোন নম্বর দিন।`;
      const bubbles = splitIntoHumanBubbles(text);

      expect(bubbles.length).toBe(3);
      expect(bubbles[0]).toContain('স্টকে আছে');
      expect(bubbles[1]).toContain('৳১৯৫০');
      expect(bubbles[2]).toContain('ঠিকানা ও ফোন নম্বর');
    });
  });
});
