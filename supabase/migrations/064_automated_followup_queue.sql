-- ============================================================
-- 064_automated_followup_queue.sql
--
-- Adds:
-- 1. followup_settings table (customizable triggers, delay timings & templates)
-- 2. Columns on abandoned_checkouts (followup_count, last_followup_at)
-- 3. Columns on orders (advance_reminder_count, last_advance_reminder_at)
-- 4. followup_logs table (real-time audit & delivery tracking)
-- ============================================================

-- 1. Followup Settings
CREATE TABLE IF NOT EXISTS followup_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  abandoned_checkout_enabled BOOLEAN DEFAULT true,
  abandoned_checkout_delay_minutes INT DEFAULT 45,
  abandoned_checkout_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনি আমাদের {{store_name}} থেকে "{{product_name}}" পণ্যটি অর্ডার করার চেষ্টা করছিলেন কিন্তু অর্ডারটি সম্পন্ন হয়নি।\n\nআপনি কি অর্ডারটি কনফার্ম করতে চান? যেকোনো সাহায্য বা ডিসকাউন্টের জন্য এই মেসেজের রিপ্লাই দিন অথবা সরাসরি এই লিংকে গিয়ে সম্পূর্ণ করুন:\n{{checkout_url}}\n\nধন্যবাদ সাথে থাকার জন্য! 🛍️',
  advance_payment_enabled BOOLEAN DEFAULT true,
  advance_payment_delay_hours INT DEFAULT 2,
  advance_payment_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনার অর্ডার (#{{order_id}}) টি কনফার্মেশনের অপেক্ষায় রয়েছে। ফেক অর্ডার প্রতিরোধের সুবিধার্থে ডেলিভারি চার্জ বাবদ ৳{{advance_amount}} টাকা অগ্রিম প্রযোজ্য।\n\nদয়া করে আমাদের bKash/Nagad নম্বরে ({{bkash_number}}) টাকা পাঠিয়ে ট্রানজেকশন আইডি বা স্ক্রিনশট পাঠিয়ে দিন। টাকা পাওয়ার সাথে সাথেই পার্সেল কুরিয়ারে বুক হয়ে যাবে! 🚀',
  bkash_number TEXT DEFAULT NULL,
  store_url TEXT DEFAULT NULL,
  incomplete_chat_enabled BOOLEAN DEFAULT true,
  incomplete_chat_delay_hours INT DEFAULT 2,
  max_followup_attempts INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE followup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage followup settings" ON followup_settings;
CREATE POLICY "Account members can manage followup settings" ON followup_settings
  FOR ALL USING (is_account_member(account_id));

-- 2. Columns on abandoned_checkouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abandoned_checkouts' AND column_name = 'followup_count'
  ) THEN
    ALTER TABLE abandoned_checkouts ADD COLUMN followup_count INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abandoned_checkouts' AND column_name = 'last_followup_at'
  ) THEN
    ALTER TABLE abandoned_checkouts ADD COLUMN last_followup_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 3. Columns on orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'advance_reminder_count'
  ) THEN
    ALTER TABLE orders ADD COLUMN advance_reminder_count INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'last_advance_reminder_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN last_advance_reminder_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 4. Followup Queue Logs Table
CREATE TABLE IF NOT EXISTS followup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ABANDONED_CHECKOUT', 'ADVANCE_PAYMENT', 'INCOMPLETE_CHAT')),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  reference_id TEXT,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'SKIPPED', 'FAILED')),
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_logs_account ON followup_logs(account_id, created_at DESC);

ALTER TABLE followup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can read followup logs" ON followup_logs;
CREATE POLICY "Account members can read followup logs" ON followup_logs
  FOR SELECT USING (is_account_member(account_id));
