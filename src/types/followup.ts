export interface FollowupSettings {
  account_id: string;
  abandoned_checkout_enabled: boolean;
  abandoned_checkout_delay_minutes: number;
  abandoned_checkout_template: string;
  advance_payment_enabled: boolean;
  advance_payment_delay_hours: number;
  advance_payment_template: string;
  bkash_number?: string | null;
  store_url?: string | null;
  incomplete_chat_enabled: boolean;
  incomplete_chat_delay_hours: number;
  max_followup_attempts: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_FOLLOWUP_SETTINGS: Omit<FollowupSettings, 'account_id'> = {
  abandoned_checkout_enabled: true,
  abandoned_checkout_delay_minutes: 45,
  abandoned_checkout_template:
    'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনি আমাদের {{store_name}} থেকে "{{product_name}}" পণ্যটি অর্ডার করার চেষ্টা করছিলেন কিন্তু অর্ডারটি সম্পন্ন হয়নি।\n\nআপনি কি অর্ডারটি কনফার্ম করতে চান? যেকোনো সাহায্য বা তথ্যের জন্য এই মেসেজের রিপ্লাই দিন অথবা সরাসরি এই লিংকে গিয়ে সম্পূর্ণ করুন:\n{{checkout_url}}\n\nধন্যবাদ সাথে থাকার জন্য! 🛍️',
  advance_payment_enabled: true,
  advance_payment_delay_hours: 2,
  advance_payment_template:
    'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনার অর্ডার (#{{order_id}}) টি কনফার্মেশনের অপেক্ষায় রয়েছে। ফেক অর্ডার প্রতিরোধের সুবিধার্থে ডেলিভারি চার্জ বাবদ ৳{{advance_amount}} টাকা অগ্রিম প্রযোজ্য।\n\nদয়া করে আমাদের bKash/Nagad নম্বরে ({{bkash_number}}) টাকা পাঠিয়ে ট্রানজেকশন আইডি বা স্ক্রিনশট পাঠিয়ে দিন। টাকা পাওয়ার সাথে সাথেই পার্সেল কুরিয়ারে বুক হয়ে যাবে! 🚀',
  bkash_number: null,
  store_url: null,
  incomplete_chat_enabled: true,
  incomplete_chat_delay_hours: 2,
  max_followup_attempts: 2,
};

export interface FollowupLog {
  id: string;
  account_id: string;
  trigger_type: 'ABANDONED_CHECKOUT' | 'ADVANCE_PAYMENT' | 'INCOMPLETE_CHAT';
  recipient_phone: string;
  recipient_name: string | null;
  reference_id: string | null;
  message_text: string;
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  error_reason: string | null;
  created_at: string;
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: {
    abandonedCheckoutSent: number;
    advancePaymentSent: number;
    incompleteChatSent: number;
  };
}
