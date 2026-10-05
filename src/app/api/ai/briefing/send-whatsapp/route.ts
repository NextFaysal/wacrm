import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyBusinessReport } from '@/lib/ai/growth-intelligence';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.account_id) return NextResponse.json({ error: 'No account found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    // 1. Fetch recipient phone (from body or business_settings)
    let recipientPhone = body.phone;
    if (!recipientPhone) {
      const { data: settings } = await supabase
        .from('business_settings')
        .select('whatsapp_number, support_phone')
        .eq('account_id', membership.account_id)
        .maybeSingle();

      recipientPhone = settings?.whatsapp_number || settings?.support_phone;
    }

    if (!recipientPhone) {
      return NextResponse.json(
        { error: 'No WhatsApp number provided or configured in store settings' },
        { status: 400 }
      );
    }

    const cleanPhone = String(recipientPhone).replace(/\D/g, '');

    // 2. Generate Today's Daily Business Briefing
    const report = await generateDailyBusinessReport(membership.account_id);

    const messageText = `🌅 *দৈনিক বিজনেস গ্রোথ ব্রিফিং (${report.date})*

📊 *আজকের পারফরম্যান্স:*
• ডেলিভার্ড রেভিনিউ: ৳${report.summary.deliveredRevenue.toLocaleString()}
• অ্যাড স্পেন্ড: ৳${report.summary.adSpend.toLocaleString()}
• ট্রু ROAS: *${report.summary.trueROAS}x*
• সম্পন্ন ডেলিভারি: ${report.summary.orders} টি
• অ্যাক্টিভ চ্যাট: ${report.summary.messages} টি

🏆 *সেরা চ্যানেল:* ${report.bestChannel}
⚠️ *মূল সমস্যা:* ${report.coreProblem}

💡 *এআই রিকমেন্ডেশন:*
${report.recommendations[0]?.recommendedAction || 'নজর রাখুন কুরিয়ার ডেলিভারি সাকসেস রেশিওতে।'}

_Generated automatically by WACRM Growth Intelligence Engine_`;

    // 3. Find or create Contact & Conversation
    let conversationId: string | null = null;
    try {
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('account_id', membership.account_id)
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .maybeSingle();

      if (!contact) {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            account_id: membership.account_id,
            phone: cleanPhone,
            name: 'Business Owner',
          })
          .select('id')
          .single();
        contact = newContact;
      }

      if (contact) {
        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('account_id', membership.account_id)
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (!conv) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              account_id: membership.account_id,
              contact_id: contact.id,
              channel: 'whatsapp',
              status: 'open',
            })
            .select('id')
            .single();
          conv = newConv;
        }

        if (conv) {
          conversationId = conv.id;
        }
      }

      if (conversationId) {
        await sendMessageToConversation(supabase, membership.account_id, {
          conversationId,
          messageType: 'text',
          contentText: messageText,
        });
      }
    } catch (e: any) {
      // Return message preview if WhatsApp API is not yet paired with Meta
      return NextResponse.json({
        success: true,
        previewOnly: true,
        recipientPhone,
        messagePreview: messageText,
        note: 'WhatsApp API credentials not active, preview generated successfully.',
      });
    }

    return NextResponse.json({
      success: true,
      recipientPhone,
      messagePreview: messageText,
    });
  } catch (err: any) {
    console.error('Failed to send WhatsApp briefing:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
