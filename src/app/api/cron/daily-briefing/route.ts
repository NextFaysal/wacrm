import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { incrementPlanUsage } from '@/lib/billing/plan-guard';

export const maxDuration = 120;

export async function GET(request: Request) {
  return handleDailyBriefingCron(request);
}

export async function POST(request: Request) {
  return handleDailyBriefingCron(request);
}

async function handleDailyBriefingCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();

  // Fetch accounts that have whatsapp briefings enabled
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id, name, plan_tier, plan_whatsapp_briefing_enabled')
    .or('plan_whatsapp_briefing_enabled.is.null,plan_whatsapp_briefing_enabled.eq.true');

  if (error || !accounts) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  const results = {
    accountsProcessed: accounts.length,
    briefingsSent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  for (const acc of accounts) {
    try {
      // 1. Check account owner phone or whatsapp config
      const { data: ownerMembership } = await db
        .from('account_members')
        .select('user_id, profiles(phone, full_name)')
        .eq('account_id', acc.id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      const ownerPhone = (ownerMembership as any)?.profiles?.phone;

      // 2. Fetch attribution overview for the account
      const attribution = await calculateAttributionAndPerformance(acc.id);
      const totals = attribution.totals;

      // 3. Format Bengali/English Executive Morning Briefing
      const messageText = `🌅 *দৈনিক ব্যবসায়িক ব্রিফিং (Daily Growth Briefing)*\n` +
        `📅 তারিখ: ${todayStr}\n` +
        `🏢 প্রতিষ্ঠান: *${acc.name || 'Store'}*\n\n` +
        `📊 *গতকালকের মূল ফলাফল (Delivered vs Spend):*\n` +
        `• প্রকৃত ডেলিভার্ড আয়: ৳${totals.totalDeliveredRevenue.toLocaleString()}\n` +
        `• মোট বিজ্ঞাপন খরচ: ৳${totals.totalSpend.toLocaleString()}\n` +
        `• রিয়েল ক্যাশ ROAS: *${totals.overallTrueROAS}x*\n` +
        `• সফল ডেলিভারি রেট: *${totals.deliveryRate}%* (${totals.totalDeliveredOrders}/${totals.totalOrders} অর্ডার)\n` +
        `• প্রতি ডেলিভার্ড গ্রাহক অর্জন খরচ (CAC): ৳${totals.overallTrueCAC.toLocaleString()}\n\n` +
        `🚀 *AI রিকমেন্ডেশন:*\n` +
        (totals.overallTrueROAS >= 3.5
          ? `✅ আপনার অ্যাডস দারুন পারফর্ম করছে! সফল ক্যাম্পেইনে বাজেট ১০-১৫% বাড়াতে পারেন।`
          : `⚠️ ডেলিভারি ও অ্যাড পারফরম্যান্সে নজর দিন। অপচয় কমাতে আন-পারফর্মিং অ্যাড বন্ধ রাখুন।`) +
        `\n\n_AI E-commerce Growth & Marketing Intelligence Engine_`;

      // 4. If owner phone exists, find/create conversation and send
      if (ownerPhone) {
        let cleanPhone = ownerPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('01')) cleanPhone = '880' + cleanPhone.slice(1);

        let { data: contact } = await db
          .from('contacts')
          .select('id')
          .eq('account_id', acc.id)
          .ilike('phone', `%${cleanPhone.slice(-10)}%`)
          .maybeSingle();

        if (!contact) {
          const { data: newContact } = await db
            .from('contacts')
            .insert({
              account_id: acc.id,
              name: (ownerMembership as any)?.profiles?.full_name || 'Store Owner',
              phone: cleanPhone,
            })
            .select('id')
            .single();
          contact = newContact;
        }

        if (contact) {
          let { data: conv } = await db
            .from('conversations')
            .select('id')
            .eq('account_id', acc.id)
            .eq('contact_id', contact.id)
            .maybeSingle();

          if (!conv) {
            const { data: newConv } = await db
              .from('conversations')
              .insert({
                account_id: acc.id,
                contact_id: contact.id,
                status: 'open',
              })
              .select('id')
              .single();
            conv = newConv;
          }

          if (conv) {
            await sendMessageToConversation(db, acc.id, {
              conversationId: conv.id,
              messageType: 'text',
              contentText: messageText,
            });
            results.briefingsSent++;
            void incrementPlanUsage(db, acc.id, 'briefings');
          }
        }
      } else {
        results.skipped++;
      }

      // Record daily report into ai_business_reports
      await db.from('ai_business_reports').insert({
        account_id: acc.id,
        report_type: 'daily',
        period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        executive_summary: messageText,
        metrics_snapshot: totals,
      });

    } catch (accErr: any) {
      results.errors.push(`Account ${acc.id}: ${accErr.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
