import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendMetaGenericTemplate } from '@/lib/meta/graph-api';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const { conversationId, productId } = await request.json();

    if (!conversationId || !productId) {
      return NextResponse.json(
        { error: 'conversationId and productId are required' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // 1. Fetch conversation & contact
    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('id, channel, meta_psid, meta_page_id, contact_id, contact:contacts(phone, name)')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 2. Fetch product
    const { data: product, error: prodErr } = await db
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('account_id', accountId)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 3. Fetch store slug for public URL
    const { data: store } = await db
      .from('business_settings')
      .select('store_slug, store_name')
      .eq('account_id', accountId)
      .maybeSingle();

    const host = request.headers.get('host') || 'wacrm.live';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const storeUrl = store?.store_slug
      ? `${protocol}://${host}/store/${store.store_slug}/p/${product.slug || product.id}`
      : `${protocol}://${host}/p/${product.slug || product.id}`;

    const productImage =
      product.images?.[0] ||
      product.image_url ||
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop';

    // 4. Send interactive template based on channel
    if (conv.channel === 'facebook' && conv.meta_psid) {
      const { data: metaConfig } = await db
        .from('meta_integrations')
        .select('page_access_token')
        .eq('account_id', accountId)
        .single();

      if (!metaConfig?.page_access_token) {
        return NextResponse.json({ error: 'Meta Page token missing' }, { status: 400 });
      }

      await sendMetaGenericTemplate({
        accessToken: metaConfig.page_access_token,
        recipientId: conv.meta_psid,
        elements: [
          {
            title: product.title.slice(0, 80),
            subtitle: `৳${product.price} · ক্যাশ অন ডেলিভারি সুবিধা`,
            image_url: productImage,
            buttons: [
              {
                type: 'postback',
                title: '🛍️ অর্ডার করুন (COD)',
                payload: `ORDER_COD:${product.id}`,
              },
              {
                type: 'web_url',
                title: '🌐 বিস্তারিত দেখুন',
                url: storeUrl,
              },
            ],
          },
        ],
      });

      // Persist outbound message in database
      await db.from('messages').insert({
        conversation_id: conv.id,
        sender_type: 'agent',
        content_type: 'text',
        content_text: `[🛍️ Interactive Product Card: ${product.title} - ৳${product.price}]`,
        created_at: new Date().toISOString(),
      });

      await db
        .from('conversations')
        .update({
          last_message_text: `Product Card: ${product.title}`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conv.id);

      return NextResponse.json({ success: true, channel: 'facebook' });
    }

    // Default: WhatsApp channel
    const waText = `🛍️ *${product.title}*
━━━━━━━━━━━━━━━━━━━━
💰 *মূল্য:* ৳${product.price}
${product.brand ? `🏷️ *ব্র্যান্ড:* ${product.brand}\n` : ''}${product.description ? `${product.description.slice(0, 150)}...\n` : ''}
🚚 ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ)
👉 অনলাইনে সরাসরি অর্ডার করতে: ${storeUrl}

অর্ডার কনফার্ম করতে আপনার নাম, মোবাইল ও ডেলিভারি ঠিকানা লিখে পাঠান!`;

    await sendMessageToConversation(db, accountId, {
      conversationId: conv.id,
      messageType: product.image_url ? 'image' : 'text',
      contentText: waText,
      mediaUrl: product.image_url || undefined,
    });

    return NextResponse.json({ success: true, channel: 'whatsapp' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
