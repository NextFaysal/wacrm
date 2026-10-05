import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CustomReportFilter {
  startDate?: string;
  endDate?: string;
  channel?: string; // meta, google, tiktok, organic, all
  status?: string; // delivered, pending, all
}

export interface CustomReportRow {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  channel: string;
  total: number;
  status: string;
  deliveryStatus: string;
  city: string;
}

export async function generateCustomReport(
  accountId: string,
  filter: CustomReportFilter
): Promise<{ rows: CustomReportRow[]; summary: { totalOrders: number; totalRevenue: number } }> {
  let query = supabase
    .from('orders')
    .select('id, order_number, total, status, delivery_status, customer_name, customer_phone, city, division, created_at, order_attributions(last_touch_channel)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (filter.startDate) query = query.gte('created_at', `${filter.startDate}T00:00:00Z`);
  if (filter.endDate) query = query.lte('created_at', `${filter.endDate}T23:59:59Z`);
  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'delivered') {
      query = query.eq('delivery_status', 'delivered');
    } else {
      query = query.eq('status', filter.status);
    }
  }

  const { data: orders } = await query.limit(500);

  let totalRev = 0;
  const rows: CustomReportRow[] = (orders || []).map((o: any) => {
    const rev = Number(o.total || 0);
    totalRev += rev;
    const chan = o.order_attributions?.[0]?.last_touch_channel || 'direct';

    return {
      orderNumber: o.order_number || o.id.slice(0, 8),
      createdAt: new Date(o.created_at).toLocaleDateString(),
      customerName: o.customer_name || 'Customer',
      customerPhone: o.customer_phone || '',
      channel: chan.toUpperCase(),
      total: rev,
      status: o.status,
      deliveryStatus: o.delivery_status || 'pending',
      city: o.city || o.division || 'Dhaka',
    };
  });

  return {
    rows,
    summary: {
      totalOrders: rows.length,
      totalRevenue: totalRev,
    },
  };
}

export function formatReportAsCSV(rows: CustomReportRow[]): string {
  const headers = ['Order #', 'Date', 'Customer Name', 'Phone', 'Channel', 'Total (BDT)', 'Status', 'Delivery', 'City'];
  const csvLines = [headers.join(',')];

  rows.forEach((r) => {
    const escapedName = `"${r.customerName.replace(/"/g, '""')}"`;
    const escapedPhone = `"${r.customerPhone.replace(/"/g, '""')}"`;
    csvLines.push([
      r.orderNumber,
      r.createdAt,
      escapedName,
      escapedPhone,
      r.channel,
      r.total,
      r.status,
      r.deliveryStatus,
      `"${r.city}"`,
    ].join(','));
  });

  return csvLines.join('\n');
}
