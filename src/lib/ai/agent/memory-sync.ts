import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationMemory } from '@/types/commerce';

/**
 * Sync conversation conclusions to the contact's persistent profile.
 * Non-blocking — wrapped in try/catch to never crash user flow.
 */
export async function syncMemoryToContact(
  db: SupabaseClient,
  contactId: string,
  memory: ConversationMemory,
  accountId: string
): Promise<void> {
  if (!contactId || !accountId) return;

  try {
    const { data: contact } = await db
      .from('contacts')
      .select('id, preferred_area, ai_notes')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!contact) return;

    const updates: Record<string, any> = {};

    // 1. Update preferred area/city
    const district = memory.district || memory.full_address;
    if (district && !contact.preferred_area) {
      updates.preferred_area = memory.district || (memory.district?.includes('ঢাকা') ? 'ঢাকা' : 'ঢাকার বাইরে');
    }

    // 2. Build concise conversation summary note
    const notes: string[] = [];
    if (memory.interested_product_name) {
      notes.push(`পণ্য পছন্দ: ${memory.interested_product_name}`);
    }
    if (memory.selected_variant) {
      notes.push(`ভেরিয়েন্ট: ${memory.selected_variant}`);
    }
    if (memory.order_id) {
      notes.push(`অর্ডার আইডি: ${memory.order_id}`);
    } else if (memory.last_customer_intent) {
      notes.push(`আগ্রহ/অবস্থা: ${memory.last_customer_intent}`);
    }

    if (notes.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const newEntry = `[${today}] ${notes.join(' | ')}`;
      const existing = (contact.ai_notes || '').trim();
      const combined = existing ? `${existing}\n${newEntry}` : newEntry;
      // Keep within 2000 chars
      updates.ai_notes = combined.slice(-2000);
    }

    if (Object.keys(updates).length > 0) {
      await db
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .eq('account_id', accountId);
    }
  } catch (err) {
    console.warn('[syncMemoryToContact] Error updating contact profile:', err);
  }
}
