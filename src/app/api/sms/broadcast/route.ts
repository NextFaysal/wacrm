import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { sendSms } from '@/lib/sms/sms-service';

/**
 * GET /api/sms/broadcast
 * Lists past and active SMS marketing campaigns.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data: campaigns, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.warn('[sms-campaigns] list error:', error);
      return NextResponse.json({ campaigns: [] });
    }

    return NextResponse.json({ success: true, campaigns: campaigns || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/sms/broadcast
 * Launches a targeted bulk SMS promotional or flash sale marketing blast.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.campaignName?.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    if (!body?.messageTemplate?.trim()) {
      return NextResponse.json({ error: 'SMS message template is required' }, { status: 400 });
    }

    const {
      campaignName,
      segmentType = 'ALL',
      messageTemplate,
      couponCode = '',
      promoUrl = '',
      manualRecipients = [],
    } = body;

    // 1. Gather target customer list
    let targetList: { phone: string; name: string }[] = [];

    if (Array.isArray(manualRecipients) && manualRecipients.length > 0) {
      targetList = manualRecipients;
    } else {
      // Fetch based on segment
      const { data: orders } = await supabase
        .from('orders')
        .select('customer_phone, customer_name, customer_city, total_amount, status, created_at')
        .eq('account_id', accountId)
        .not('customer_phone', 'is', null);

      const uniqueCustomers = new Map<string, { phone: string; name: string; totalSpend: number; count: number; city: string; lastOrderAt: string | null }>();

      for (const ord of orders || []) {
        const phone = String(ord.customer_phone || '').trim();
        if (!phone || phone.length < 10) continue;

        const amt = Number(ord.total_amount) || 0;
        const isDelivered = ord.status === 'DELIVERED';
        const existing = uniqueCustomers.get(phone);

        if (!existing) {
          uniqueCustomers.set(phone, {
            phone,
            name: ord.customer_name || 'Customer',
            totalSpend: isDelivered ? amt : 0,
            count: 1,
            city: ord.customer_city || '',
            lastOrderAt: ord.created_at,
          });
        } else {
          existing.count += 1;
          if (isDelivered) existing.totalSpend += amt;
          if (ord.created_at && (!existing.lastOrderAt || new Date(ord.created_at) > new Date(existing.lastOrderAt))) {
            existing.lastOrderAt = ord.created_at;
          }
        }
      }

      const all = Array.from(uniqueCustomers.values());
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      switch (segmentType) {
        case 'VIP_SPENDERS':
          targetList = all.filter((c) => c.totalSpend >= 3000);
          break;
        case 'REPEAT_BUYERS':
          targetList = all.filter((c) => c.count >= 2);
          break;
        case 'INACTIVE_30D':
          targetList = all.filter((c) => c.lastOrderAt && new Date(c.lastOrderAt) < thirtyDaysAgo);
          break;
        case 'DHAKA_METRO':
          targetList = all.filter((c) => (c.city || '').toLowerCase().includes('dhaka') || (c.city || '').toLowerCase().includes('ঢাকা'));
          break;
        case 'OUTSIDE_DHAKA':
          targetList = all.filter((c) => {
            const city = (c.city || '').toLowerCase();
            return city.length > 0 && !city.includes('dhaka') && !city.includes('ঢাকা');
          });
          break;
        case 'ABANDONED_LEADS': {
          const { data: abandoned } = await supabase
            .from('abandoned_checkouts')
            .select('customer_phone, customer_name')
            .eq('account_id', accountId)
            .eq('status', 'open')
            .not('customer_phone', 'is', null);

          targetList = (abandoned || []).map((row) => ({
            phone: row.customer_phone,
            name: row.customer_name || 'Customer',
          }));
          break;
        }
        case 'ALL':
        default:
          targetList = all;
          break;
      }
    }

    if (targetList.length === 0) {
      return NextResponse.json({
        error: 'No valid customer recipients found for the selected segment',
      }, { status: 400 });
    }

    // 2. Create campaign record
    const { data: campaign, error: campErr } = await supabase
      .from('sms_campaigns')
      .insert({
        account_id: accountId,
        name: campaignName.trim(),
        segment_type: segmentType,
        message_template: messageTemplate.trim(),
        total_recipients: targetList.length,
        status: 'sending',
      })
      .select('*')
      .single();

    if (campErr) {
      console.warn('[sms-campaigns] create error:', campErr);
    }

    const campaignId = campaign?.id || null;

    // 3. Dispatch SMS in batches to avoid overwhelming gateway limits
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of targetList) {
      const personalized = messageTemplate
        .replace(/{name}/g, recipient.name || 'সম্মানিত গ্রাহক')
        .replace(/{coupon}/g, couponCode || 'SPECIAL10')
        .replace(/{link}/g, promoUrl || 'https://wacrm.live');

      try {
        const res = await sendSms({
          accountId,
          phone: recipient.phone,
          message: personalized,
        });

        if (res.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    // 4. Update campaign status
    if (campaignId) {
      await supabase
        .from('sms_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          status: failedCount === targetList.length ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
    }

    return NextResponse.json({
      success: true,
      campaignId,
      totalRecipients: targetList.length,
      sentCount,
      failedCount,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
