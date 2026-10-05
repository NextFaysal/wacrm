export type MetaPlatform = 'facebook' | 'instagram';

export interface MetaIntegrationConfig {
  id: string;
  account_id: string;
  page_id?: string | null;
  page_name?: string | null;
  page_access_token?: string | null;
  instagram_account_id?: string | null;
  instagram_username?: string | null;
  ad_account_id?: string | null;
  pixel_id?: string | null;
  capi_access_token?: string | null;
  capi_test_event_code?: string | null;
  capi_enabled?: boolean;
  app_id?: string | null;
  app_secret?: string | null;
  verify_token: string;
  ai_comment_reply_enabled: boolean;
  ai_comment_private_dm_enabled: boolean;
  ai_comment_prompt: string;
  status: 'connected' | 'disconnected';
  created_at: string;
  updated_at: string;
}

export interface MetaComment {
  id: string;
  account_id: string;
  platform: MetaPlatform;
  post_id?: string | null;
  post_url?: string | null;
  post_caption?: string | null;
  comment_id: string;
  parent_comment_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_username?: string | null;
  message: string;
  sentiment?: string;
  is_hidden: boolean;
  is_deleted: boolean;
  ai_replied: boolean;
  ai_reply_text?: string | null;
  ai_private_dm_sent: boolean;
  comment_created_at: string;
  created_at: string;
  replies?: MetaCommentReply[];
}

export interface MetaCommentReply {
  id: string;
  account_id: string;
  comment_id: string;
  sender_type: 'page' | 'ai' | 'user';
  reply_id?: string | null;
  message: string;
  is_private: boolean;
  created_at: string;
}

export interface MetaAdsMetric {
  id: string;
  account_id: string;
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversions: number;
  attributed_revenue: number;
  roas: number;
  date: string;
  created_at: string;
}

export interface MetaWebhookEntry {
  id: string;
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{
        type: string;
        payload: { url: string };
      }>;
      quick_reply?: { payload: string };
    };
    postback?: {
      title: string;
      payload: string;
      mid?: string;
    };
  }>;
  changes?: Array<{
    field: string;
    value: {
      item?: string;
      verb?: 'add' | 'edit' | 'remove' | 'hide' | 'unhide';
      comment_id?: string;
      parent_id?: string;
      post_id?: string;
      created_time?: number;
      message?: string;
      from?: {
        id: string;
        name: string;
      };
      // Instagram comment webhook fields
      id?: string;
      text?: string;
      media?: {
        id: string;
      };
      user?: {
        id: string;
        username: string;
      };
    };
  }>;
}

export interface MetaWebhookPayload {
  object: 'page' | 'instagram' | string;
  entry: MetaWebhookEntry[];
}
