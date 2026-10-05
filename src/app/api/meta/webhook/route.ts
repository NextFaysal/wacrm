import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MetaWebhookPayload } from '@/lib/meta/types';
import { processAiCommentReply } from '@/lib/meta/ai-comment-reply';
import { sendMetaMessage } from '@/lib/meta/graph-api';
import { processInboundConversationalOrder } from '@/lib/ai/conversational-order';

let _adminClient: any = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

/**
 * GET /api/meta/webhook - Webhook Verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    const db = getAdminClient();
    // Validate token against any configured account or default token
    const { data } = await db
      .from('meta_integrations')
      .select('verify_token')
      .eq('verify_token', token)
      .limit(1);

    if (data && data.length > 0 || token === 'wacrm_meta_verify_token') {
      return new Response(challenge, { status: 200 });
    }
  }

  return new Response('Forbidden', { status: 403 });
}

/**
 * POST /api/meta/webhook - Receive Meta Events (Messages, Comments)
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as MetaWebhookPayload | null;
    if (!payload || !payload.entry) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const db = getAdminClient();

    for (const entry of payload.entry) {
      const pageOrIgId = entry.id;

      // Find matching account by Page ID or Instagram Account ID
      const { data: metaConfig } = await db
        .from('meta_integrations')
        .select('*')
        .or(`page_id.eq.${pageOrIgId},instagram_account_id.eq.${pageOrIgId}`)
        .maybeSingle();

      if (!metaConfig) {
        // If not matched by exact ID, fallback to the first active meta integration
        const { data: fallbackConfig } = await db
          .from('meta_integrations')
          .select('*')
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle();

        if (!fallbackConfig) continue;
      }

      const activeConfig = metaConfig || (await db.from('meta_integrations').select('*').limit(1).single()).data;
      if (!activeConfig) continue;

      const accountId = activeConfig.account_id;

      // 1. Process Messages (Facebook Messenger & Instagram Direct)
      if (entry.messaging && entry.messaging.length > 0) {
        for (const msgEvent of entry.messaging) {
          const senderId = msgEvent.sender.id;
          const recipientId = msgEvent.recipient.id;
          const postbackPayload = msgEvent.postback?.payload;
          const postbackTitle = msgEvent.postback?.title;
          const messageText = msgEvent.message?.text || (postbackTitle ? `[Clicked: ${postbackTitle}]` : undefined);
          const mid = msgEvent.message?.mid || (postbackPayload ? `mid_pb_${Date.now()}` : undefined);

          // Ignore echoes sent by the page itself
          if (senderId === activeConfig.page_id || senderId === activeConfig.instagram_account_id) {
            continue;
          }

          if (!messageText && !msgEvent.message?.attachments && !postbackPayload) continue;

          const channel = payload.object === 'instagram' ? 'instagram' : 'facebook';

          // Background task for message handling
          after(async () => {
            try {
              // Find or create contact
              let contactId: string | null = null;
              const { data: existingContact } = await db
                .from('contacts')
                .select('id')
                .eq('account_id', accountId)
                .eq('wa_user_id', senderId)
                .maybeSingle();

              if (existingContact) {
                contactId = existingContact.id;
              } else {
                const { data: newContact } = await db
                  .from('contacts')
                  .insert({
                    account_id: accountId,
                    phone: '', // PSID contacts don't have phone until provided
                    name: `${channel === 'instagram' ? 'IG User' : 'FB User'} (${senderId.slice(-4)})`,
                    wa_user_id: senderId,
                  })
                  .select('id')
                  .single();
                contactId = newContact?.id || null;
              }

              if (!contactId) return;

              // Find or create conversation
              let conversationId: string | null = null;
              const { data: existingConv } = await db
                .from('conversations')
                .select('id')
                .eq('account_id', accountId)
                .eq('contact_id', contactId)
                .maybeSingle();

              if (existingConv) {
                conversationId = existingConv.id;
                await db
                  .from('conversations')
                  .update({
                    last_message_text: messageText || 'Attachment',
                    last_message_at: new Date().toISOString(),
                    unread_count: 1,
                    channel,
                    meta_psid: senderId,
                    meta_page_id: recipientId,
                  })
                  .eq('id', conversationId);
              } else {
                const { data: newConv } = await db
                  .from('conversations')
                  .insert({
                    account_id: accountId,
                    contact_id: contactId,
                    status: 'open',
                    channel,
                    meta_psid: senderId,
                    meta_page_id: recipientId,
                    last_message_text: messageText || 'Attachment',
                    last_message_at: new Date().toISOString(),
                    unread_count: 1,
                  })
                  .select('id')
                  .single();
                conversationId = newConv?.id || null;
              }

              if (conversationId && mid) {
                await db.from('messages').insert({
                  conversation_id: conversationId,
                  sender_type: 'customer',
                  content_type: 'text',
                  content_text: messageText || '[Attachment]',
                  message_id: mid,
                  status: 'delivered',
                });
              }

              // Automatic Natural Language Order Intake
              if (messageText && conversationId && !postbackPayload) {
                try {
                  const autoOrder = await processInboundConversationalOrder({
                    accountId,
                    conversationId,
                    contactId: contactId || undefined,
                    text: messageText,
                    channel,
                  });

                  if (autoOrder.orderCreated && autoOrder.confirmationMessage && activeConfig.page_access_token) {
                    await sendMetaMessage({
                      accessToken: activeConfig.page_access_token,
                      recipientId: senderId,
                      messageText: autoOrder.confirmationMessage,
                    });

                    await db.from('messages').insert({
                      conversation_id: conversationId,
                      sender_type: 'bot',
                      content_type: 'text',
                      content_text: autoOrder.confirmationMessage,
                      status: 'delivered',
                    });
                  }
                } catch (orderErr) {
                  console.warn('[meta-webhook] auto order error:', orderErr);
                }
              }

              // Handle 1-Click Interactive Button Postbacks (COD Order / Agent request)
              if (postbackPayload && conversationId) {
                if (postbackPayload.startsWith('ORDER_COD:') && activeConfig.page_access_token) {
                  const prodId = postbackPayload.replace('ORDER_COD:', '');
                  const { data: prod } = await db
                    .from('products')
                    .select('title, price')
                    .eq('id', prodId)
                    .maybeSingle();

                  const orderPrompt = `🛍️ *আপনার পছন্দের পণ্য:* ${prod?.title || 'পণ্য'}
💰 *মূল্য:* ৳${prod?.price || ''} (ক্যাশ অন ডেলিভারি)
━━━━━━━━━━━━━━━━━━━━
অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে আপনার:
১. নাম
২. মোবাইল নম্বর
৩. পূর্ণ ডেলিভারি ঠিকানা (জেলা, থানা, বাসা/রোড নং)
এখানে লিখে রিপ্লাই দিন। আমরা খুব দ্রুত আপনার পার্সেল পাঠিয়ে দেব!`;

                  await sendMetaMessage({
                    accessToken: activeConfig.page_access_token,
                    recipientId: senderId,
                    messageText: orderPrompt,
                  });

                  await db.from('messages').insert({
                    conversation_id: conversationId,
                    sender_type: 'bot',
                    content_type: 'text',
                    content_text: orderPrompt,
                    status: 'delivered',
                  });
                } else if (postbackPayload === 'REQUEST_HUMAN' && activeConfig.page_access_token) {
                  const humanMsg = 'ধন্যবাদ! আমাদের কাস্টমার সাপোর্ট টিমকে অবগত করা হয়েছে। খুব শীঘ্রই একজন এজেন্ট আপনার সাথে যোগাযোগ করবেন।';
                  await sendMetaMessage({
                    accessToken: activeConfig.page_access_token,
                    recipientId: senderId,
                    messageText: humanMsg,
                  });
                  await db.from('conversations').update({ is_human_needed: true }).eq('id', conversationId);
                  await db.from('messages').insert({
                    conversation_id: conversationId,
                    sender_type: 'bot',
                    content_type: 'text',
                    content_text: humanMsg,
                    status: 'delivered',
                  });
                }
              }
            } catch (convErr) {
              console.error('[meta-webhook] conversation handle error:', convErr);
            }
          });
        }
      }

      // 2. Process Comments (Facebook Feed & Instagram Comments)
      if (entry.changes && entry.changes.length > 0) {
        for (const change of entry.changes) {
          // A. Facebook Page Comments
          if (change.field === 'feed') {
            const val = change.value;
            if (val.item === 'comment' && val.verb === 'add' && val.comment_id && val.message) {
              const commentId = val.comment_id;
              const senderId = val.from?.id;
              const senderName = val.from?.name;
              const postId = val.post_id;
              const message = val.message;

              // Don't auto-reply to comments made by the page itself
              if (senderId === activeConfig.page_id) continue;

              after(async () => {
                try {
                  // Save comment
                  const { error: insertErr } = await db.from('meta_comments').upsert(
                    {
                      account_id: accountId,
                      platform: 'facebook',
                      post_id: postId,
                      comment_id: commentId,
                      parent_comment_id: val.parent_id || null,
                      sender_id: senderId,
                      sender_name: senderName,
                      message: message,
                      comment_created_at: val.created_time ? new Date(val.created_time * 1000).toISOString() : new Date().toISOString(),
                    },
                    { onConflict: 'account_id,comment_id' }
                  );

                  if (!insertErr && activeConfig.ai_comment_reply_enabled) {
                    await processAiCommentReply({
                      accountId,
                      platform: 'facebook',
                      commentId,
                      senderName,
                      message,
                    });
                  }
                } catch (commentErr) {
                  console.error('[meta-webhook] facebook comment processing error:', commentErr);
                }
              });
            }
          }

          // B. Instagram Comments
          if (change.field === 'comments') {
            const val = change.value;
            const commentId = val.id;
            const text = val.text;
            const igUsername = val.user?.username;
            const igUserId = val.user?.id;
            const mediaId = val.media?.id;

            if (commentId && text && igUserId !== activeConfig.instagram_account_id) {
              after(async () => {
                try {
                  const { error: igInsertErr } = await db.from('meta_comments').upsert(
                    {
                      account_id: accountId,
                      platform: 'instagram',
                      post_id: mediaId,
                      comment_id: commentId,
                      sender_id: igUserId,
                      sender_name: igUsername,
                      sender_username: igUsername,
                      message: text,
                      comment_created_at: new Date().toISOString(),
                    },
                    { onConflict: 'account_id,comment_id' }
                  );

                  if (!igInsertErr && activeConfig.ai_comment_reply_enabled) {
                    await processAiCommentReply({
                      accountId,
                      platform: 'instagram',
                      commentId,
                      senderName: igUsername,
                      message: text,
                    });
                  }
                } catch (igErr) {
                  console.error('[meta-webhook] instagram comment processing error:', igErr);
                }
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err: any) {
    console.error('[meta-webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
