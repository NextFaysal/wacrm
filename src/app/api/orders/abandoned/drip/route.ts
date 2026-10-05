import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const { abandonedId, discountCode, discountAmount } = await request.json();

    if (!abandonedId) {
      return NextResponse.json({ error: 'abandonedId is required' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // 1. Fetch abandoned checkout
    const { data: lead, error: leadErr } = await db
      .from('abandoned_checkouts')
      .select('*')
      .eq('id', abandonedId)
      .eq('account_id', accountId)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Abandoned checkout not found' }, { status: 404 });
    }

    // 2. Fetch business storefront settings
    const { data: store } = await db
      .from('business_settings')
      .select('store_name, store_slug, support_phone')
      .eq('account_id', accountId)
      .maybeSingle();

    const host = request.headers.get('host') || 'wacrm.live';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const storeName = store?.store_name || 'আমাদের শপ';

    // 3. Find or create Contact
    let contactId: string | null = null;
    const cleanPhone = lead.customer_phone.replace(/[^0-9]/g, '');

    const { data: existingContact } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await db
        .from('contacts')
        .insert({
          account_id: accountId,
          phone: cleanPhone,
          name: lead.customer_name || 'Customer',
        })
        .select('id')
        .single();
      contactId = newContact?.id || null;
    }

    if (!contactId) {
      return NextResponse.json({ error: 'Could not resolve contact' }, { status: 500 });
    }

    // 4. Find or create Conversation
    let conversationId: string | null = null;
    const { data: existingConv } = await db
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await db
        .from('conversations')
        .insert({
          account_id: accountId,
          contact_id: contactId,
          status: 'open',
          channel: 'whatsapp',
          unread_count: 0,
        })
        .select('id')
        .single();
      conversationId = newConv?.id || null;
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Could not resolve conversation' }, { status: 500 });
    }

    // 5. Construct high-converting recovery message
    const greeting = lead.customer_name ? `সম্মানিত ${lead.customer_name},` : 'সম্মানিত গ্রাহক,';
    const prodName = lead.product_name ? `*${lead.product_name}*` : 'আপনার পছন্দের পণ্যটি';
    const couponOffer = discountCode
      ? `\n🎁 *স্পেশাল উপহার:* অর্ডার সম্পন্ন করলে উপভোগ করুন ৳${discountAmount || '৫০'} ডিসকাউন্ট! কোড: *${discountCode}*\n`
      : '';

    const recoveryMessage = `আসসালামু আলাইকুম ${greeting} 🌸
আপনি ${storeName}-এ ${prodName} অর্ডার করার প্রক্রিয়া শুরু করেছিলেন কিন্তু ফাইনাল কনফার্ম করেননি।

আমরা পণ্যটি আপনার জন্য সাময়িকভাবে হোল্ড করে রেখেছি।${couponOffer}
📦 *সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি (COD) সুবিধা!*

অর্ডারটি কনফার্ম করতে অনুগ্রহ করে আপনার:
১. নাম
২. মোবাইল নম্বর
৩. পূর্ণ ডেলিভারি ঠিকানা (জেলা, থানা, বাসা)
এখানে লিখে রিপ্লাই দিন অথবা যেকোনো প্রশ্নে মেসেজ করুন। ধন্যবাদ!`;

    // 6. Send via WhatsApp
    await sendMessageToConversation(db, accountId, {
      conversationId,
      messageType: 'text',
      contentText: recoveryMessage,
    });

    // 7. Update abandoned checkout
    await db
      .from('abandoned_checkouts')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', abandonedId);

    return NextResponse.json({
      success: true,
      conversationId,
      message: 'রিকাভারি মেসেজ সফলভাবে কাস্টমারকে পাঠানো হয়েছে!',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
