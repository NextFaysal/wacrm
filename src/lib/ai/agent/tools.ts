import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationMemory, ConversationState, Order } from '@/types/commerce';
import type { Product } from '@/types/watch';
import { calculateCustomerRisk, validateBDPhone, validateAddressCompleteness } from './risk-engine';
import { dispatchCourierOrder, getLiveCourierTracking } from '@/lib/courier/dispatch';
import { normalizeBdLocation } from '@/lib/courier/bd-geo';
import { getSmartCourierRoute } from '@/lib/courier/smart-router';
import { getTrackingUrl } from '@/lib/courier/utils';
import { engineSendText, engineSendMedia } from '@/lib/flows/meta-send';
import { getSmartUpsellRecommendation } from '@/lib/commerce/upsell-engine';
import { matchProductFromImage } from '@/lib/ai/visual-matcher';

export interface ToolContext {
  db: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  configOwnerUserId: string;
  memory: ConversationMemory;
  currentState: ConversationState;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export const AI_COMMERCE_TOOLS: Record<string, ToolDefinition> = {
  // 1. get_product
  get_product: {
    name: 'get_product',
    description: 'Retrieve verified product specifications, price (à§³), stock quantity, and available colors from the database.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Database ID of the product' },
        sku: { type: 'string', description: 'Model code or SKU of the product' },
        name: { type: 'string', description: 'Product title or keywords' },
      },
    },
    handler: async (args, ctx) => {
      let query = ctx.db.from('products').select('*').eq('account_id', ctx.accountId);
      if (args.productId) {
        query = query.eq('id', args.productId);
      } else if (args.sku) {
        query = query.ilike('sku', `%${args.sku}%`);
      } else if (args.name) {
        query = query.ilike('name', `%${args.name}%`);
      } else {
        return { error: 'Please provide productId, sku, or name' };
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return { found: false, error: 'Product not found in catalog' };

      return {
        found: true,
        product: data as Product,
        verified_specs: {
          name: data.name,
          sku: data.sku,
          price: data.price,
          regular_price: data.regular_price,
          in_stock: data.stock_quantity > 0,
          stock_quantity: data.stock_quantity,
          dial_size: data.dial_size,
          water_resistance: data.water_resistance,
          movement: data.movement,
          strap_type: data.strap_type,
          colors: data.colors,
          variants: data.variants,
          custom_attributes: data.custom_attributes,
          warranty_months: data.warranty_months,
          image_url: data.image_url,
        },
      };
    },
  },

  // 2. search_products
  search_products: {
    name: 'search_products',
    description: 'Search available products by keyword or category.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords or product name' },
        category: { type: 'string', description: 'Category name or type' },
      },
      required: ['query'],
    },
    handler: async (args, ctx) => {
      let q = ctx.db
        .from('products')
        .select('id, name, sku, price, regular_price, dial_size, movement, water_resistance, colors, stock_quantity, image_url')
        .eq('account_id', ctx.accountId)
        .eq('is_active', true);

      if (args.category && args.category !== 'all') {
        q = q.eq('category', args.category);
      }
      if (args.query) {
        q = q.ilike('name', `%${args.query}%`);
      }

      const { data, error } = await q.limit(5);
      if (error) return { error: error.message };
      return { count: data?.length || 0, products: data || [] };
    },
  },

  // 3. check_stock
  check_stock: {
    name: 'check_stock',
    description: 'Check verified stock quantity and availability for a product.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID' },
      },
      required: ['productId'],
    },
    handler: async (args, ctx) => {
      const { data, error } = await ctx.db
        .from('products')
        .select('id, name, stock_quantity, is_active')
        .eq('id', args.productId)
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      if (error || !data) return { error: 'Product not found' };
      const inStock = data.is_active && data.stock_quantity > 0;
      return {
        productId: data.id,
        name: data.name,
        inStock,
        availableQuantity: data.stock_quantity,
      };
    },
  },

  // 4. search_similar_products
  search_similar_products: {
    name: 'search_similar_products',
    description: 'Find similar in-stock products when a requested item is out of stock.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category name or filter' },
        excludeId: { type: 'string', description: 'Current product ID to exclude' },
      },
    },
    handler: async (args, ctx) => {
      let q = ctx.db
        .from('products')
        .select('id, name, sku, price, colors, dial_size, image_url')
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
        .gt('stock_quantity', 0);

      if (args.excludeId) {
        q = q.neq('id', args.excludeId);
      }
      if (args.category) {
        q = q.eq('category', args.category);
      }

      const { data } = await q.limit(3);
      return { count: data?.length || 0, recommendations: data || [] };
    },
  },

  // 5. get_customer_order_history
  get_customer_order_history: {
    name: 'get_customer_order_history',
    description: 'Retrieve customer previous purchase and cancellation history using their phone number.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Customer Bangladeshi mobile number' },
      },
      required: ['phone'],
    },
    handler: async (args, ctx) => {
      const phoneVal = validateBDPhone(String(args.phone));
      const phone = phoneVal.normalized || String(args.phone);

      const { data: orders, error } = await ctx.db
        .from('orders')
        .select('id, product_name, quantity, total_amount, status, created_at')
        .eq('account_id', ctx.accountId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false });

      if (error) return { error: error.message };

      const total = orders?.length || 0;
      const cancelled = orders?.filter((o) => ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status)).length || 0;
      const delivered = orders?.filter((o) => o.status === 'DELIVERED').length || 0;

      return {
        phone,
        totalOrders: total,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
        orders: orders || [],
      };
    },
  },

  // 6. calculate_customer_risk
  calculate_customer_risk: {
    name: 'calculate_customer_risk',
    description: 'Calculate customer fraud and return risk based on internal history and courier delivery ratio.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Customer Bangladeshi mobile number' },
      },
      required: ['phone'],
    },
    handler: async (args, ctx) => {
      const risk = await calculateCustomerRisk(ctx.db, ctx.accountId, String(args.phone));
      return risk;
    },
  },

  // 6b. get_delivery_pricing (Dynamic Shipping & Delivery Zones)
  get_delivery_pricing: {
    name: 'get_delivery_pricing',
    description: 'Calculate real-time delivery fee, estimated delivery time, and free shipping eligibility based on customer district, city, or address.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Customer district name (e.g. Dhaka, Chittagong, Khulna, Gazipur)' },
        address: { type: 'string', description: 'Customer full address or area name' },
        quantity: { type: 'number', description: 'Order quantity (default 1)' },
        orderAmount: { type: 'number', description: 'Total product price' },
      },
    },
    handler: async (args, ctx) => {
      const qty = Math.max(1, Number(args.quantity) || 1);
      const amount = Number(args.orderAmount) || 0;
      const addr = (String(args.address || '') + ' ' + String(args.district || '')).toLowerCase();

      // Fetch delivery settings
      const { data: settings } = await ctx.db
        .from('delivery_settings')
        .select('*')
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      // Fetch active delivery zones
      const { data: zones } = await ctx.db
        .from('delivery_zones')
        .select('*')
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      // Match zone
      let matchedZone: any = null;
      if (zones && zones.length > 0) {
        const isDhakaSuburbs = /savar|সাভার|gazipur|গাজীপুর|keraniganj|কেরানীগঞ্জ|narayanganj|নারায়ণগঞ্জ/i.test(addr);
        const isDhaka = /dhaka|ঢাকা/i.test(addr);

        if (isDhakaSuburbs) {
          matchedZone = zones.find((z: any) => z.code === 'dhaka_suburbs' || z.name.includes('আশেপাশে')) || zones[0];
        } else if (isDhaka) {
          matchedZone = zones.find((z: any) => z.code === 'inside_dhaka' || z.name.includes('ভেতরে')) || zones[0];
        } else {
          matchedZone = zones.find((z: any) => z.code === 'outside_dhaka' || z.name.includes('বাইরে')) || zones[zones.length - 1];
        }
      }

      let standardCharge = matchedZone ? Number(matchedZone.charge) : 100;
      if (matchedZone?.is_free) standardCharge = 0;

      let isFree = false;
      let freeReason: string | null = null;

      if (settings?.free_delivery_global) {
        isFree = true;
        freeReason = 'Global Free Shipping Offer';
      } else if (settings?.free_delivery_min_qty && settings.free_delivery_min_qty > 0 && qty >= settings.free_delivery_min_qty) {
        isFree = true;
        freeReason = `${settings.free_delivery_min_qty} বা ততোধিক পিস অর্ডারে ফ্রি ডেলিভারি`;
      } else if (settings?.free_delivery_min_amount && settings.free_delivery_min_amount > 0 && amount >= Number(settings.free_delivery_min_amount)) {
        isFree = true;
        freeReason = `৳${settings.free_delivery_min_amount} টাকার বেশি অর্ডারে ফ্রি ডেলিভারি`;
      } else if (standardCharge === 0) {
        isFree = true;
      }

      const finalCharge = isFree ? 0 : standardCharge;
      const estimatedTime = matchedZone?.estimated_time || (matchedZone?.code === 'inside_dhaka' ? '২৪ - ৪৮ ঘণ্টার মধ্যে' : '২ - ৩ কার্যদিবস');

      return {
        zoneName: matchedZone?.name || 'স্ট্যান্ডার্ড ডেলিভারি',
        deliveryCharge: finalCharge,
        originalCharge: standardCharge,
        isFree,
        freeReason,
        estimatedTime,
        bannerText: settings?.free_delivery_banner_text || null,
        codEnabled: settings?.cod_enabled !== false,
      };
    },
  },

  // 6d. get_customer_profile
  get_customer_profile: {
    name: 'get_customer_profile',
    description: 'Retrieve customer identity, previous orders count, and VIP/returning status to personalize conversation.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Customer Bangladeshi mobile number' },
      },
    },
    handler: async (args, ctx) => {
      let phone = args.phone ? String(args.phone) : ctx.memory.customer_phone;
      if (phone) {
        const phoneVal = validateBDPhone(phone);
        if (phoneVal.valid && phoneVal.normalized) phone = phoneVal.normalized;
      }

      let contact: any = null;
      if (ctx.contactId) {
        const { data } = await ctx.db.from('contacts').select('*').eq('id', ctx.contactId).maybeSingle();
        contact = data;
      }

      let orders: any[] = [];
      if (phone) {
        const { data } = await ctx.db
          .from('orders')
          .select('id, product_name, quantity, total_amount, status, created_at')
          .eq('account_id', ctx.accountId)
          .eq('customer_phone', phone)
          .order('created_at', { ascending: false });
        orders = data || [];
      }

      const totalOrders = orders.length;
      const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
      const isReturningCustomer = totalOrders > 0;
      const isVipCustomer = deliveredCount >= 2;

      return {
        name: contact?.name || ctx.memory.customer_name || null,
        phone: phone || contact?.phone || null,
        isReturningCustomer,
        isVipCustomer,
        totalOrdersCount: totalOrders,
        deliveredOrdersCount: deliveredCount,
        lastPurchasedProduct: orders[0]?.product_name || null,
        lastOrderDate: orders[0]?.created_at || null,
      };
    },
  },

  // 7. create_order
  create_order: {
    name: 'create_order',
    description: 'Create an official commerce order after customer information validation and risk clearance.',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: 'Customer full name' },
        customerPhone: { type: 'string', description: '11-digit Bangladeshi mobile number' },
        fullAddress: { type: 'string', description: 'Detailed delivery address with village/road/house' },
        thana: { type: 'string', description: 'Thana or Upazila' },
        district: { type: 'string', description: 'District name (e.g. Dhaka, Chittagong, Khulna)' },
        productId: { type: 'string', description: 'Product ID' },
        variant: { type: 'string', description: 'Selected color, size, or style variant' },
        quantity: { type: 'number', description: 'Quantity (default 1)' },
        deliveryCharge: { type: 'number', description: 'Delivery fee in BDT. If omitted, dynamically calculated based on district and settings.' },
        couponCode: { type: 'string', description: 'Optional discount coupon code' },
        notes: { type: 'string', description: 'Special delivery note or landmark' },
      },
      required: ['customerName', 'customerPhone', 'fullAddress', 'productId'],
    },
    handler: async (args, ctx) => {
      const phoneVal = validateBDPhone(String(args.customerPhone));
      if (!phoneVal.valid || !phoneVal.normalized) {
        return { error: 'Invalid Bangladeshi phone number. Must be 11 digits (01XXXXXXXXX).' };
      }
      const phone = phoneVal.normalized;

      const addrVal = validateAddressCompleteness(
        String(args.fullAddress),
        args.thana ? String(args.thana) : undefined,
        args.district ? String(args.district) : undefined
      );
      if (!addrVal.isComplete) {
        return {
          error: `Address is incomplete. Missing: ${addrVal.missingFields.join(', ')}. Please request missing details.`,
        };
      }

      // Check product and stock
      const { data: product, error: prodErr } = await ctx.db
        .from('products')
        .select('*')
        .eq('id', args.productId)
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      if (prodErr || !product) {
        return { error: 'Product not found in database.' };
      }
      if (product.stock_quantity <= 0) {
        return { error: 'Product is currently out of stock.' };
      }

      const qty = Math.max(1, Number(args.quantity) || 1);
      const unitPrice = Number(product.price);
      let itemSubtotal = unitPrice * qty;

      // Calculate delivery charge dynamically if not explicitly specified
      let deliveryCharge = 100;
      if (args.deliveryCharge !== undefined && args.deliveryCharge !== null) {
        deliveryCharge = Number(args.deliveryCharge);
      } else {
        const pricingRes: any = await AI_COMMERCE_TOOLS.get_delivery_pricing.handler(
          {
            district: args.district ? String(args.district) : undefined,
            address: String(args.fullAddress),
            quantity: qty,
            orderAmount: itemSubtotal,
          },
          ctx
        );
        deliveryCharge = pricingRes?.deliveryCharge ?? 100;
      }

      // Apply coupon code if provided
      let couponDiscount = 0;
      let appliedCoupon: string | null = null;
      if (args.couponCode) {
        const cCode = String(args.couponCode).trim().toUpperCase();
        const { data: coupon } = await ctx.db
          .from('coupons')
          .select('*')
          .eq('account_id', ctx.accountId)
          .eq('code', cCode)
          .eq('is_active', true)
          .maybeSingle();

        if (coupon) {
          if (!coupon.min_order_amount || itemSubtotal >= Number(coupon.min_order_amount)) {
            if (coupon.discount_type === 'fixed') {
              couponDiscount = Math.min(itemSubtotal, Number(coupon.discount_value));
            } else if (coupon.discount_type === 'percentage') {
              couponDiscount = Math.round((itemSubtotal * Number(coupon.discount_value)) / 100);
              if (coupon.max_discount && couponDiscount > Number(coupon.max_discount)) {
                couponDiscount = Number(coupon.max_discount);
              }
            }
            appliedCoupon = coupon.code;
            // Record coupon usage
            await ctx.db
              .from('coupons')
              .update({ used_count: (coupon.used_count || 0) + 1 })
              .eq('id', coupon.id);
          }
        }
      }

      const totalAmount = Math.max(0, itemSubtotal - couponDiscount + deliveryCharge);

      // Duplicate Order Protection: check recent orders created in the last 15 minutes for same phone & product
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentDuplicate } = await ctx.db
        .from('orders')
        .select('id, created_at, status')
        .eq('account_id', ctx.accountId)
        .eq('customer_phone', phone)
        .eq('product_id', product.id)
        .gte('created_at', fifteenMinutesAgo)
        .maybeSingle();

      if (recentDuplicate) {
        return {
          error: `Duplicate order detected! Order #${recentDuplicate.id.slice(0, 8)} was already placed recently.`,
          existingOrderId: recentDuplicate.id,
        };
      }

      // Check risk
      const risk = await calculateCustomerRisk(ctx.db, ctx.accountId, phone);
      if (risk.requiresHumanApproval) {
        return {
          requiresHumanApproval: true,
          risk,
          message: 'Order creation paused due to high risk. Human agent approval required.',
        };
      }

      // Generate invoice number
      const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const idempotencyKey = `ord-${ctx.conversationId}-${Date.now()}`;

      // Auto-correct and normalize BD District and Thana
      const loc = normalizeBdLocation(
        String(args.fullAddress),
        args.district ? String(args.district) : undefined,
        args.thana ? String(args.thana) : undefined
      );

      // Insert Order
      const { data: order, error: insertErr } = await ctx.db
        .from('orders')
        .insert({
          account_id: ctx.accountId,
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
          product_id: product.id,
          product_name: product.name,
          variant: args.variant ? String(args.variant) : null,
          quantity: qty,
          unit_price: unitPrice,
          delivery_charge: deliveryCharge,
          total_amount: totalAmount,
          customer_name: String(args.customerName).trim(),
          customer_phone: phone,
          customer_address: String(args.fullAddress).trim(),
          thana: loc.thana || (args.thana ? String(args.thana).trim() : null),
          district: loc.district,
          status: 'CONFIRMED',
          risk_level: risk.riskLevel,
          risk_score: risk.cancellationRate,
          invoice_no: invoiceNo,
          notes: args.notes
            ? String(args.notes).trim()
            : appliedCoupon
              ? `Applied coupon: ${appliedCoupon} (-à§³${couponDiscount})`
              : null,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (insertErr || !order) {
        return { error: insertErr?.message || 'Failed to create order' };
      }

      // Atomic stock decrement with fallback
      try {
        await ctx.db.rpc('decrement_product_stock', {
          p_product_id: product.id,
          p_quantity: qty,
          p_order_id: order.id,
        });
      } catch (e) {
        // Fallback to direct decrement
        await ctx.db
          .from('products')
          .update({ stock_quantity: Math.max(0, product.stock_quantity - qty) })
          .eq('id', product.id);
      }

      // Fire Meta CAPI Purchase event asynchronously in background
      try {
        const { trackOrderPurchaseCapi, getMetaCapiConfig } = await import('@/lib/meta/capi');
        getMetaCapiConfig(ctx.accountId, ctx.db).then((capiCfg) => {
          trackOrderPurchaseCapi(
            capiCfg,
            {
              id: order.id,
              invoice_no: order.invoice_no || invoiceNo,
              total_amount: totalAmount,
              customer_phone: phone,
              customer_name: String(args.customerName).trim(),
              city: loc.district,
              items: [
                {
                  id: product.id,
                  name: product.name,
                  quantity: qty,
                  price: unitPrice,
                },
              ],
            }
          ).catch((err) => console.warn('[create_order] Meta CAPI tracking skipped:', err));
        }).catch(() => {});
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        orderId: order.id,
        invoiceNo: order.invoice_no || invoiceNo,
        productName: order.product_name,
        variant: order.variant,
        quantity: order.quantity,
        price: order.unit_price,
        deliveryCharge: order.delivery_charge,
        couponDiscount,
        appliedCoupon,
        totalAmount: order.total_amount,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        status: order.status,
      };
    },
  },

  // 8. book_courier
  book_courier: {
    name: 'book_courier',
    description: 'Dispatch and book parcel with Steadfast or Pathao courier API.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The ID of the confirmed order' },
        preferredProvider: { type: 'string', description: 'Optional: "steadfast" or "pathao"' },
      },
      required: ['orderId'],
    },
    handler: async (args, ctx) => {
      const { data: order, error } = await ctx.db
        .from('orders')
        .select('*')
        .eq('id', args.orderId)
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      if (error || !order) return { error: 'Order not found' };

      let provider = (args.preferredProvider as 'steadfast' | 'pathao') || null;
      if (!provider) {
        try {
          const smartRoute = await getSmartCourierRoute(ctx.db, {
            accountId: ctx.accountId,
            customerAddress: order.customer_address,
          });
          provider = smartRoute.recommendedProvider as 'steadfast' | 'pathao';
        } catch {
          provider = 'steadfast';
        }
      }
      const { data: config } = await ctx.db
        .from('courier_configs')
        .select('*')
        .eq('account_id', ctx.accountId)
        .eq('provider', provider)
        .maybeSingle();

      if (!config || !config.is_active || !config.api_key) {
        return { success: false, error: `${provider.toUpperCase()} courier is not configured or inactive.` };
      }

      const courierResult = await dispatchCourierOrder(
        config,
        {
          provider,
          recipient_name: order.customer_name,
          recipient_phone: order.customer_phone,
          recipient_address: order.customer_address,
          cod_amount: order.total_amount - (order.advance_paid || 0),
          note: `Product: ${order.product_name} (${order.variant || 'Standard'}) - Qty: ${order.quantity}`,
          color_variant: order.variant || undefined,
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
        },
        ctx.db
      );

      if (!courierResult.success) {
        return {
          success: false,
          error: courierResult.error || 'Courier dispatch failed',
          requiresHandoff: true,
        };
      }

      // Update Order with tracking code
      await ctx.db
        .from('orders')
        .update({
          status: 'COURIER_BOOKED',
          courier_provider: courierResult.provider,
          courier_tracking_code: courierResult.tracking_code,
          courier_consignment_id: courierResult.consignment_id ? String(courierResult.consignment_id) : null,
          courier_status: 'in_review',
        })
        .eq('id', order.id);

      return {
        success: true,
        provider: courierResult.provider,
        trackingCode: courierResult.tracking_code,
        consignmentId: courierResult.consignment_id,
        trackingUrl: courierResult.tracking_url,
      };
    },
  },

  // 8b. record_advance_payment
  record_advance_payment: {
    name: 'record_advance_payment',
    description: 'Record advance payment made by customer via bKash, Nagad, or Rocket using their Transaction ID (TrxID) and deduct COD due.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID or invoice number (optional if in context)' },
        phone: { type: 'string', description: 'Customer phone number' },
        amount: { type: 'number', description: 'Amount paid in advance in BDT (e.g. 150 or 200)' },
        method: { type: 'string', description: 'Payment method e.g. bKash, Nagad, Rocket, Bank' },
        trxId: { type: 'string', description: 'The 8 to 12 character Transaction ID (e.g. 9K37XZL2)' },
      },
      required: ['amount', 'trxId'],
    },
    handler: async (args, ctx) => {
      let query = ctx.db.from('orders').select('*').eq('account_id', ctx.accountId);

      if (args.orderId) {
        const idClean = String(args.orderId).trim();
        query = query.or(`id.eq.${idClean},invoice_no.ilike.%${idClean}%`);
      } else if (args.phone) {
        const phoneVal = validateBDPhone(String(args.phone));
        const phone = phoneVal.normalized || String(args.phone);
        query = query.eq('customer_phone', phone);
      } else if (ctx.memory.order_id) {
        query = query.eq('id', ctx.memory.order_id);
      } else if (ctx.memory.customer_phone) {
        query = query.eq('customer_phone', ctx.memory.customer_phone);
      } else {
        return { error: 'Order not found for advance payment.' };
      }

      const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(1);
      if (error || !orders || orders.length === 0) {
        return { error: 'No order found to attach advance payment.' };
      }

      const order = orders[0];
      const advance = Number(args.amount) || 0;
      const trx = String(args.trxId).trim().toUpperCase();
      const method = String(args.method || 'bKash').trim();

      // Check duplicate TrxID fraud prevention
      try {
        const { data: existingTrx } = await ctx.db
          .from('orders')
          .select('id, invoice_no')
          .eq('advance_trx_id', trx)
          .neq('id', order.id)
          .limit(1);

        if (existingTrx && existingTrx.length > 0 && existingTrx[0].id !== order.id) {
          return {
            error: `এই TrxID (${trx}) ইতোমধ্যে অর্ডার #${existingTrx[0].invoice_no || existingTrx[0].id} এ ব্যবহৃত হয়েছে। দয়া করে সঠিক ট্রানজেকশন আইডি দিন।`,
          };
        }
      } catch (err) {
        console.warn('[record_advance_payment] duplicate TrxID check skipped:', err);
      }

      const newCodDue = Math.max(0, order.total_amount - advance);
      const shouldConfirm = ['pending', 'new', 'draft', 'unconfirmed'].includes(String(order.status || '').toLowerCase());
      const updateData: Record<string, unknown> = {
        advance_paid: advance,
        advance_method: method,
        advance_trx_id: trx,
        advance_status: 'verified',
      };
      if (shouldConfirm) {
        updateData.status = 'confirmed';
      }

      await ctx.db
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      return {
        success: true,
        orderId: order.id,
        invoiceNo: order.invoice_no,
        advancePaid: advance,
        advanceMethod: method,
        trxId: trx,
        totalAmount: order.total_amount,
        codDue: newCodDue,
        status: shouldConfirm ? 'confirmed' : order.status,
        message: `৳${advance} টাকা অগ্রিম গ্রহণ করা হয়েছে (${method} TrxID: ${trx})। ডেলিভারির সময় অবশিষ্ট বকেয়া: ৳${newCodDue}।${shouldConfirm ? ' অর্ডারটি নিশ্চিত করা হয়েছে! 🎉' : ''}`,
      };
    },
  },

  // 8c. send_quick_reply_buttons
  send_quick_reply_buttons: {
    name: 'send_quick_reply_buttons',
    description: 'Send native WhatsApp 1-tap interactive reply buttons to the customer (up to 3 buttons) for easy color selection or confirmation.',
    parameters: {
      type: 'object',
      properties: {
        bodyText: { type: 'string', description: 'Message body explaining the options' },
        buttons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique button identifier e.g. "color_black"' },
              title: { type: 'string', description: 'Button label e.g. "ðŸ–¤ Black" (max 20 chars)' },
            },
            required: ['id', 'title'],
          },
          description: 'Array of 1 to 3 buttons',
        },
      },
      required: ['bodyText', 'buttons'],
    },
    handler: async (args, ctx) => {
      const bodyText = String(args.bodyText || '');
      const rawButtons = (args.buttons as Array<{ id: string; title: string }>) || [];
      const buttons = rawButtons.slice(0, 3).map((b, idx) => ({
        id: b.id || `btn_${idx + 1}`,
        title: (b.title || `Option ${idx + 1}`).slice(0, 20),
      }));

      if (buttons.length === 0) return { error: 'At least one button is required' };

      // Look up target recipient phone
      const { data: conv } = await ctx.db
        .from('conversations')
        .select('*, contact:contacts(phone, wa_user_id)')
        .eq('id', ctx.conversationId)
        .maybeSingle();

      const toPhone = conv?.contact?.phone;
      if (!toPhone) return { error: 'Contact phone not found' };

      const { data: config } = await ctx.db
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      if (!config?.phone_number_id || !config?.access_token) {
        return { error: 'WhatsApp config not found' };
      }

      const { decrypt } = await import('@/lib/whatsapp/encryption');
      const { sendInteractiveButtons } = await import('@/lib/whatsapp/meta-api');

      const accessToken = decrypt(config.access_token);
      const res = await sendInteractiveButtons({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: toPhone,
        bodyText,
        buttons,
      });

      return { success: true, messageId: res.messageId, buttonsSent: buttons.length };
    },
  },

  // 9. apply_tag
  apply_tag: {
    name: 'apply_tag',
    description: 'Apply a workflow tag to the contact (e.g. PURCHASE_INTENT, HIGH_RISK_CUSTOMER, HUMAN_HANDOFF).',
    parameters: {
      type: 'object',
      properties: {
        tagName: { type: 'string', description: 'Name of the tag' },
      },
      required: ['tagName'],
    },
    handler: async (args, ctx) => {
      const name = String(args.tagName).toUpperCase().trim();

      // Find or create tag
      let { data: tag } = await ctx.db
        .from('tags')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('name', name)
        .maybeSingle();

      if (!tag) {
        const { data: newTag, error: tagErr } = await ctx.db
          .from('tags')
          .insert({ account_id: ctx.accountId, name, color: '#3b82f6' })
          .select('id')
          .single();
        if (tagErr) return { error: tagErr.message };
        tag = newTag;
      }

      if (tag) {
        // Link to contact_tags
        await ctx.db
          .from('contact_tags')
          .upsert({ contact_id: ctx.contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
      }

      return { success: true, tag: name };
    },
  },

  // 10. remove_tag
  remove_tag: {
    name: 'remove_tag',
    description: 'Remove a workflow tag from the contact.',
    parameters: {
      type: 'object',
      properties: {
        tagName: { type: 'string', description: 'Name of the tag to remove' },
      },
      required: ['tagName'],
    },
    handler: async (args, ctx) => {
      const name = String(args.tagName).toUpperCase().trim();
      const { data: tag } = await ctx.db
        .from('tags')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('name', name)
        .maybeSingle();

      if (tag) {
        await ctx.db
          .from('contact_tags')
          .delete()
          .eq('contact_id', ctx.contactId)
          .eq('tag_id', tag.id);
      }
      return { success: true, removed: name };
    },
  },

  // 11. schedule_followup
  schedule_followup: {
    name: 'schedule_followup',
    description: 'Schedule a polite automated WhatsApp follow-up if customer viewed product info and did not reply.',
    parameters: {
      type: 'object',
      properties: {
        minutesDelay: { type: 'number', description: 'Delay in minutes (default 60)' },
        prompt: { type: 'string', description: 'Follow-up message prompt or question' },
        productId: { type: 'string', description: 'Product ID customer was interested in' },
      },
    },
    handler: async (args, ctx) => {
      const delay = Number(args.minutesDelay) || 60;
      const scheduledAt = new Date(Date.now() + delay * 60 * 1000).toISOString();

      // Cancel any older pending follow-ups for this conversation
      await ctx.db
        .from('ai_followups')
        .update({ status: 'cancelled' })
        .eq('conversation_id', ctx.conversationId)
        .eq('status', 'pending');

      const { data, error } = await ctx.db
        .from('ai_followups')
        .insert({
          account_id: ctx.accountId,
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
          product_id: args.productId ? String(args.productId) : null,
          scheduled_at: scheduledAt,
          status: 'pending',
          message_prompt: args.prompt ? String(args.prompt) : 'Follow up on product preference',
        })
        .select('id')
        .single();

      if (error) return { error: error.message };
      return { success: true, followupId: data.id, scheduledAt };
    },
  },

  // 12. cancel_followup
  cancel_followup: {
    name: 'cancel_followup',
    description: 'Cancel any pending scheduled follow-ups because customer has actively replied.',
    parameters: { type: 'object', properties: {} },
    handler: async (_args, ctx) => {
      await ctx.db
        .from('ai_followups')
        .update({ status: 'cancelled' })
        .eq('conversation_id', ctx.conversationId)
        .eq('status', 'pending');
      return { success: true };
    },
  },

  // 13. send_product_images
  send_product_images: {
    name: 'send_product_images',
    description: 'Send verified official product photos and color variant pictures directly to the customer on WhatsApp. Call this whenever the customer asks to see product photos, pictures, colors, or designs.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID or product name (e.g. Casio Edifice, T800 Ultra, or UUID)',
        },
        color: {
          type: 'string',
          description: 'Optional: specific color/variant name requested by customer (e.g. "Emerald Green", "Black", "Silver Blue Dial")',
        },
      },
      required: ['productId'],
    },
    handler: async (args, ctx) => {
      const rawProductId = typeof args.productId === 'string' ? args.productId.trim() : '';
      const targetColor = typeof args.color === 'string' ? args.color.trim() : '';

      // 1. Resolve product from DB (supports UUID, partial name, or conversation memory)
      let p: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawProductId);

      if (isUuid) {
        const { data } = await ctx.db
          .from('products')
          .select('id, name, image_url, images, variants, colors')
          .eq('id', rawProductId)
          .eq('account_id', ctx.accountId)
          .maybeSingle();
        p = data;
      }

      if (!p && rawProductId) {
        const { data } = await ctx.db
          .from('products')
          .select('id, name, image_url, images, variants, colors')
          .eq('account_id', ctx.accountId)
          .eq('is_active', true)
          .ilike('name', `%${rawProductId}%`)
          .limit(1)
          .maybeSingle();
        p = data;
      }

      if (!p && ctx.memory?.interested_product_id) {
        const { data } = await ctx.db
          .from('products')
          .select('id, name, image_url, images, variants, colors')
          .eq('id', ctx.memory.interested_product_id)
          .eq('account_id', ctx.accountId)
          .maybeSingle();
        p = data;
      }

      if (!p && ctx.memory?.interested_product_name) {
        const { data } = await ctx.db
          .from('products')
          .select('id, name, image_url, images, variants, colors')
          .eq('account_id', ctx.accountId)
          .eq('is_active', true)
          .ilike('name', `%${ctx.memory.interested_product_name}%`)
          .limit(1)
          .maybeSingle();
        p = data;
      }

      if (!p) {
        return { success: false, error: 'Product not found in store catalog' };
      }

      // Update memory with current interested product
      if (ctx.memory && (!ctx.memory.interested_product_id || ctx.memory.interested_product_id !== p.id)) {
        ctx.memory.interested_product_id = p.id;
        ctx.memory.interested_product_name = p.name;
      }

      // 2. Assemble verified photos from product catalog
      const imagesToSend: Array<{ url: string; caption?: string }> = [];
      const seenUrls = new Set<string>();

      if (targetColor) {
        const lowerColor = targetColor.toLowerCase();
        const variants = (p.variants || []) as Array<{ name?: string; image_url?: string }>;
        const matchedVariant = variants.find(
          (v) => v.name?.toLowerCase().includes(lowerColor) || lowerColor.includes(v.name?.toLowerCase() || '')
        );

        if (matchedVariant?.image_url && !seenUrls.has(matchedVariant.image_url)) {
          imagesToSend.push({
            url: matchedVariant.image_url,
            caption: `🎨 ${p.name} (${matchedVariant.name})`,
          });
          seenUrls.add(matchedVariant.image_url);
        } else if (p.image_url && !seenUrls.has(p.image_url)) {
          imagesToSend.push({
            url: p.image_url,
            caption: `📸 ${p.name}\n🎨 কালার: ${targetColor}`,
          });
          seenUrls.add(p.image_url);
        }
      } else {
        // General product photos
        const variants = (p.variants || []) as Array<{ name?: string; image_url?: string }>;
        for (const v of variants) {
          if (v.image_url && !seenUrls.has(v.image_url)) {
            imagesToSend.push({
              url: v.image_url,
              caption: `🎨 কালার: ${v.name}`,
            });
            seenUrls.add(v.image_url);
            if (imagesToSend.length >= 3) break;
          }
        }

        if (imagesToSend.length === 0 && p.image_url && !seenUrls.has(p.image_url)) {
          const colorCaption = p.colors?.length ? `\n🎨 এভেইলেবল কালার: ${p.colors.join(', ')}` : '';
          imagesToSend.push({
            url: p.image_url,
            caption: `📸 ${p.name}${colorCaption}`,
          });
          seenUrls.add(p.image_url);
        }

        if (Array.isArray(p.images)) {
          for (const imgUrl of p.images) {
            if (typeof imgUrl === 'string' && imgUrl.startsWith('http') && !seenUrls.has(imgUrl)) {
              imagesToSend.push({
                url: imgUrl,
                caption: `📸 ${p.name}`,
              });
              seenUrls.add(imgUrl);
              if (imagesToSend.length >= 3) break;
            }
          }
        }
      }

      // Handle internal calls that passed args.images
      if (imagesToSend.length === 0 && Array.isArray(args.images)) {
        for (const item of args.images as Array<{ color?: string; imageUrl?: string }>) {
          if (item?.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('http') && !seenUrls.has(item.imageUrl)) {
            imagesToSend.push({
              url: item.imageUrl,
              caption: item.color ? `🎨 কালার: ${item.color}` : `📸 ${p.name}`,
            });
            seenUrls.add(item.imageUrl);
            if (imagesToSend.length >= 3) break;
          }
        }
      }

      if (imagesToSend.length === 0) {
        return {
          success: false,
          error: 'No image found for this product in catalog',
          productName: p.name,
        };
      }

      let sentCount = 0;
      for (const item of imagesToSend) {
        try {
          await engineSendMedia({
            accountId: ctx.accountId,
            userId: ctx.configOwnerUserId,
            conversationId: ctx.conversationId,
            contactId: ctx.contactId,
            kind: 'image',
            link: item.url,
            caption: item.caption,
          });
          sentCount++;
        } catch (e) {
          console.error('[send_product_images] send error:', e);
        }
      }

      return {
        success: sentCount > 0,
        sentCount,
        productName: p.name,
        message: `${sentCount}টি অফিশিয়াল ছবি হোয়াটসঅ্যাপে পাঠানো হয়েছে।`,
      };
    },
  },

  // 14. handoff_to_human
  handoff_to_human: {
    name: 'handoff_to_human',
    description: 'Transfer conversation to human sales representative with structured context summary.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Specific reason for human handoff' },
        summary: { type: 'string', description: 'Structured summary of conversation, product, and risk' },
      },
      required: ['reason', 'summary'],
    },
    handler: async (args, ctx) => {
      // 1. Pause AI auto-reply
      await ctx.db
        .from('conversations')
        .update({
          ai_autoreply_disabled: true,
          ai_handoff_summary: String(args.summary),
          ai_state: 'HUMAN_HANDOFF',
        })
        .eq('id', ctx.conversationId);

      // 2. Apply HUMAN_HANDOFF tag
      const { data: tag } = await ctx.db
        .from('tags')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('name', 'HUMAN_HANDOFF')
        .maybeSingle();

      if (tag) {
        await ctx.db
          .from('contact_tags')
          .upsert({ contact_id: ctx.contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
      }

      return {
        success: true,
        handedOff: true,
        reason: args.reason,
      };
    },
  },

  // 15. update_conversation_state
  update_conversation_state: {
    name: 'update_conversation_state',
    description: 'Update the conversation state machine stage and memory store.',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'New state in the customer journey state machine' },
        memoryUpdates: { type: 'object', description: 'Key-value updates to merge into conversation memory' },
      },
      required: ['state'],
    },
    handler: async (args, ctx) => {
      const nextState = String(args.state) as ConversationState;
      const updates = (args.memoryUpdates as Record<string, unknown>) || {};
      const mergedMemory = { ...ctx.memory, ...updates };

      await ctx.db
        .from('conversations')
        .update({
          ai_state: nextState,
          ai_memory: mergedMemory,
        })
        .eq('id', ctx.conversationId);

      return { success: true, state: nextState };
    },
  },

  // 16. get_order_status
  get_order_status: {
    name: 'get_order_status',
    description: 'Track and check the live status of an order using customer phone, invoice number (e.g. INV-1002), or order ID.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID or invoice number (e.g. WG-1002)' },
        phone: { type: 'string', description: 'Customer phone number' },
      },
    },
    handler: async (args, ctx) => {
      let query = ctx.db.from('orders').select('*').eq('account_id', ctx.accountId);

      const searchKey = args.orderId ? String(args.orderId).trim() : null;
      const phoneKey = args.phone ? String(args.phone).trim() : ctx.memory.customer_phone;

      if (searchKey) {
        query = query.or(`id.eq.${searchKey},invoice_no.ilike.%${searchKey}%,courier_tracking_code.ilike.%${searchKey}%`);
      } else if (phoneKey) {
        query = query.eq('customer_phone', phoneKey);
      } else if (ctx.memory.order_id) {
        query = query.eq('id', ctx.memory.order_id);
      } else {
        query = query.eq('conversation_id', ctx.conversationId);
      }

      const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(1);
      if (error || !orders || orders.length === 0) {
        return {
          found: false,
          error: 'No order found for this customer',
          replyText: 'আপনার কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি। আপনার ইনভয়েস নম্বর অথবা যে নম্বরে অর্ডার করেছিলেন তা জানালে চেক করে দিচ্ছি। 😊',
        };
      }

      const order = orders[0];
      const trackingUrl = order.courier_provider && order.courier_tracking_code
        ? getTrackingUrl(order.courier_provider, order.courier_tracking_code)
        : null;

      let liveTracking: any = null;
      if (order.courier_provider && order.courier_tracking_code) {
        try {
          const configQuery = ctx.db.from('courier_configs');
          if (configQuery && typeof configQuery.select === 'function') {
            const { data: cCfg } = await configQuery
              .select('*')
              .eq('account_id', ctx.accountId)
              .eq('provider', order.courier_provider)
              .maybeSingle();

            liveTracking = await getLiveCourierTracking(
              cCfg,
              order.courier_provider,
              order.courier_tracking_code
            );
          }
        } catch (e) {
          console.warn('[tools] getLiveCourierTracking error:', e);
        }
      }

      let statusBangla = '';
      let humanStatusBangla = '';
      switch (order.status) {
        case 'NEW':
        case 'CONFIRMED':
          statusBangla = 'অর্ডার নিশ্চিত হয়েছে';
          humanStatusBangla = 'অর্ডারটি কনফার্ম হয়েছে এবং পার্সেল প্রস্তুত করা হচ্ছে। শীঘ্রই কুরিয়ারে হস্তান্তর করা হবে। 📦';
          break;
        case 'PROCESSING':
          statusBangla = 'প্রক্রিয়াধীন রয়েছে';
          humanStatusBangla = 'অর্ডারটি প্রক্রিয়া করা হচ্ছে এবং কুরিয়ারে হস্তান্তরের কাজ চলছে।';
          break;
        case 'COURIER_BOOKED':
          statusBangla = 'কুরিয়ারে হস্তান্তর করা হয়েছে';
          humanStatusBangla = liveTracking?.statusBangla
            ? `পার্সেলটি কুরিয়ারে রয়েছে: ${liveTracking.statusBangla}। 🚚`
            : `পার্সেলটি ${order.courier_provider ? order.courier_provider.toUpperCase() : ''} কুরিয়ারে বুক করা হয়েছে। ট্র্যাকিং কোড: ${order.courier_tracking_code || 'প্রক্রিয়াধীন'}। 🚚`;
          break;
        case 'SHIPPED':
        case 'OUT_FOR_DELIVERY':
          statusBangla = 'ডেলিভারির পথে';
          humanStatusBangla = liveTracking?.statusBangla
            ? `${liveTracking.statusBangla} 🏃‍♂️`
            : 'পার্সেলটি আপনার এলাকার ডেলিভারি রাইডারের কাছে রয়েছে। আজ অথবা আগামীকালের মধ্যেই ডেলিভারি পেয়ে যাবেন! 🏃‍♂️';
          break;
        case 'DELIVERED':
          statusBangla = 'ডেলিভারি সম্পন্ন';
          humanStatusBangla = 'পার্সেলটি সফলভাবে ডেলিভারি সম্পন্ন হয়েছে দেখাচ্ছে। কোনো সমস্যা থাকলে অবশ্যই আমাদের জানাবেন! ❤️';
          break;
        case 'CANCELLED':
          statusBangla = 'বাতিল করা হয়েছে';
          humanStatusBangla = 'অর্ডারটি বাতিল (Cancelled) করা হয়েছিল। বিস্তারিত জানতে চাইলে জানাবেন।';
          break;
        case 'RETURNED':
          statusBangla = 'ফেরত এসেছে';
          humanStatusBangla = 'পার্সেলটি রিটার্ন হিসেবে রেকর্ড রয়েছে।';
          break;
        default:
          statusBangla = order.status;
          humanStatusBangla = `অর্ডারের বর্তমান স্ট্যাটাস: ${order.status}`;
      }

      const trackingLine = order.courier_tracking_code
        ? `\n🚚 কুরিয়ার ট্র্যাকিং কোড: *${order.courier_tracking_code}*${trackingUrl ? `\n🔗 ট্র্যাকিং লিঙ্ক: ${trackingUrl}` : ''}`
        : '';
      const locationLine = liveTracking?.location ? `\n📍 বর্তমান হাব/অবস্থান: *${liveTracking.location}*` : '';
      const invoiceLine = order.invoice_no ? `\n🧾 ইনভয়েস নম্বর: *${order.invoice_no}*` : '';

      const fullReply =
        `আপনার অর্ডারের বিবরণ নিচে দেওয়া হলো:\n\n` +
        `📦 প্রোডাক্ট: *${order.product_name}* (${order.variant || 'Standard'})\n` +
        `🔢 পরিমাণ: ${order.quantity}টি | মোট মূল্য: ৳${order.total_amount}\n` +
        `${invoiceLine}${trackingLine}${locationLine}\n` +
        `📌 বর্তমান অবস্থা: *${humanStatusBangla}*\n\n` +
        `পার্সেল রিসিভ করার সময় চেক করে নেওয়ার সুযোগ রয়েছে। কোনো প্রশ্ন থাকলে নিঃসংকোচে বলুন! 😊`;

      const orderObj = {
        id: order.id,
        orderId: order.id,
        invoiceNo: order.invoice_no,
        productName: order.product_name,
        variant: order.variant,
        quantity: order.quantity,
        totalAmount: order.total_amount,
        status: order.status,
        statusBangla,
        courierProvider: order.courier_provider,
        courierTrackingCode: order.courier_tracking_code,
        courierTrackingUrl: trackingUrl,
      };

      return {
        found: true,
        order: orderObj,
        orderId: order.id,
        invoiceNo: order.invoice_no,
        productName: order.product_name,
        variant: order.variant,
        quantity: order.quantity,
        totalAmount: order.total_amount,
        status: order.status,
        statusBangla,
        courierProvider: order.courier_provider,
        courierTrackingCode: order.courier_tracking_code,
        courierTrackingUrl: trackingUrl,
        humanStatusBangla,
        replyText: fullReply,
      };
    },
  },

  // 17. handle_order_complaint
  handle_order_complaint: {
    name: 'handle_order_complaint',
    description: 'Handle customer warranty claims, damaged goods, exchange requests, or return requests politely.',
    parameters: {
      type: 'object',
      properties: {
        issueType: {
          type: 'string',
          enum: ['damaged_product', 'wrong_item', 'color_exchange', 'warranty_claim', 'general_complaint'],
          description: 'Type of complaint or issue',
        },
        description: { type: 'string', description: 'Brief description of customer issue' },
      },
      required: ['issueType'],
    },
    handler: async (args, ctx) => {
      const tagName = args.issueType === 'warranty_claim'
        ? 'WARRANTY_CLAIM'
        : args.issueType === 'color_exchange'
          ? 'EXCHANGE_REQUEST'
          : 'CUSTOMER_COMPLAINT';

      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName }, ctx);

      const empatheticReply =
        `আসসালামু আলাইকুম, আপনার এই অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত! ❤️ আমাদের প্রতিটি পণ্যে অফিসিয়াল কোয়ালিটি নিশ্চয়তা ও সাপোর্ট সুবিধা রয়েছে।\n\n` +
        `অনুগ্রহ করে পণ্যটির সমস্যাটির একটি ছোট ছবি বা ভিডিও এবং আপনার ক্যাশমেমো/ইনভয়েস নম্বরটি এখানে দিন।\n` +
        `আমাদের টিম এটি দ্রুত ভেরিফাই করে প্রয়োজনীয় রিপ্লেসমেন্ট অথবা সমাধান করে দিবে। চিন্তার কোনো কারণ নেই, আমরা সবসময় আপনার পাশে আছি! 😊`;

      return {
        success: true,
        issueType: args.issueType,
        tagApplied: tagName,
        replyText: empatheticReply,
      };
    },
  },

  // 18. recommend_products
  recommend_products: {
    name: 'recommend_products',
    description: 'Recommend top alternate products from catalog with photos, prices, and features.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'e.g. "luxury", "casual", "premium", "trending"' },
        maxPrice: { type: 'number', description: 'Maximum budget in BDT' },
      },
    },
    handler: async (args, ctx) => {
      let query = ctx.db
        .from('products')
        .select('*')
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
        .gt('stock_quantity', 0);

      if (args.maxPrice) {
        query = query.lte('price', args.maxPrice);
      }

      const { data: products, error } = await query.order('price', { ascending: false }).limit(3);
      if (error || !products || products.length === 0) {
        return { success: false, message: 'এই মুহূর্তে বিকল্প কোনো মডেল পাওয়া যায়নি।' };
      }

      const recommendations = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        colors: p.colors?.join(', ') || 'Standard',
        specs: p.strap_type || p.movement || p.dial_size || (p.variants?.[0]?.name) || 'Premium Quality',
        imageUrl: p.image_url,
      }));

      return {
        success: true,
        products: recommendations,
      };
    },
  },

  // 13. recommend_upsell_bundle
  recommend_upsell_bundle: {
    name: 'recommend_upsell_bundle',
    description: 'Find a matching add-on product or discounted combo offer to upsell when a customer is about to order.',
    parameters: {
      type: 'object',
      properties: {
        currentProductId: { type: 'string', description: 'ID of product customer is interested in' },
      },
    },
    handler: async (args, ctx) => {
      const pId = (args.currentProductId as string) || ctx.memory.interested_product_id;
      const rec = await getSmartUpsellRecommendation(ctx.db, ctx.accountId, pId);
      if (!rec.hasUpsell) {
        return { success: false, message: 'No upsell available' };
      }
      return {
        success: true,
        upsellProduct: rec.upsellProduct,
        comboOfferText: rec.comboOfferText,
        discount: rec.bundleDiscountAmount,
      };
    },
  },

  // 14. visual_search_product
  visual_search_product: {
    name: 'visual_search_product',
    description: 'Match customer photos or screenshot descriptions against the active product catalog using visual keywords.',
    parameters: {
      type: 'object',
      properties: {
        imageKeywords: { type: 'string', description: 'Description, color, type or caption of the image sent by customer' },
      },
      required: ['imageKeywords'],
    },
    handler: async (args, ctx) => {
      const keywords = String(args.imageKeywords || '');
      const match = await matchProductFromImage(ctx.db, ctx.accountId, keywords);
      return {
        matched: match.matched,
        product: match.product,
        confidence: match.confidence,
        replyMessage: match.message,
      };
    },
  },
};
