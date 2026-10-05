import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAccountFollowupSettings } from '@/lib/followup/dispatcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const settings = await getAccountFollowupSettings(supabase, accountId);
    return NextResponse.json({ settings });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();

    const allowedFields = [
      'abandoned_checkout_enabled',
      'abandoned_checkout_delay_minutes',
      'abandoned_checkout_template',
      'advance_payment_enabled',
      'advance_payment_delay_hours',
      'advance_payment_template',
      'bkash_number',
      'store_url',
      'incomplete_chat_enabled',
      'incomplete_chat_delay_hours',
      'max_followup_attempts',
    ];

    const updatePayload: Record<string, any> = {
      account_id: accountId,
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('followup_settings')
      .upsert(updatePayload, { onConflict: 'account_id' })
      .select('*')
      .single();

    if (error) {
      console.error('[followup-settings] upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data, success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
