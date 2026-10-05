import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { replyFacebookComment, replyFacebookCommentPrivate, replyInstagramComment, hideFacebookComment, deleteFacebookComment } from '@/lib/meta/graph-api';
import { processAiCommentReply } from '@/lib/meta/ai-comment-reply';

/**
 * GET /api/meta/comments - List comments with replies
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const platform = searchParams.get('platform'); // 'facebook' | 'instagram' | null
    const status = searchParams.get('status'); // 'unreplied' | 'replied' | 'all'
    const search = searchParams.get('q')?.trim();
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('meta_comments')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_deleted', false)
      .order('comment_created_at', { ascending: false })
      .limit(limit);

    if (platform && (platform === 'facebook' || platform === 'instagram')) {
      query = query.eq('platform', platform);
    }

    if (status === 'unreplied') {
      query = query.eq('ai_replied', false);
    } else if (status === 'replied') {
      query = query.eq('ai_replied', true);
    }

    if (search) {
      query = query.or(`message.ilike.%${search}%,sender_name.ilike.%${search}%`);
    }

    const { data: comments, error } = await query;
    if (error) {
      console.warn('[meta-comments] fetch error:', error);
      return NextResponse.json({ comments: [] });
    }

    // Fetch replies for these comments
    const commentIds = (comments || []).map((c) => c.comment_id);
    let repliesMap: Record<string, any[]> = {};

    if (commentIds.length > 0) {
      const { data: replies } = await supabase
        .from('meta_comment_replies')
        .select('*')
        .eq('account_id', accountId)
        .in('comment_id', commentIds)
        .order('created_at', { ascending: true });

      if (replies) {
        for (const rep of replies) {
          if (!repliesMap[rep.comment_id]) {
            repliesMap[rep.comment_id] = [];
          }
          repliesMap[rep.comment_id].push(rep);
        }
      }
    }

    const populated = (comments || []).map((c) => ({
      ...c,
      replies: repliesMap[c.comment_id] || [],
    }));

    return NextResponse.json({ success: true, comments: populated });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/meta/comments - Send manual comment reply or private DM
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.comment_id || !body?.message?.trim()) {
      return NextResponse.json({ error: 'comment_id and message are required' }, { status: 400 });
    }

    // 1. Get Meta Config for Page Token
    const { data: metaConfig } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (!metaConfig?.page_access_token) {
      return NextResponse.json({ error: 'Meta Page Access Token not configured' }, { status: 400 });
    }

    const isPrivate = !!body.is_private;
    const platform = body.platform || 'facebook';

    if (isPrivate) {
      if (platform !== 'facebook') {
        return NextResponse.json({ error: 'Private DM reply is only supported for Facebook comments' }, { status: 400 });
      }
      if (!metaConfig.page_id) {
        return NextResponse.json({ error: 'Page ID not configured for private DM' }, { status: 400 });
      }

      await replyFacebookCommentPrivate({
        accessToken: metaConfig.page_access_token,
        pageId: metaConfig.page_id,
        commentId: body.comment_id,
        message: body.message.trim(),
      });
    } else {
      if (platform === 'facebook') {
        await replyFacebookComment({
          accessToken: metaConfig.page_access_token,
          commentId: body.comment_id,
          message: body.message.trim(),
        });
      } else {
        await replyInstagramComment({
          accessToken: metaConfig.page_access_token,
          commentId: body.comment_id,
          message: body.message.trim(),
        });
      }
    }

    // Save reply record
    const { data: savedReply } = await supabase
      .from('meta_comment_replies')
      .insert({
        account_id: accountId,
        comment_id: body.comment_id,
        sender_type: 'user',
        message: body.message.trim(),
        is_private: isPrivate,
      })
      .select()
      .single();

    // Mark comment as replied
    await supabase
      .from('meta_comments')
      .update({
        ai_replied: true,
        ai_reply_text: body.message.trim(),
      })
      .eq('account_id', accountId)
      .eq('comment_id', body.comment_id);

    return NextResponse.json({ success: true, reply: savedReply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/meta/comments - Hide or unhide comment
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.comment_id) {
      return NextResponse.json({ error: 'comment_id required' }, { status: 400 });
    }

    const { data: metaConfig } = await supabase
      .from('meta_integrations')
      .select('page_access_token')
      .eq('account_id', accountId)
      .single();

    if (metaConfig?.page_access_token) {
      try {
        await hideFacebookComment({
          accessToken: metaConfig.page_access_token,
          commentId: body.comment_id,
          isHidden: !!body.is_hidden,
        });
      } catch (err) {
        console.warn('[meta-comments] graph api hide warning:', err);
      }
    }

    await supabase
      .from('meta_comments')
      .update({ is_hidden: !!body.is_hidden })
      .eq('account_id', accountId)
      .eq('comment_id', body.comment_id);

    return NextResponse.json({ success: true, is_hidden: !!body.is_hidden });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/meta/comments - Delete comment
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');

    if (!commentId) {
      return NextResponse.json({ error: 'comment_id required' }, { status: 400 });
    }

    const { data: metaConfig } = await supabase
      .from('meta_integrations')
      .select('page_access_token')
      .eq('account_id', accountId)
      .single();

    if (metaConfig?.page_access_token) {
      try {
        await deleteFacebookComment({
          accessToken: metaConfig.page_access_token,
          commentId,
        });
      } catch (err) {
        console.warn('[meta-comments] graph api delete warning:', err);
      }
    }

    await supabase
      .from('meta_comments')
      .update({ is_deleted: true })
      .eq('account_id', accountId)
      .eq('comment_id', commentId);

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PUT /api/meta/comments - Trigger AI reply on demand
 */
export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.comment_id) {
      return NextResponse.json({ error: 'comment_id required' }, { status: 400 });
    }

    const { data: comment } = await supabase
      .from('meta_comments')
      .select('*')
      .eq('account_id', accountId)
      .eq('comment_id', body.comment_id)
      .single();

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const result = await processAiCommentReply({
      accountId,
      platform: comment.platform,
      commentId: comment.comment_id,
      postCaption: comment.post_caption,
      senderName: comment.sender_name,
      message: comment.message,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
