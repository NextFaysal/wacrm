export interface OrderCostInput {
  sellingPrice: number;
  cogs: number;
  customerDeliveryFee: number;
  courierDeliveryCost: number;
  codFeePercent?: number; // e.g. 0.01 for 1%
  adSpendPerOrder?: number;
  packagingCost?: number;
  isReturned?: boolean;
  returnCourierCost?: number;
}

export interface OrderProfitBreakdown {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  roiPercent: number;
  breakEvenRoas: number;
  expensesBreakdown: {
    cogs: number;
    shippingNetLoss: number;
    courierCodFee: number;
    packagingCost: number;
    adSpend: number;
    returnLoss: number;
  };
}

export interface BatchProfitSummary {
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  returnRatePercent: number;
  totalRevenue: number;
  totalExpenses: number;
  totalNetProfit: number;
  averageProfitPerOrder: number;
  overallMarginPercent: number;
}

/**
 * Calculates real-time net profit and unit economics for a single Bangladeshi e-commerce order
 */
export function calculateOrderProfitability(input: OrderCostInput): OrderProfitBreakdown {
  const {
    sellingPrice,
    cogs,
    customerDeliveryFee,
    courierDeliveryCost,
    codFeePercent = 0.01, // Steadfast/Pathao 1% standard COD charge
    adSpendPerOrder = 0,
    packagingCost = 25, // Average flyer + box + bubble wrap
    isReturned = false,
    returnCourierCost = 60, // Standard return courier deduction
  } = input;

  if (isReturned) {
    // Order was returned (RTO) - zero product revenue collected, merchant loses packaging + delivery + return fee + ad spend
    const shippingNetLoss = courierDeliveryCost;
    const returnLoss = returnCourierCost;
    const totalExpenses = shippingNetLoss + returnLoss + packagingCost + adSpendPerOrder;
    const grossRevenue = 0;
    const netProfit = -totalExpenses;

    return {
      grossRevenue,
      totalExpenses,
      netProfit,
      profitMarginPercent: 0,
      roiPercent: -100,
      breakEvenRoas: 0,
      expensesBreakdown: {
        cogs: 0, // Product returned to inventory undamaged
        shippingNetLoss,
        courierCodFee: 0,
        packagingCost,
        adSpend: adSpendPerOrder,
        returnLoss,
      },
    };
  }

  // Successfully delivered order
  const grossRevenue = sellingPrice + customerDeliveryFee;
  const shippingNetLoss = Math.max(0, courierDeliveryCost - customerDeliveryFee);
  const codFee = Math.round(sellingPrice * codFeePercent);
  const totalExpenses = cogs + shippingNetLoss + codFee + packagingCost + adSpendPerOrder;
  const netProfit = grossRevenue - (cogs + courierDeliveryCost + codFee + packagingCost + adSpendPerOrder);
  const profitMarginPercent = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;
  const roiPercent = totalExpenses > 0 ? Math.round((netProfit / totalExpenses) * 1000) / 10 : 0;

  // Break-even ROAS = Gross Margin Ratio inverse
  const grossMargin = grossRevenue - (cogs + courierDeliveryCost + codFee + packagingCost);
  const breakEvenRoas = grossMargin > 0 ? Math.round((grossRevenue / grossMargin) * 100) / 100 : 0;

  return {
    grossRevenue,
    totalExpenses,
    netProfit,
    profitMarginPercent,
    roiPercent,
    breakEvenRoas,
    expensesBreakdown: {
      cogs,
      shippingNetLoss,
      courierCodFee: codFee,
      packagingCost,
      adSpend: adSpendPerOrder,
      returnLoss: 0,
    },
  };
}

/**
 * Aggregates profitability metrics across a cohort of orders
 */
export function calculateBatchProfitability(
  orders: Array<{
    sellingPrice: number;
    cogs?: number;
    customerDeliveryFee?: number;
    courierDeliveryCost?: number;
    status?: string;
  }>,
  defaultCosts: {
    cogsDefault?: number;
    courierCostDefault?: number;
    customerDeliveryDefault?: number;
    packagingCostDefault?: number;
    adSpendPerOrderDefault?: number;
  } = {}
): BatchProfitSummary {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalNetProfit = 0;
  let deliveredOrders = 0;
  let returnedOrders = 0;

  for (const o of orders) {
    const isReturned = ['RETURNED', 'FAILED', 'CANCELLED'].includes(String(o.status || '').toUpperCase());
    if (isReturned) {
      returnedOrders++;
    } else {
      deliveredOrders++;
    }

    const breakdown = calculateOrderProfitability({
      sellingPrice: o.sellingPrice,
      cogs: o.cogs ?? defaultCosts.cogsDefault ?? Math.round(o.sellingPrice * 0.4),
      customerDeliveryFee: o.customerDeliveryFee ?? defaultCosts.customerDeliveryDefault ?? 60,
      courierDeliveryCost: o.courierDeliveryCost ?? defaultCosts.courierCostDefault ?? 100,
      packagingCost: defaultCosts.packagingCostDefault ?? 25,
      adSpendPerOrder: defaultCosts.adSpendPerOrderDefault ?? 0,
      isReturned,
    });

    totalRevenue += breakdown.grossRevenue;
    totalExpenses += breakdown.totalExpenses;
    totalNetProfit += breakdown.netProfit;
  }

  const totalOrders = orders.length;
  const returnRatePercent = totalOrders > 0 ? Math.round((returnedOrders / totalOrders) * 1000) / 10 : 0;
  const averageProfitPerOrder = totalOrders > 0 ? Math.round(totalNetProfit / totalOrders) : 0;
  const overallMarginPercent = totalRevenue > 0 ? Math.round((totalNetProfit / totalRevenue) * 1000) / 10 : 0;

  return {
    totalOrders,
    deliveredOrders,
    returnedOrders,
    returnRatePercent,
    totalRevenue,
    totalExpenses,
    totalNetProfit,
    averageProfitPerOrder,
    overallMarginPercent,
  };
}
