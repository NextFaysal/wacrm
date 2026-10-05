import { supabaseAdmin } from '@/lib/flows/admin-client';
import { scanCustomerRiskProfile } from '@/lib/courier/fraud-shield';
import { sendMetaCapiEvent } from '@/lib/meta/capi';
import { formatBDPhone } from '@/lib/courier/dispatch';

export interface ParsedCustomerOrder {
  phone?: string;
  name?: string;
  address?: string;
  quantity: number;
  city?: string;
  hasOrderDetails: boolean;
}

/**
 * Parses customer message to extract phone, name, delivery address, and quantity.
 */
export function parseCustomerOrderMessage(rawText: string): ParsedCustomerOrder {
  const text = rawText.trim();

  // 1. Extract Bangladeshi Phone Number
  // Match 01XXXXXXXXX or 8801XXXXXXXXX or +8801XXXXXXXXX
  const phoneMatch = text.match(/(?:(?:\+|00)880|880|0)?(1[3-9]\d{8})\b/);
  const phone = phoneMatch ? `0${phoneMatch[1]}` : undefined;

  // 2. Extract Quantity (e.g. 1টা, ২টা, 3 pcs, 2 pieces)
  let quantity = 1;
  const qtyMatch = text.match(/(\d+)\s*(?:টা|টি|পিস|জোড়া|pcs|pc|quantity|qty)/i);
  if (qtyMatch) {
    const parsedQty = parseInt(qtyMatch[1], 10);
    if (!isNaN(parsedQty) && parsedQty > 0 && parsedQty <= 50) {
      quantity = parsedQty;
    }
  }

  // 3. Extract Name
  let name: string | undefined;
  const nameLabelMatch = text.match(/(?:নাম|name)\s*[:ঃ-]?\s*([^\n,]+)/i);
  if (nameLabelMatch && nameLabelMatch[1].trim().length > 1) {
    name = nameLabelMatch[1].trim();
  }

  // 4. Extract Address
  let address: string | undefined;
  const addrLabelMatch = text.match(/(?:ঠিকানা|address|location|ঠিকনা)\s*[:ঃ-]?\s*([^\n]+(?:\n[^\n]+)?)/i);
  if (addrLabelMatch && addrLabelMatch[1].trim().length > 3) {
    address = addrLabelMatch[1].trim();
  }

  // If no explicit labels found, try line-by-line heuristic
  if (!name || !address) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // Ignore line if it's just the phone number
      if (phone && line.includes(phone)) continue;

      // Check if line contains address keywords
      const isAddressLine =
        /ঢাকা|চট্টগ্রাম|সিলেট|রাজশাহী|খুলনা|বরিশাল|রংপুর|রোড|বাসা|থানা|জেলা|গ্রাম|ধানমন্ডি|মিরপুর|উত্তরা|গুলশান|বনানী|বসুন্ধরা|মোহাম্মদপুর|মতিঝিল|যাত্রাবাড়ী|পোস্ট|house|road|sector|block|thana|dist|ward|floor/i.test(
          line
        );

      if (isAddressLine && !address) {
        address = line;
      } else if (!name && line.length >= 3 && line.length <= 40 && !/\d{4,}/.test(line) && !isAddressLine) {
        name = line;
      }
    }
  }

  // Detect City (Dhaka vs Outside Dhaka)
  let city = 'Outside Dhaka';
  if (address && /dhaka|ঢাকা|ধানমন্ডি|মিরপুর|উত্তরা|গুলশান|বনানী|মতিঝিল|মোহাম্মদপুর/i.test(address)) {
    city = 'Dhaka';
  }

  const hasOrderDetails = Boolean(phone && address && address.length >= 5);

  return {
    phone,
    name: name || 'সম্মানিত গ্রাহক',
    address,
    quantity,
    city,
    hasOrderDetails,
  };
}

/**
 * Automatically creates an order from customer chat message and returns
 * formatted confirmation receipt message in Bangla.
 */
export async function processInboundConversationalOrder({
  accountId,
  conversationId,
  contactId,
  text,
  channel = 'facebook',
}: {
  accountId: string;
  conversationId?: string;
  contactId?: string;
  text: string;
  channel?: 'whatsapp' | 'facebook' | 'instagram';
}): Promise<{
  orderCreated: boolean;
  order?: any;
  confirmationMessage?: string;
}> {
  const parsed = parseCustomerOrderMessage(text);

  if (!parsed.hasOrderDetails || !parsed.phone || !parsed.address) {
    return { orderCreated: false };
  }

  const db = supabaseAdmin();
  const phone = parsed.phone;

  // 1. Check for duplicate order in the last 10 minutes to prevent double-submit
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentOrder } = await db
    .from('orders')
    .select('id, invoice_no, total_amount')
    .eq('account_id', accountId)
    .eq('customer_phone', phone)
    .gt('created_at', tenMinutesAgo)
    .maybeSingle();

  if (recentOrder) {
    // Already created
    return {
      orderCreated: false,
    };
  }

  // 2. Resolve Product from Conversation Memory or Active Products
  let product: any = null;

  if (conversationId) {
    const { data: conv } = await db
      .from('conversations')
      .select('ai_memory')
      .eq('id', conversationId)
      .maybeSingle();

    const interestedProdId = conv?.ai_memory?.interested_product_id;
    if (interestedProdId) {
      const { data: memProd } = await db
        .from('products')
        .select('*')
        .eq('id', interestedProdId)
        .maybeSingle();
      if (memProd) product = memProd;
    }
  }

  if (!product) {
    // Look up default/featured product for this account
    const { data: firstProd } = await db
      .from('products')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    product = firstProd;
  }

  const productName = product?.title || product?.name || 'প্রিমিয়াম প্রোডাক্ট';
  const unitPrice = Number(product?.price) || 1200;
  const isDhaka = parsed.city === 'Dhaka';
  const deliveryCharge = isDhaka ? 60 : 120;
  const totalAmount = unitPrice * parsed.quantity + deliveryCharge;
  const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;

  // 3. Scan Fraud Risk Shield
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let riskScore = 95;
  try {
    const profile = await scanCustomerRiskProfile(accountId, phone);
    riskScore = profile.trustScore;
    if (profile.riskLevel === 'HIGH_RISK') riskLevel = 'HIGH';
    else if (profile.riskLevel === 'MODERATE') riskLevel = 'MEDIUM';
  } catch {
    // fallback default
  }

  // 4. Update Contact info if available
  if (contactId) {
    await db
      .from('contacts')
      .update({
        phone: formatBDPhone(phone),
        name: parsed.name !== 'সম্মানিত গ্রাহক' ? parsed.name : undefined,
      })
      .eq('id', contactId);
  }

  // 5. Insert Order
  const { data: newOrder, error: ordErr } = await db
    .from('orders')
    .insert({
      account_id: accountId,
      conversation_id: conversationId || null,
      contact_id: contactId || null,
      product_id: product?.id || null,
      product_name: productName,
      quantity: parsed.quantity,
      unit_price: unitPrice,
      delivery_charge: deliveryCharge,
      total_amount: totalAmount,
      customer_name: parsed.name || 'সম্মানিত গ্রাহক',
      customer_phone: phone,
      customer_address: parsed.address,
      customer_city: isDhaka ? 'Dhaka' : 'Outside Dhaka',
      status: 'NEW',
      call_status: 'uncalled',
      risk_level: riskLevel,
      risk_score: riskScore,
      invoice_no: invoiceNo,
      notes: `অটো-অর্ডার সিস্টেম (${channel.toUpperCase()}) দ্বারা স্বয়ংক্রিয়ভাবে সংগৃহীত`,
    })
    .select('*')
    .single();

  if (ordErr || !newOrder) {
    console.error('[conversational-order] insert error:', ordErr);
    return { orderCreated: false };
  }

  // 6. Trigger Meta CAPI Server Event in Background
  try {
    const { data: pixelConfig } = await db
      .from('meta_pixel_configs')
      .select('pixel_id, access_token, test_event_code')
      .eq('account_id', accountId)
      .eq('is_enabled', true)
      .maybeSingle();

    if (pixelConfig?.pixel_id && pixelConfig?.access_token) {
      void sendMetaCapiEvent(
        {
          pixelId: pixelConfig.pixel_id,
          accessToken: pixelConfig.access_token,
          testEventCode: pixelConfig.test_event_code,
        },
        {
          eventName: 'Purchase',
          actionSource: 'chat',
          userData: {
            phone,
            name: parsed.name,
            city: parsed.city,
            country: 'bd',
          },
          customData: {
            value: totalAmount,
            currency: 'BDT',
            orderId: newOrder.id,
            contentName: productName,
          },
        }
      );
    }
  } catch {
    // safe ignore CAPI errors
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wacrm.live').replace(/\/$/, '');
  const trackUrl = `${appUrl}/track/${encodeURIComponent(invoiceNo)}`;

  // 7. Format Customer Confirmation Receipt in Bangla
  const confirmationMessage =
    `🎉 আলহামদুলিল্লাহ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 ইনভয়েস: *${invoiceNo}*\n` +
    `📦 প্রোডাক্ট: *${productName}* (${parsed.quantity} টি)\n` +
    `💰 মোট বিল (COD): *৳${totalAmount.toLocaleString('en-BD')}* (ডেলিভারি চার্জ সহ)\n` +
    `📍 ডেলিভারি ঠিকানা: ${parsed.address}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚚 ডেলিভারি সময়: ${isDhaka ? '২৪-৪৮ ঘণ্টার মধ্যে' : '৪৮-৭২ ঘণ্টার মধ্যে'}।\n\n` +
    `পার্সেলটি রাইডার নিয়ে বের হওয়ার সাথে সাথে আপনাকে জানানো হবে। লাইভ ট্র্যাক করতে:\n` +
    `👉 ${trackUrl}\n\n` +
    `আমাদের সাথে থাকার জন্য ধন্যবাদ! ❤️`;

  return {
    orderCreated: true,
    order: newOrder,
    confirmationMessage,
  };
}
