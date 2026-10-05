const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export interface SendMessageResult {
  recipient_id: string;
  message_id: string;
}

/**
 * Send Facebook Messenger or Instagram message
 */
export async function sendMetaMessage(params: {
  accessToken: string;
  recipientId: string;
  messageText: string;
}): Promise<SendMessageResult> {
  const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      message: { text: params.messageText },
      messaging_type: 'RESPONSE',
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Meta Send Message failed with status ${res.status}`);
  }
  return data;
}

export interface MetaButton {
  type: 'postback' | 'web_url';
  title: string;
  url?: string;
  payload?: string;
}

export interface MetaTemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action?: {
    type: 'web_url';
    url: string;
  };
  buttons?: MetaButton[];
}

/**
 * Send Facebook Messenger Generic Template (Rich Product Cards / Carousel)
 */
export async function sendMetaGenericTemplate(params: {
  accessToken: string;
  recipientId: string;
  elements: MetaTemplateElement[];
}): Promise<SendMessageResult> {
  const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: params.elements,
          },
        },
      },
      messaging_type: 'RESPONSE',
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Meta Template Send failed: ${res.status}`);
  }
  return data;
}

/**
 * Send Messenger Quick Replies (e.g. "Order COD", "Talk to Agent")
 */
export async function sendMetaQuickReplies(params: {
  accessToken: string;
  recipientId: string;
  messageText: string;
  quickReplies: Array<{ title: string; payload: string }>;
}): Promise<SendMessageResult> {
  const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      message: {
        text: params.messageText,
        quick_replies: params.quickReplies.map((qr) => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      },
      messaging_type: 'RESPONSE',
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Meta Quick Replies Send failed: ${res.status}`);
  }
  return data;
}

/**
 * Post a public reply to a Facebook Post Comment
 */
export async function replyFacebookComment(params: {
  accessToken: string;
  commentId: string;
  message: string;
}): Promise<{ id: string }> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}/comments?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Reply to Facebook comment failed with status ${res.status}`);
  }
  return data;
}

/**
 * Send a Private Message (DM) to a Facebook Commenter
 */
export async function replyFacebookCommentPrivate(params: {
  accessToken: string;
  pageId: string;
  commentId: string;
  message: string;
}): Promise<SendMessageResult> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.pageId)}/messages?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: params.commentId },
      message: { text: params.message },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Private reply to Facebook comment failed: ${res.status}`);
  }
  return data;
}

/**
 * Post a reply to an Instagram Post / Reel Comment
 */
export async function replyInstagramComment(params: {
  accessToken: string;
  commentId: string;
  message: string;
}): Promise<{ id: string }> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}/replies?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Reply to Instagram comment failed: ${res.status}`);
  }
  return data;
}

/**
 * Hide / Unhide a Facebook comment
 */
export async function hideFacebookComment(params: {
  accessToken: string;
  commentId: string;
  isHidden: boolean;
}): Promise<{ success: boolean }> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}?is_hidden=${params.isHidden}&access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Hide comment failed: ${res.status}`);
  }
  return { success: true };
}

/**
 * Delete a Facebook comment
 */
export async function deleteFacebookComment(params: {
  accessToken: string;
  commentId: string;
}): Promise<{ success: boolean }> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.commentId)}?access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Delete comment failed: ${res.status}`);
  }
  return { success: true };
}

/**
 * Fetch Meta Ad Account Insights (Spend, Impressions, Clicks, CPC, CPM, Conversions)
 */
export interface AdInsightItem {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  date_start: string;
  date_stop: string;
  actions?: Array<{ action_type: string; value: string }>;
}

export async function fetchMetaAdInsights(params: {
  accessToken: string;
  adAccountId: string;
  datePreset?: string; // 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'maximum'
}): Promise<AdInsightItem[]> {
  const accountId = params.adAccountId.replace(/^act_/, '');
  const preset = params.datePreset || 'last_30d';

  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'spend',
    'impressions',
    'clicks',
    'cpc',
    'cpm',
    'ctr',
    'actions',
    'date_start',
    'date_stop',
  ].join(',');

  const url = `${META_GRAPH_BASE}/act_${encodeURIComponent(accountId)}/insights?level=campaign&fields=${fields}&date_preset=${preset}&access_token=${encodeURIComponent(params.accessToken)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Failed to fetch Meta ad insights: ${res.status}`);
  }

  return (data.data || []) as AdInsightItem[];
}
