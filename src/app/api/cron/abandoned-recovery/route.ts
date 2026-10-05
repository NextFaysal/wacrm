import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export const maxDuration = 120;

/**
 * Automated WhatsApp Abandoned Cart & Checkout Recovery Cron
 * Scans tracking sessions where:
 *   - has_cart_activity = true OR has_checkout_activity = true
 *   - has_order_activity = false
 *   - idle between 30 minutes and 24 hours
 * Dispatches a high-converting personalized WhatsApp recovery message to the visitor / lead.
 */
export async function GET(request: Request) {
  return handleAbandonedRecoveryCron(request);
}

export async function POST(request: Request) {
  return handleAbandonedRecoveryCron(request);
}

async function handleAbandonedRecoveryCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();
  const now = new Date();
  // Idle for at least 30 mins, but no older than 24 hours
  const minIdleTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const maxIdleTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const results = {
    sessionsEvaluated: 0,
    checkoutsEvaluated: 0,
    recoveriesSent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // 1. Recover unrecovered dropped checkouts from abandoned_checkouts table
    const { data: abandonedCheckouts, error: abError } = await db
      .from('abandoned_checkouts')
      .select('*')
      .eq('recovered', false)
      .lt('created_at', minIdleTime)
      .gt('created_at', maxIdleTime)
      .limit(30);

    if (!abError && abandonedCheckouts && abandonedCheckouts.length > 0) {
      for (const lead of abandonedCheckouts) {
        results.checkoutsEvaluated++;

        const cleanPhone = (lead.customer_phone || '').replace(/[^0-9]/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
          results.skipped++;
          continue;
        }

        try {
          // Get or create contact
          let contactId: string | null = null;
          const { data: contact } = await db
            .from('contacts')
            .select('id')
            .eq('account_id', lead.account_id)
            .ilike('phone', `%${cleanPhone.slice(-10)}%`)
            .maybeSingle();

          if (contact) {
            contactId = contact.id;
          } else {
            const { data: newC } = await db
              .from('contacts')
              .insert({
                account_id: lead.account_id,
                phone: cleanPhone,
                name: lead.customer_name || 'Valued Customer',
              })
              .select('id')
              .single();
            contactId = newC?.id || null;
          }

          if (!contactId) continue;

          // Get or create conversation
          let convId: string | null = null;
          const { data: conv } = await db
            .from('conversations')
            .select('id, last_message_at')
            .eq('account_id', lead.account_id)
            .eq('contact_id', contactId)
            .maybeSingle();

          if (conv) {
            convId = conv.id;
          } else {
            const { data: newConv } = await db
              .from('conversations')
              .insert({
                account_id: lead.account_id,
                contact_id: contactId,
                status: 'open',
                channel: 'whatsapp',
                unread_count: 0,
              })
              .select('id')
              .single();
            convId = newConv?.id || null;
          }

          if (!convId) continue;

          const greeting = lead.customer_name ? `সম্মানিত ${lead.customer_name},` : 'সম্মানিত গ্রাহক,';
          const prodTitle = lead.product_name ? `*${lead.product_name}*` : 'আপনার পছন্দের পণ্যটি';

          const msg = `আসসালামু আলাইকুম ${greeting} 🌸\n` +
            `আপনি আমাদের স্টোরে ${prodTitle} অর্ডার করার প্রক্রিয়া শুরু করেছিলেন কিন্তু সম্পন্ন করেননি।\n\n` +
            `🎁 *আজকের স্পেশাল অফার:* অর্ডারটি কনফার্ম করলে পাচ্ছেন ফ্রি ডেলিভারি ও দ্রুততম ক্যাশ অন ডেলিভারি (COD) সুবিধা!\n\n` +
            `অর্ডারটি কনফার্ম করতে অনুগ্রহ করে আপনার পূর্ণ ডেলিভারি ঠিকানা ও মোবাইল নম্বর লিখে রিপ্লাই দিন। আমরা পার্সেলটি পাঠিয়ে দেওয়ার ব্যবস্থা করছি। ধন্যবাদ! 🛍️`;

          await sendMessageToConversation(db, lead.account_id, {
            conversationId: convId,
            messageType: 'text',
            contentText: msg,
          });

          // Mark recovered or updated
          await db
            .from('abandoned_checkouts')
            .update({
              recovered: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          results.recoveriesSent++;
        } catch (err: any) {
          results.errors.push(`Lead ${lead.id}: ${err.message}`);
        }
      }
    }

    // 2. Scan Tracking Sessions with Cart/Checkout activity but no order
    const { data: droppedSessions, error: sessionErr } = await db
      .from('tracking_sessions')
      .select(`
        id,
        account_id,
        visitor_id,
        landing_page,
        has_cart_activity,
        has_checkout_activity,
        has_order_activity,
        created_at,
        visitor:tracking_visitors(id, contact_id, phone:ip_address)
      `)
      .or('has_cart_activity.eq.true,has_checkout_activity.eq.true')
      .eq('has_order_activity', false)
      .lt('created_at', minIdleTime)
      .gt('created_at', maxIdleTime)
      .limit(30);

    if (!sessionErr && droppedSessions) {
      for (const sess of droppedSessions) {
        results.sessionsEvaluated++;
        const contactId = (sess.visitor as any)?.contact_id;
        if (!contactId) {
          // Anonymous visitor without phone stitched -> cannot message
          results.skipped++;
          continue;
        }

        // Check if already placed order recently
        const { data: placedOrder } = await db
          .from('orders')
          .select('id')
          .eq('account_id', sess.account_id)
          .eq('contact_id', contactId)
          .gt('created_at', maxIdleTime)
          .maybeSingle();

        if (placedOrder) {
          results.skipped++;
          continue;
        }

        // Find conversation
        const { data: conv } = await db
          .from('conversations')
          .select('id')
          .eq('account_id', sess.account_id)
          .eq('contact_id', contactId)
          .maybeSingle();

        if (!conv) {
          results.skipped++;
          continue;
        }

        const recoveryText = `আসসালামু আলাইকুম! 😊\n` +
          `আপনি আমাদের ওয়েবসাইট ভিজিট করে কার্টে প্রোডাক্ট যুক্ত করেছিলেন।\n` +
          `স্টক সীমিত থাকায় আপনার সুবিধার্থে পণ্যটি সংরক্ষিত রয়েছে। আপনি কি অর্ডারটি কনফার্ম করতে চান? ডেলিভারি সংক্রান্ত যেকোনো তথ্যের জন্য জানাতে পারেন! ✨`;

        await sendMessageToConversation(db, sess.account_id, {
          conversationId: conv.id,
          messageType: 'text',
          contentText: recoveryText,
        });

        // Mark session as converted/recovered so it does not trigger again
        await db
          .from('tracking_sessions')
          .update({ has_order_activity: true })
          .eq('id', sess.id);

        results.recoveriesSent++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
