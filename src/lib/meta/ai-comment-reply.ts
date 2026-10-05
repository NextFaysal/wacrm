import { createClient } from '@supabase/supabase-js';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';
import { replyFacebookComment, replyFacebookCommentPrivate, replyInstagramComment } from './graph-api';
import type { MetaPlatform } from './types';

// Admin client for background webhook tasks
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

export interface HandleAiCommentParams {
  accountId: string;
  platform: MetaPlatform;
  commentId: string;
  postCaption?: string | null;
  senderName?: string | null;
  message: string;
}

/**
 * Automatically process and reply to a Facebook or Instagram comment using AI.
 */
export async function processAiCommentReply(params: HandleAiCommentParams): Promise<{
  publicReply: string;
  privateDmSent: boolean;
}> {
  const db = getAdminClient();

  // 1. Fetch Meta Integration config
  const { data: metaConfig, error: configError } = await db
    .from('meta_integrations')
    .select('*')
    .eq('account_id', params.accountId)
    .single();

  if (configError || !metaConfig || !metaConfig.page_access_token) {
    console.warn('[ai-comment-reply] Meta config or page_access_token missing for account:', params.accountId);
    return { publicReply: '', privateDmSent: false };
  }

  if (!metaConfig.ai_comment_reply_enabled) {
    console.log('[ai-comment-reply] AI comment reply disabled for account:', params.accountId);
    return { publicReply: '', privateDmSent: false };
  }

  // 2. Load account AI config
  const aiConfig = await loadAiConfig(db, params.accountId, { requireActive: false });
  if (!aiConfig) {
    console.warn('[ai-comment-reply] No AI config found for account:', params.accountId);
    return { publicReply: '', privateDmSent: false };
  }

  // 3. Craft system prompt for comment auto-reply
  const customPrompt = metaConfig.ai_comment_prompt || 
    'You are a courteous, warm, and helpful social media customer support manager for an e-commerce shop.';

  const systemPrompt = `${customPrompt}

Guidelines for commenting:
1. Keep the public reply short, natural, friendly, and engaging (1 to 2 sentences max).
2. Reply in the SAME language the customer used (Bengali, Banglish, or English).
3. If the user asks for price, availability, details, or ordering (e.g. "দাম কত", "price", "details", "order"), warmly inform them that we sent the full price and details directly to their inbox/DM, and ask them to check their messages.
4. If they leave a compliment, express heartfelt thanks.
5. If they ask a product question, provide a helpful brief answer.
6. Do NOT include markdown bold or headers, just plain friendly text.`;

  const userTurn = `Post Context: ${params.postCaption || 'Product Post'}
Customer Name: ${params.senderName || 'Customer'}
Customer Comment: "${params.message}"

Please generate the public reply for this comment.`;

  // 4. Generate AI reply
  let publicReply = '';
  try {
    const aiResult = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: userTurn }],
    });
    publicReply = aiResult.text.trim();
  } catch (err: any) {
    console.error('[ai-comment-reply] Generation failed:', err?.message || err);
    // Fallback polite reply
    const isBengali = /[\u0980-\u09FF]/.test(params.message) || /dam|koto|price/i.test(params.message);
    publicReply = isBengali
      ? 'ধন্যবাদ আপনার কমেন্টের জন্য! বিস্তারিত আপনার ইনবক্সে জানিয়ে দেওয়া হচ্ছে, দয়া করে মেসেজ চেক করুন 🙏'
      : 'Thank you for your comment! We have sent the details to your inbox. Please check your messages 🙏';
  }

  // 5. Post public reply via Meta Graph API
  try {
    if (params.platform === 'facebook') {
      await replyFacebookComment({
        accessToken: metaConfig.page_access_token,
        commentId: params.commentId,
        message: publicReply,
      });
    } else {
      await replyInstagramComment({
        accessToken: metaConfig.page_access_token,
        commentId: params.commentId,
        message: publicReply,
      });
    }

    // Save reply record
    await db.from('meta_comment_replies').insert({
      account_id: params.accountId,
      comment_id: params.commentId,
      sender_type: 'ai',
      message: publicReply,
      is_private: false,
    });
  } catch (replyErr: any) {
    console.error('[ai-comment-reply] Failed to post public reply:', replyErr?.message || replyErr);
  }

  // 6. Check if private DM should be sent (for Facebook)
  let privateDmSent = false;
  const isAskingPriceOrDetails = /price|দাম|koto|cost|details|inbox|order|order korbo/i.test(params.message);

  if (
    params.platform === 'facebook' &&
    metaConfig.ai_comment_private_dm_enabled &&
    metaConfig.page_id &&
    isAskingPriceOrDetails
  ) {
    try {
      const dmSystemPrompt = `You are a helpful sales assistant. The customer asked about a product in a comment: "${params.message}". 
Context: ${params.postCaption || 'Product'}
Generate a polite, inviting private inbox message to the customer welcoming them, asking which size/color or product they prefer, and giving pricing guidance or offering to take their delivery address. Keep it 2-3 sentences. Plain text only.`;

      let privateMessage = '';
      try {
        const dmAiResult = await generateReply({
          config: aiConfig,
          systemPrompt: dmSystemPrompt,
          messages: [{ role: 'user', content: 'Generate private message.' }],
        });
        privateMessage = dmAiResult.text.trim();
      } catch {
        privateMessage = `আসসালামু আলাইকুম! আমাদের পোস্টে কমেন্ট করার জন্য ধন্যবাদ। আপনি কি এই পণ্যটি অর্ডার করতে চান? আপনার পছন্দের সাইজ বা বিস্তারিত জানাতে পারেন, আমরা এখনই কনফার্ম করে দিচ্ছি!`;
      }

      await replyFacebookCommentPrivate({
        accessToken: metaConfig.page_access_token,
        pageId: metaConfig.page_id,
        commentId: params.commentId,
        message: privateMessage,
      });

      privateDmSent = true;

      // Save private reply record
      await db.from('meta_comment_replies').insert({
        account_id: params.accountId,
        comment_id: params.commentId,
        sender_type: 'ai',
        message: privateMessage,
        is_private: true,
      });
    } catch (dmErr: any) {
      console.warn('[ai-comment-reply] Private DM failed:', dmErr?.message || dmErr);
    }
  }

  // 7. Update comment record in database
  await db
    .from('meta_comments')
    .update({
      ai_replied: true,
      ai_reply_text: publicReply,
      ai_private_dm_sent: privateDmSent,
    })
    .eq('account_id', params.accountId)
    .eq('comment_id', params.commentId);

  return { publicReply, privateDmSent };
}
