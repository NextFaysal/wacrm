import { describe, it, expect } from 'vitest';
import {
  calculateCustomerLoyaltyTier,
  getReplenishmentAlerts,
} from './vip-engine';

describe('VIP Loyalty Engine', () => {
  describe('calculateCustomerLoyaltyTier', () => {
    it('returns NEW for customer with zero orders', () => {
      const profile = calculateCustomerLoyaltyTier([]);
      expect(profile.tier).toBe('NEW');
      expect(profile.totalOrders).toBe(0);
      expect(profile.isVip).toBe(false);
      expect(profile.discountPercent).toBe(0);
    });

    it('returns BRONZE for customer with 1 order', () => {
      const profile = calculateCustomerLoyaltyTier([
        { total_amount: 1500, status: 'DELIVERED', created_at: '2026-09-01' },
      ]);
      expect(profile.tier).toBe('BRONZE');
      expect(profile.totalOrders).toBe(1);
      expect(profile.totalSpend).toBe(1500);
      expect(profile.isVip).toBe(false);
    });

    it('returns SILVER for 2 orders totalling 3000', () => {
      const profile = calculateCustomerLoyaltyTier([
        { total_amount: 1500, status: 'DELIVERED', created_at: '2026-09-01' },
        { total_amount: 1500, status: 'DELIVERED', created_at: '2026-09-15' },
      ]);
      expect(profile.tier).toBe('SILVER');
      expect(profile.totalOrders).toBe(2);
      expect(profile.totalSpend).toBe(3000);
      expect(profile.discountPercent).toBe(5);
    });

    it('returns GOLD for 3 orders totalling 5500', () => {
      const profile = calculateCustomerLoyaltyTier([
        { total_amount: 2000, status: 'DELIVERED', created_at: '2026-08-01' },
        { total_amount: 2000, status: 'DELIVERED', created_at: '2026-08-20' },
        { total_amount: 1500, status: 'DELIVERED', created_at: '2026-09-10' },
      ]);
      expect(profile.tier).toBe('GOLD');
      expect(profile.totalOrders).toBe(3);
      expect(profile.isVip).toBe(true);
      expect(profile.discountPercent).toBe(8);
      expect(profile.loyaltyBadgeBangla).toContain('গোল্ড মেম্বার');
    });

    it('returns VIP for 5+ orders', () => {
      const orders = [1, 2, 3, 4, 5].map((n) => ({
        total_amount: 2000,
        status: 'DELIVERED',
        created_at: `2026-0${n}-01`,
      }));
      const profile = calculateCustomerLoyaltyTier(orders);
      expect(profile.tier).toBe('VIP');
      expect(profile.totalOrders).toBe(5);
      expect(profile.totalSpend).toBe(10000);
      expect(profile.discountPercent).toBe(12);
      expect(profile.isVip).toBe(true);
      expect(profile.loyaltyBadgeBangla).toContain('ভিআইপি');
    });

    it('ignores CANCELLED and RETURNED orders from spend and tier calculation', () => {
      const orders = [
        { total_amount: 1500, status: 'DELIVERED', created_at: '2026-08-01' },
        { total_amount: 5000, status: 'CANCELLED', created_at: '2026-08-10' },
        { total_amount: 3000, status: 'RETURNED', created_at: '2026-08-15' },
      ];
      const profile = calculateCustomerLoyaltyTier(orders);
      expect(profile.tier).toBe('BRONZE');
      expect(profile.totalOrders).toBe(1);
      expect(profile.totalSpend).toBe(1500);
    });
  });

  describe('getReplenishmentAlerts', () => {
    it('detects product due for replenishment after 30 days', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const orders = [
        {
          id: 'ord-rep-1',
          product_id: 'prod-hair-oil',
          product_name: 'Organic Onion Hair Oil (200ml)',
          quantity: 1,
          created_at: thirtyDaysAgo,
          status: 'DELIVERED',
        },
      ];

      const alerts = getReplenishmentAlerts('Faysal', orders, 30);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].isDueForReorder).toBe(true);
      expect(alerts[0].productName).toContain('Hair Oil');
      expect(alerts[0].suggestedMessageBangla).toContain('Faysal ভাই');
      expect(alerts[0].suggestedDiscountCode).toBe('REORDER5');
    });

    it('does not trigger reorder if purchased only 5 days ago', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const orders = [
        {
          id: 'ord-rep-2',
          product_id: 'prod-hair-oil',
          product_name: 'Organic Onion Hair Oil (200ml)',
          quantity: 1,
          created_at: fiveDaysAgo,
          status: 'DELIVERED',
        },
      ];

      const alerts = getReplenishmentAlerts('Faysal', orders, 30);
      expect(alerts).toHaveLength(0);
    });
  });
});
