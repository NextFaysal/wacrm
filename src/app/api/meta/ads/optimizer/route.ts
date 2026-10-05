import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { evaluateAdRules } from '@/lib/meta/ad-optimizer';

/**
 * GET /api/meta/ads/optimizer - Fetch current ad rules & status
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    let { data: rules } = await supabase
      .from('meta_ad_rules')
      .select('*')
      .eq('account_id', accountId);

    if (!rules || rules.length === 0) {
      const defaultRule = {
        account_id: accountId,
        rule_name: 'AI Stop-Loss Guard (Zero Conversion / Low ROAS)',
        rule_type: 'stop_loss',
        is_active: true,
        max_spend_threshold: 15.00,
        min_roas_threshold: 1.00,
        action: 'pause_campaign',
      };
      const { data: created } = await supabase
        .from('meta_ad_rules')
        .insert(defaultRule)
        .select()
        .single();
      rules = created ? [created] : [];
    }

    return NextResponse.json({ success: true, rules: rules || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/meta/ads/optimizer - Evaluate rules now or update configuration
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => ({}));

    // If action is evaluate
    if (body.action === 'evaluate') {
      const result = await evaluateAdRules(accountId);
      return NextResponse.json({ success: true, result });
    }

    // Otherwise update rule settings
    if (body.rule_id) {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof body.is_active === 'boolean') updateData.is_active = body.is_active;
      if (body.max_spend_threshold !== undefined) updateData.max_spend_threshold = Number(body.max_spend_threshold);
      if (body.min_roas_threshold !== undefined) updateData.min_roas_threshold = Number(body.min_roas_threshold);

      const { data: updated, error } = await supabase
        .from('meta_ad_rules')
        .update(updateData)
        .eq('id', body.rule_id)
        .eq('account_id', accountId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, rule: updated });
    }

    return NextResponse.json({ error: 'Invalid action or rule_id' }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
