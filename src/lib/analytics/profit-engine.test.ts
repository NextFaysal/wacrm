import { describe, it, expect } from 'vitest';
import {
  calculateOrderProfitability,
  calculateBatchProfitability,
} from './profit-engine';

describe('Profit & Unit Economics Engine', () => {
  describe('calculateOrderProfitability', () => {
    it('calculates net profit and margins correctly for delivered order', () => {
      const result = calculateOrderProfitability({
        sellingPrice: 1500,
        cogs: 600,
        customerDeliveryFee: 60,
        courierDeliveryCost: 60,
        codFeePercent: 0.01, // ৳15
        adSpendPerOrder: 200,
        packagingCost: 25,
        isReturned: false,
      });

      // Gross Revenue: 1500 + 60 = 1560
      // Expenses: cogs (600) + courier (60) + cod (15) + packaging (25) + adSpend (200) = 900
      // Net Profit: 1560 - 900 = 660
      expect(result.grossRevenue).toBe(1560);
      expect(result.netProfit).toBe(660);
      expect(result.profitMarginPercent).toBeCloseTo(42.3, 0);
      expect(result.breakEvenRoas).toBeGreaterThan(1);
    });

    it('computes net loss for returned (RTO) order', () => {
      const result = calculateOrderProfitability({
        sellingPrice: 1500,
        cogs: 600,
        customerDeliveryFee: 60,
        courierDeliveryCost: 120,
        returnCourierCost: 60,
        packagingCost: 25,
        adSpendPerOrder: 200,
        isReturned: true,
      });

      // Returned order loses: courier delivery (120) + return fee (60) + packaging (25) + adSpend (200) = 405
      expect(result.grossRevenue).toBe(0);
      expect(result.netProfit).toBe(-405);
      expect(result.expensesBreakdown.shippingNetLoss).toBe(120);
      expect(result.expensesBreakdown.returnLoss).toBe(60);
    });
  });

  describe('calculateBatchProfitability', () => {
    it('aggregates cohort metrics across delivered and returned orders', () => {
      const orders = [
        { sellingPrice: 1500, cogs: 600, customerDeliveryFee: 60, courierDeliveryCost: 60, status: 'DELIVERED' },
        { sellingPrice: 1500, cogs: 600, customerDeliveryFee: 60, courierDeliveryCost: 60, status: 'DELIVERED' },
        { sellingPrice: 1500, cogs: 600, customerDeliveryFee: 60, courierDeliveryCost: 120, status: 'RETURNED' },
      ];

      const batch = calculateBatchProfitability(orders, { packagingCostDefault: 20, adSpendPerOrderDefault: 100 });

      expect(batch.totalOrders).toBe(3);
      expect(batch.deliveredOrders).toBe(2);
      expect(batch.returnedOrders).toBe(1);
      expect(batch.returnRatePercent).toBeCloseTo(33.3, 0);
      expect(batch.totalNetProfit).toBeGreaterThan(0);
    });
  });
});
