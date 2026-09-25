import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { validateBDPhone } from '@/lib/ai/agent/risk-engine';
import { sendPushToAccount } from '@/lib/notifications/web-push';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export async function POST(request: Request) {
  try {
    const admin = supabaseAdmin();
    const body = await request.json().catch(() => null);

    if (!body?.productId && !body?.slug) {
      return NextResponse.json({ error: 'Product is required' }, { status: 400 });
    }
    if (!body?.customerName?.trim()) {
      return NextResponse.json({ error: 'আপনার সম্পূর্ণ নাম লিখুন' }, { status: 400 });
    }
    if (!body?.customerPhone?.trim()) {
      return NextResponse.json({ error: 'আপনার মোবাইল নম্বর লিখুন' }, { status: 400 });
    }
    if (!body?.customerAddress?.trim()) {
      return NextResponse.json({ error: 'আপনার সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন' }, { status: 400 });
    }

    const phoneVal = validateBDPhone(body.customerPhone.trim());
    if (!phoneVal.valid || !phoneVal.normalized) {
      return NextResponse.json(
        { error: 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)' },
        { status: 400 }
      );
    }
    const phone = phoneVal.normalized;

    // 1. Fetch Product
    let query = admin.from('products').select('*').eq('is_active', true);
    if (body.productId) {
      query = query.eq('id', body.productId);
    } else {
      query = query.eq('slug', body.slug);
    }

    const { data: product, error: prodErr } = await query.maybeSingle();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'প্রোডাক্টটি পাওয়া যায়নি বা বর্তমানে নিষ্ক্রিয় রয়েছে' }, { status: 404 });
    }

    const qty = Math.max(1, parseInt(body.quantity, 10) || 1);

    // 2. Concurrency-safe atomic stock decrement (with optional variant support)
    const { data: stockResult, error: stockErr } = await admin.rpc('decrement_product_stock', {
      p_product_id: product.id,
      p_quantity: qty,
      p_variant_id: body.variantId || null,
    });

    if (stockErr || !stockResult?.success) {
      return NextResponse.json(
        { error: 'দুঃখিত, স্টক শেষ হয়ে গেছে অথবা পর্যাপ্ত স্টক নেই।' },
        { status: 400 }
      );
    }

    let unitPrice = Number(product.price);
    let variantName = body.variant ? String(body.variant).trim() : (product.colors?.[0] || 'Standard');

    if (body.variantId && Array.isArray(product.variants)) {
      const matched = product.variants.find((v: { id: string; price?: number; name: string }) => v.id === body.variantId);
      if (matched) {
        if (matched.price) unitPrice = Number(matched.price);
        if (matched.name) variantName = matched.name;
      }
    }

    // 3. Dynamic Delivery Fee & Free Delivery Rules Evaluation
    const [{ data: deliverySettings }, { data: zones }] = await Promise.all([
      admin.from('delivery_settings').select('*').eq('account_id', product.account_id).maybeSingle(),
      admin.from('delivery_zones').select('*').eq('account_id', product.account_id).eq('is_active', true),
    ]);

    let matchedZone = null;
    if (body.deliveryZoneId && zones) {
      matchedZone = zones.find((z: { id: string }) => z.id === body.deliveryZoneId);
    }
    if (!matchedZone && body.deliveryArea && zones) {
      matchedZone = zones.find((z: { code?: string; name: string }) => z.code === body.deliveryArea || z.name.includes(body.deliveryArea));
    }
    if (!matchedZone && zones && zones.length > 0) {
      const isDhaka = /dhaka|ঢাকা/i.test(body.district || '') || /dhaka|ঢাকা/i.test(body.customerAddress || '');
      matchedZone = isDhaka
        ? zones.find((z: { code?: string; name: string }) => z.code === 'inside_dhaka' || z.name.includes('ঢাকা')) || zones[0]
        : zones.find((z: { code?: string; name: string }) => z.code === 'outside_dhaka' || z.name.includes('বাইরে')) || zones[zones.length - 1];
    }

    let standardCharge = matchedZone ? Number(matchedZone.charge) : 100;
    if (matchedZone?.is_free) standardCharge = 0;

    let isFreeDelivery = false;
    if (deliverySettings?.free_delivery_global) {
      isFreeDelivery = true;
    } else if (
      deliverySettings?.free_delivery_min_qty &&
      deliverySettings.free_delivery_min_qty > 0 &&
      qty >= deliverySettings.free_delivery_min_qty
    ) {
      isFreeDelivery = true;
    } else if (
      deliverySettings?.free_delivery_min_amount &&
      deliverySettings.free_delivery_min_amount > 0 &&
      (unitPrice * qty) >= Number(deliverySettings.free_delivery_min_amount)
    ) {
      isFreeDelivery = true;
    } else if (standardCharge === 0) {
      isFreeDelivery = true;
    }

    const deliveryCharge = isFreeDelivery ? 0 : standardCharge;

    // 3.1 Coupon Code Verification & Discount
    let couponDiscount = 0;
    let appliedCouponCode: string | null = null;
    if (body.couponCode) {
      const codeClean = String(body.couponCode).trim().toUpperCase();
      const { data: coupon } = await admin
        .from('coupons')
        .select('*')
        .eq('account_id', product.account_id)
        .eq('code', codeClean)
        .eq('is_active', true)
        .maybeSingle();

      if (coupon) {
        const itemTotal = unitPrice * qty;
        if (!coupon.min_order_amount || itemTotal >= Number(coupon.min_order_amount)) {
          if (coupon.discount_type === 'fixed') {
            couponDiscount = Math.min(itemTotal, Number(coupon.discount_value));
          } else if (coupon.discount_type === 'percentage') {
            couponDiscount = Math.round((itemTotal * Number(coupon.discount_value)) / 100);
            if (coupon.max_discount && couponDiscount > Number(coupon.max_discount)) {
              couponDiscount = Number(coupon.max_discount);
            }
          }
          appliedCouponCode = coupon.code;
          // Increment usage count
          await admin
            .from('coupons')
            .update({ used_count: (coupon.used_count || 0) + 1 })
            .eq('id', coupon.id);
        }
      }
    }

    const totalAmount = Math.max(0, (unitPrice * qty) - couponDiscount + deliveryCharge);

    const idempotencyKey = `web-${product.id.slice(0, 6)}-${phone}-${Date.now()}`;

    // 4. Find or Create Contact in CRM
    let contactId: string | null = null;
    const { data: existingContact } = await admin
      .from('contacts')
      .select('id')
      .eq('account_id', product.account_id)
      .eq('phone', phone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      // Find admin user from profiles for user_id FK
      let { data: adminUser } = await admin
        .from('profiles')
        .select('user_id')
        .eq('account_id', product.account_id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!adminUser) {
        const { data: fallbackUser } = await admin
          .from('profiles')
          .select('user_id')
          .eq('account_id', product.account_id)
          .limit(1)
          .maybeSingle();
        adminUser = fallbackUser;
      }

      const ownerUserId = adminUser?.user_id;
      if (ownerUserId) {
        const { data: newContact } = await admin
          .from('contacts')
          .insert({
            account_id: product.account_id,
            user_id: ownerUserId,
            name: body.customerName.trim(),
            phone,
            address: body.customerAddress.trim(),
          })
          .select('id')
          .maybeSingle();

        if (newContact) contactId = newContact.id;
      }
    }

    // 5. Find or Create Conversation
    let conversationId: string | null = null;
    if (contactId) {
      const { data: conv } = await admin
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .maybeSingle();

      if (conv) {
        conversationId = conv.id;
      } else {
        const { data: newConv } = await admin
          .from('conversations')
          .insert({
            account_id: product.account_id,
            contact_id: contactId,
            status: 'open',
            channel: 'whatsapp',
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();
        if (newConv) conversationId = newConv.id;
      }
    }

    // 6. Insert Order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        account_id: product.account_id,
        conversation_id: conversationId,
        contact_id: contactId,
        product_id: product.id,
        product_name: product.name,
        variant: variantName,
        quantity: qty,
        unit_price: unitPrice,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        customer_name: body.customerName.trim(),
        customer_phone: phone,
        customer_address: body.customerAddress.trim(),
        thana: body.thana ? String(body.thana).trim() : null,
        district: body.district ? String(body.district).trim() : (matchedZone?.name || null),
        status: 'CONFIRMED',
        risk_level: 'LOW',
        notes: body.notes ? String(body.notes).trim() : 'Website Single Product Page Order',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error('[public-order] insert error:', orderErr);
      return NextResponse.json({ error: 'অর্ডার সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।' }, { status: 500 });
    }

    // 7. Atomic Stock Decrement & Audit Log
    try {
      await admin.rpc('decrement_product_stock', {
        p_product_id: product.id,
        p_quantity: qty,
        p_variant_id: body.variantId || null,
        p_order_id: order.id,
      });
    } catch (stockErr) {
      console.warn('[public-order] stock decrement warning:', stockErr);
    }

    // 8. Automated WhatsApp Order Confirmation to Customer
    if (conversationId) {
      try {
        const orderRef = order.invoice_no || order.id.slice(0, 8).toUpperCase();
        const confText = `আসসালামু আলাইকুম ${body.customerName.trim()}! 🛍️\n\nআপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে।\n\n📦 অর্ডার আইডি: #${orderRef}\n⌚ পণ্য: ${product.name} (${order.variant || 'Standard'})\n🔢 পরিমাণ: ${qty} টি\n💰 সর্বমোট: ৳${totalAmount.toLocaleString('en-BD')} (ক্যাশ অন ডেলিভারি)\n📍 ডেলিভারি ঠিকানা: ${body.customerAddress.trim()}\n\nআমাদের প্রতিনিধি খুব শীঘ্রই পার্সেলটি পাঠিয়ে কুরিয়ার ট্র্যাকিং কোড জানিয়ে দেবেন। ধন্যবাদ আমাদের সাথে কেনাকাটা করার জন্য! ✨`;

        await sendMessageToConversation(admin, product.account_id, {
          conversationId,
          messageType: 'text',
          contentText: confText,
        });
      } catch (waErr) {
        console.warn('[public-order] WhatsApp confirmation warning:', waErr);
      }
    }

    // 9. Send Web Push Notification to Team
    try {
      await sendPushToAccount(admin, product.account_id, {
        title: `🛍️ New Order: ৳${totalAmount.toLocaleString('en-BD')}`,
        body: `${body.customerName.trim()} ordered ${product.name} (${order.variant || 'Standard'})`,
        icon: product.image_url || '/icon-192.png',
        data: {
          url: '/orders',
        },
      });
    } catch (e) {
      console.warn('[public-order] push notify warning:', e);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      productName: product.name,
      variant: order.variant,
      quantity: order.quantity,
      unitPrice,
      deliveryCharge,
      totalAmount,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerAddress: order.customer_address,
      status: order.status,
    });
  } catch (err) {
    console.error('[public-order] fatal error:', err);
    return NextResponse.json({ error: 'সার্ভার ত্রুটি হয়েছে। অনুগ্রহ করে পরে চেষ্টা করুন।' }, { status: 500 });
  }
}
