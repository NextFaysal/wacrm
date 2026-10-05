import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyBusinessReport } from '@/lib/ai/growth-intelligence';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const { data: membership } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.account_id) return new NextResponse('Account not found', { status: 400 });

    const [report, overview] = await Promise.all([
      generateDailyBusinessReport(membership.account_id),
      calculateAttributionAndPerformance(membership.account_id),
    ]);

    const { data: settings } = await supabase
      .from('business_settings')
      .select('store_name, logo_url')
      .eq('account_id', membership.account_id)
      .maybeSingle();

    const storeName = settings?.store_name || 'E-Commerce Store';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Growth Intelligence Report - ${report.date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #1e293b; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .table-container { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    th { background: #f1f5f9; padding: 10px 12px; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-left: 4px solid #3b82f6; padding-left: 8px; }
    .rec-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 10px; background: #fff; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e0f2fe; color: #0369a1; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="title">${storeName}</div>
      <div class="subtitle">AI Growth & Marketing Intelligence Executive Report • ${report.date}</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748b;">
      Generated: ${new Date().toLocaleTimeString()}<br>
      Status: Verified True Delivered Sales
    </div>
  </div>

  <div class="kpis">
    <div class="kpi-card">
      <div class="kpi-label">Delivered Revenue</div>
      <div class="kpi-value">৳${overview.totals.totalDeliveredRevenue.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Ad Spend</div>
      <div class="kpi-value">৳${overview.totals.totalSpend.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">True Delivered ROAS</div>
      <div class="kpi-value">${overview.totals.overallTrueROAS}x</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Delivery Completion</div>
      <div class="kpi-value">${overview.totals.deliveryRate}%</div>
    </div>
  </div>

  <div class="table-container">
    <div class="section-title">Multi-Channel Attribution & Platform Reconciliation</div>
    <table>
      <thead>
        <tr>
          <th>Channel</th>
          <th>Ad Spend</th>
          <th>Clicks</th>
          <th>Platform Claims</th>
          <th>Internal Delivered</th>
          <th>Discrepancy (Δ)</th>
          <th>Delivered Revenue</th>
          <th>True ROAS</th>
        </tr>
      </thead>
      <tbody>
        ${overview.channels.map(ch => `
          <tr>
            <td><strong>${ch.channel}</strong></td>
            <td>৳${ch.adSpend.toLocaleString()}</td>
            <td>${ch.clicks.toLocaleString()}</td>
            <td>${ch.platformReportedConversions}</td>
            <td><strong>${ch.internalDeliveredOrders}</strong></td>
            <td>${ch.discrepancy > 0 ? `+${ch.discrepancy} Ghost` : '0'}</td>
            <td>৳${ch.internalDeliveredRevenue.toLocaleString()}</td>
            <td><strong>${ch.trueROAS}x</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section-title">Actionable AI Growth Recommendations</div>
  ${report.recommendations.map(r => `
    <div class="rec-box">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <strong style="color: #0f172a;">${r.problem}</strong>
        <span class="badge">${r.confidence} Confidence</span>
      </div>
      <div style="font-size: 12px; color: #475569; margin-bottom: 4px;"><strong>Evidence:</strong> ${r.evidence}</div>
      <div style="font-size: 12px; color: #1e293b; background: #f8fafc; padding: 6px 8px; border-radius: 4px; margin: 4px 0;">
        <strong>Recommended Action:</strong> ${r.recommendedAction}
      </div>
      <div style="font-size: 11px; color: #64748b;"><strong>Objective:</strong> ${r.expectedObjective}</div>
    </div>
  `).join('')}

  <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
    Confidential Business Report • Generated by WACRM AI E-commerce Growth & Marketing Intelligence Platform
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    return new NextResponse('Error generating report: ' + err.message, { status: 500 });
  }
}
