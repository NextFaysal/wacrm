'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '@/types/commerce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ShoppingBag,
  Search,
  Truck,
  ExternalLink,
  ShieldAlert,
  MessageSquare,
  RefreshCw,
  Package,
  CircleDollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Printer,
  CreditCard,
  Download,
  CheckSquare,
  Square,
  PhoneCall,
  Plus,
  Edit3,
  Eye,
  AlertTriangle,
  RotateCcw,
  Barcode,
  Filter,
  ChevronDown,
  X,
  Zap,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { PrintableInvoiceDialog } from '@/components/orders/printable-invoice-dialog';
import { BulkPrintableInvoicesDialog } from '@/components/orders/bulk-printable-invoices-dialog';
import { AdvancePaymentDialog } from '@/components/orders/advance-payment-dialog';
import { AbandonedLeadsDialog } from '@/components/orders/abandoned-leads-dialog';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';
import { EditOrderDialog } from '@/components/orders/edit-order-dialog';
import { OrderDetailsSheet } from '@/components/orders/order-details-sheet';
import { ReturnReconciliationModal } from '@/components/orders/return-reconciliation-modal';
import { BarcodeScannerModal } from '@/components/orders/barcode-scanner-modal';
import { CallVerificationModal } from '@/components/orders/call-verification-modal';
import { CustomerJourneyModal } from '@/components/growth/customer-journey-modal';

const STATUS_FILTERS = [
  { id: 'all', label: 'All', color: '' },
  { id: 'NEW', label: 'New', color: 'text-slate-600' },
  { id: 'CONFIRMED', label: 'Confirmed', color: 'text-blue-600' },
  { id: 'COURIER_BOOKED', label: 'In Courier', color: 'text-amber-600' },
  { id: 'DELIVERED', label: 'Delivered', color: 'text-emerald-600' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'text-red-600' },
  { id: 'RETURNED', label: 'Returned', color: 'text-orange-600' },
];

const RISK_FILTERS = [
  { id: 'all', label: 'All Risk' },
  { id: 'LOW', label: '✅ Low Risk' },
  { id: 'MEDIUM', label: '⚠️ Medium Risk' },
  { id: 'HIGH', label: '🚨 High Risk' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'This Month' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    PROCESSING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    COURIER_BOOKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    SHIPPED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    RETURNED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function RiskBadge({ level }: { level?: string }) {
  if (!level || level === 'LOW') return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
      ✓ Safe
    </span>
  );
  if (level === 'MEDIUM') return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
      ⚠ Medium
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
      🚨 High
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [isBulkStatusUpdating, setIsBulkStatusUpdating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Selection for bulk operations
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Booking & Action modal states
  const [bookingOrder, setBookingOrder] = useState<Order | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'steadfast' | 'pathao' | 'auto'>('auto');
  const [isBooking, setIsBooking] = useState(false);
  const [isBulkBooking, setIsBulkBooking] = useState(false);

  // Dialogs
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [bulkInvoicesOpen, setBulkInvoicesOpen] = useState(false);
  const [advanceOrder, setAdvanceOrder] = useState<Order | null>(null);
  const [abandonedOpen, setAbandonedOpen] = useState(false);
  const [returnScannerOpen, setReturnScannerOpen] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [verifyCallOrder, setVerifyCallOrder] = useState<Order | null>(null);
  const [journeyModalOpen, setJourneyModalOpen] = useState(false);
  const [journeyContactPhone, setJourneyContactPhone] = useState<string | null>(null);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings/business')
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) setBusiness(d.settings);
      })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      } else {
        toast.error(data.error || 'Failed to load orders');
      }
    } catch {
      toast.error('Network error loading orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleBookCourier = async (orderId: string) => {
    try {
      setIsBooking(true);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          action: 'book_courier',
          provider: selectedProvider,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Parcel booked successfully with ${data.courier.provider}!`);
        setBookingOrder(null);
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to book parcel with courier');
      }
    } catch {
      toast.error('Error dispatching courier');
    } finally {
      setIsBooking(false);
    }
  };

  const handleBulkBookCourier = async (provider: 'steadfast' | 'pathao') => {
    const toBook = orders.filter(
      (o) => selectedOrderIds.includes(o.id) && !o.courier_tracking_code && o.status !== 'CANCELLED'
    );
    if (toBook.length === 0) {
      toast.error('No unbooked orders selected');
      return;
    }

    try {
      setIsBulkBooking(true);
      let successCount = 0;
      for (const ord of toBook) {
        const res = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ord.id,
            action: 'book_courier',
            provider,
          }),
        });
        if (res.ok) successCount++;
      }
      toast.success(`Dispatched ${successCount} orders to ${provider.toUpperCase()}!`);
      setSelectedOrderIds([]);
      fetchOrders();
    } catch {
      toast.error('Bulk courier booking encountered an issue');
    } finally {
      setIsBulkBooking(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
        if (status === 'CANCELLED' || status === 'RETURNED') {
          toast.success(`Order marked as ${status} & stock restored to inventory!`);
        } else {
          toast.success(`Order status updated to ${status}`);
        }
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('Network error updating status');
    }
  };

  const handleApproveHighRisk = async (order: Order) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          risk_level: 'MEDIUM',
          notes: `${order.notes || ''} [Manually approved by agent on ${new Date().toLocaleDateString()}]`,
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, risk_level: 'MEDIUM' } : o))
        );
        toast.success('High-risk order approved. Ready for dispatch.');
      } else {
        toast.error('Failed to approve order');
      }
    } catch {
      toast.error('Error updating order');
    }
  };

  const handleSyncCourier = async (orderId: string) => {
    try {
      setSyncingOrderId(orderId);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          action: 'sync_courier',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Courier status synced: ${data.tracking?.status?.toUpperCase()} (${data.tracking?.statusBangla || 'Updated'})`
        );
        if (data.order) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        }
      } else {
        toast.error(data.error || 'Failed to sync courier tracking');
      }
    } catch {
      toast.error('Network error during courier sync');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    try {
      setIsBulkStatusUpdating(true);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrderIds[0],
          action: 'bulk_status',
          order_ids: selectedOrderIds,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Updated ${data.count} orders to ${newStatus}!`);
        setSelectedOrderIds([]);
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to update orders in bulk');
      }
    } catch {
      toast.error('Error updating status in bulk');
    } finally {
      setIsBulkStatusUpdating(false);
    }
  };

  // CSV Export
  const exportOrdersToCsv = (ordersToExport: Order[]) => {
    const headers = [
      'Invoice No', 'Date', 'Customer Name', 'Customer Phone', 'Delivery Address',
      'Thana', 'District', 'Product Name', 'Variant', 'Quantity', 'Unit Price',
      'Delivery Charge', 'Total Amount', 'Advance Paid', 'Advance Method',
      'Advance TrxID', 'COD Due', 'Order Status', 'Risk Level', 'Courier Provider', 'Tracking Code',
    ];

    const rows = ordersToExport.map((o) => {
      const total = Number(o.total_amount) || 0;
      const adv = Number(o.advance_paid) || 0;
      const cod = Math.max(0, total - adv);
      return [
        `"${o.invoice_no || o.id.slice(0, 8)}"`,
        `"${o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd HH:mm') : ''}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${o.customer_phone || ''}"`,
        `"${(o.customer_address || '').replace(/"/g, '""')}"`,
        `"${(o.thana || '').replace(/"/g, '""')}"`,
        `"${(o.district || '').replace(/"/g, '""')}"`,
        `"${(o.product_name || '').replace(/"/g, '""')}"`,
        `"${(o.variant || 'Standard').replace(/"/g, '""')}"`,
        o.quantity || 1, o.unit_price || 0, o.delivery_charge || 0,
        total, adv, `"${o.advance_method || ''}"`, `"${o.advance_trx_id || ''}"`,
        cod, `"${o.status}"`, `"${o.risk_level || 'LOW'}"`,
        `"${o.courier_provider || ''}"`, `"${o.courier_tracking_code || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${ordersToExport.length} orders to CSV!`);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        search === '' ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_phone.includes(search) ||
        o.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.invoice_no && o.invoice_no.toLowerCase().includes(search.toLowerCase())) ||
        (o.courier_tracking_code && o.courier_tracking_code.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesRisk = riskFilter === 'all' || o.risk_level === riskFilter;

      let matchesDate = true;
      if (dateFilter !== 'all' && o.created_at) {
        const orderDate = new Date(o.created_at);
        if (dateFilter === 'today') matchesDate = isToday(orderDate);
        else if (dateFilter === 'yesterday') matchesDate = isYesterday(orderDate);
        else if (dateFilter === '7days') matchesDate = isAfter(orderDate, subDays(new Date(), 7));
        else if (dateFilter === '30days') matchesDate = isAfter(orderDate, subDays(new Date(), 30));
      }

      return matchesSearch && matchesStatus && matchesRisk && matchesDate;
    });
  }, [orders, search, statusFilter, riskFilter, dateFilter]);

  const allFilteredSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelectedOrderIds([]);
    else setSelectedOrderIds(filteredOrders.map((o) => o.id));
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Stats
  const totalOrders = orders.length;
  const confirmedCount = orders.filter((o) => o.status === 'CONFIRMED').length;
  const courierBookedCount = orders.filter((o) => o.status === 'COURIER_BOOKED').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const highRiskCount = orders.filter((o) => o.risk_level === 'HIGH').length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'RETURNED')
    .reduce((acc, o) => acc + (o.total_amount || 0), 0);

  const hasActiveFilters = statusFilter !== 'all' || riskFilter !== 'all' || dateFilter !== 'all' || search !== '';

  return (
    <div className="flex-1 space-y-4 sm:space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Orders</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShoppingBag className="h-3 w-3" /> {totalOrders} orders
            </span>
            {highRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 animate-pulse">
                🚨 {highRiskCount} high risk
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time orders via WhatsApp AI & checkout — with fraud detection, courier dispatch & invoice printing.
          </p>
        </div>

        {/* Action Buttons — scrollable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> নতুন অর্ডার
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setBarcodeScannerOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0 border-primary/40 text-primary hover:bg-primary/5 font-semibold"
          >
            <Zap className="h-3.5 w-3.5" /> Express
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => {
              const pendingCall = orders.find(
                (o) => !o.call_status || o.call_status === 'uncalled' || o.call_status === 'called_no_answer'
              );
              if (pendingCall) setVerifyCallOrder(pendingCall);
              else toast.info('কোনো পেন্ডিং আনকল্ড অর্ডার নেই!');
            }}
            className="h-8 text-xs gap-1.5 shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Call Center
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setAbandonedOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Abandoned
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setReturnScannerOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0 border-rose-400/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Returns
          </Button>
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0 border-violet-400/40 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30">
              <TrendingUp className="h-3.5 w-3.5" /> Analytics
            </Button>
          </Link>
          <Button
            variant="outline" size="sm"
            onClick={() => exportOrdersToCsv(filteredOrders)}
            disabled={filteredOrders.length === 0}
            className="h-8 text-xs gap-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="h-8 w-8 p-0 shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total Orders', value: totalOrders, sub: 'All time', color: 'text-foreground', icon: ShoppingBag, iconBg: 'bg-primary/10 text-primary' },
          { label: 'Confirmed', value: confirmedCount, sub: 'Ready to ship', color: 'text-blue-600 dark:text-blue-400', icon: CheckCircle2, iconBg: 'bg-blue-500/10 text-blue-500' },
          { label: 'In Transit', value: courierBookedCount, sub: 'With courier', color: 'text-amber-600 dark:text-amber-400', icon: Truck, iconBg: 'bg-amber-500/10 text-amber-500' },
          { label: 'Revenue', value: `৳${totalRevenue.toLocaleString('en-BD')}`, sub: `${deliveredCount} delivered`, color: 'text-emerald-600 dark:text-emerald-400', icon: CircleDollarSign, iconBg: 'bg-emerald-500/10 text-emerald-500', isRevenue: true },
          { label: 'High Risk', value: highRiskCount, sub: 'Needs review', color: 'text-red-500', icon: ShieldAlert, iconBg: 'bg-red-500/10 text-red-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border/60 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 hover:border-border transition-colors"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground truncate">{stat.label}</p>
              <p className={`text-lg sm:text-xl font-bold mt-0.5 ${stat.isRevenue ? 'text-sm sm:text-base' : ''} ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.sub}</p>
            </div>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <stat.icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* ── SEARCH + FILTERS ── */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search customer, phone, invoice, product, tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-9 px-3 gap-1.5 text-xs shrink-0 ${hasActiveFilters && !showFilters ? 'border-primary text-primary' : ''}`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-3 gap-1.5 text-xs shrink-0"
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{allFilteredSelected ? 'Deselect' : 'Select All'}</span>
          </Button>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="bg-muted/40 border border-border/60 rounded-xl p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DATE_FILTERS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Risk Level</label>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {RISK_FILTERS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setStatusFilter('all'); setRiskFilter('all'); setDateFilter('all'); setSearch(''); }}
                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full"
                  >
                    <X className="h-3.5 w-3.5" /> Clear All Filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {STATUS_FILTERS.map((f) => {
            const count = f.id === 'all' ? orders.length : orders.filter(o => o.status === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === f.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0 rounded-full text-[10px] font-bold ${
                    statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredOrders.length}</strong>
            {filteredOrders.length !== orders.length && ` of ${orders.length}`} orders
            {selectedOrderIds.length > 0 && ` · ${selectedOrderIds.length} selected`}
          </span>
          {filteredOrders.length !== orders.length && (
            <button
              onClick={() => { setStatusFilter('all'); setRiskFilter('all'); setDateFilter('all'); setSearch(''); }}
              className="text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── BULK ACTION BAR ── */}
      {selectedOrderIds.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4">
          <div className="rounded-2xl border border-primary/30 bg-popover/98 shadow-2xl backdrop-blur-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-auto">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {selectedOrderIds.length}
                </span>
                <span className="text-sm font-semibold">orders selected</span>
              </div>

              <Button size="sm" variant="outline" onClick={() => setBulkInvoicesOpen(true)}
                className="h-7 text-xs gap-1 border-primary/40 text-primary">
                <Printer className="h-3 w-3" /> Print
              </Button>

              <Button size="sm" variant="outline"
                onClick={() => exportOrdersToCsv(orders.filter((o) => selectedOrderIds.includes(o.id)))}
                className="h-7 text-xs gap-1">
                <Download className="h-3 w-3" /> CSV
              </Button>

              <Button size="sm" onClick={() => handleBulkBookCourier('steadfast')} disabled={isBulkBooking}
                className="h-7 text-xs gap-1">
                <Truck className="h-3 w-3" /> Steadfast
              </Button>

              <Button size="sm" variant="secondary" onClick={() => handleBulkBookCourier('pathao')} disabled={isBulkBooking}
                className="h-7 text-xs gap-1">
                <Truck className="h-3 w-3" /> Pathao
              </Button>

              <select
                disabled={isBulkStatusUpdating}
                onChange={(e) => { if (e.target.value) { handleBulkStatusChange(e.target.value as OrderStatus); e.target.value = ''; } }}
                defaultValue=""
                className="h-7 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>Set Status...</option>
                <option value="CONFIRMED">→ CONFIRMED</option>
                <option value="PROCESSING">→ PROCESSING</option>
                <option value="SHIPPED">→ SHIPPED</option>
                <option value="DELIVERED">→ DELIVERED</option>
                <option value="CANCELLED">→ CANCELLED (Restock)</option>
                <option value="RETURNED">→ RETURNED (Restock)</option>
              </select>

              <button
                onClick={() => setSelectedOrderIds([])}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER LIST ── */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ShoppingBag className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No orders found</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search or filter criteria.'
              : 'Orders placed via WhatsApp AI or created manually will appear here.'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setRiskFilter('all'); setDateFilter('all'); setSearch(''); }} className="mt-4 text-xs gap-1.5">
              <X className="h-3 w-3" /> Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => {
            const isHighRisk = order.risk_level === 'HIGH';
            const isSelected = selectedOrderIds.includes(order.id);
            const advancePaid = Number(order.advance_paid) || 0;
            const totalAmount = Number(order.total_amount) || 0;
            const codDue = Math.max(0, totalAmount - advancePaid);
            const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
            const isDuplicate = orders.some(
              (o) =>
                o.id !== order.id &&
                o.customer_phone.replace(/\D/g, '') === order.customer_phone.replace(/\D/g, '') &&
                o.status !== 'CANCELLED'
            );

            return (
              <div
                key={order.id}
                className={`group rounded-xl border transition-all ${
                  isSelected
                    ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
                    : isHighRisk
                    ? 'border-red-300/60 bg-red-500/5 dark:border-red-800/60'
                    : 'border-border/60 bg-card hover:border-border hover:shadow-sm'
                }`}
              >
                <div className="p-3.5 sm:p-4">
                  {/* ── ROW 1: Selection, Invoice, Customer, Badges ── */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleOrderSelection(order.id)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top Row: Invoice + Customer + Badges */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailsOrder(order)}
                          className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md hover:bg-primary/20 transition-colors shrink-0"
                        >
                          {invoiceNo}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailsOrder(order)}
                          className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate"
                        >
                          {order.customer_name}
                        </button>

                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {order.customer_phone}
                        </span>

                        <StatusBadge status={order.status} />
                        <RiskBadge level={order.risk_level ?? undefined} />

                        {isDuplicate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                            <AlertTriangle className="h-2.5 w-2.5" /> Duplicate
                          </span>
                        )}

                        {/* Call Status */}
                        {order.call_status === 'called_confirmed' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="h-2.5 w-2.5" /> কনফার্মড
                          </span>
                        )}
                        {order.call_status === 'called_no_answer' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                            📵 ধরেননি
                          </span>
                        )}
                        {(!order.call_status || order.call_status === 'uncalled') && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-dashed">
                            📞 আনকল্ড
                          </span>
                        )}
                      </div>

                      {/* Middle Row: Product + Address */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">{order.product_name}</span>
                          {order.variant && order.variant !== 'Standard' && (
                            <span className="text-muted-foreground">· {order.variant}</span>
                          )}
                          <span className="text-muted-foreground">× {order.quantity || 1}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px] sm:max-w-xs">
                            {order.customer_address}
                            {order.thana ? `, ${order.thana}` : ''}
                            {order.district ? `, ${order.district}` : ''}
                          </span>
                        </div>

                        {order.created_at && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            {format(new Date(order.created_at), 'dd MMM, hh:mm a')}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Financials + Courier + Actions */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5">
                        {/* COD Amount */}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-foreground font-mono leading-none">
                            ৳{codDue.toLocaleString('en-BD')}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">COD</span>
                          {advancePaid > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              +৳{advancePaid} adv.
                            </span>
                          )}
                        </div>

                        <div className="h-3 w-px bg-border hidden sm:block" />

                        {/* Courier Tracking */}
                        {order.courier_tracking_code ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-medium capitalize text-muted-foreground">{order.courier_provider}</span>
                            <span className="font-mono font-bold text-primary">{order.courier_tracking_code}</span>
                            <button
                              type="button"
                              onClick={() => handleSyncCourier(order.id)}
                              disabled={syncingOrderId === order.id}
                              className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                              title="Sync courier status"
                            >
                              <RefreshCw className={`h-3 w-3 ${syncingOrderId === order.id ? 'animate-spin text-primary' : ''}`} />
                            </button>
                            <a
                              href={order.courier_provider === 'pathao'
                                ? `https://merchant.pathao.com/tracking?consignment_id=${order.courier_consignment_id || order.courier_tracking_code}`
                                : `https://portal.packzy.com/tracking?tracking_code=${order.courier_tracking_code}`
                              }
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Not dispatched</span>
                        )}

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Status Selector */}
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                          className="h-7 rounded-lg border border-input bg-background px-2 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="COURIER_BOOKED">COURIER BOOKED</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED (Restock)</option>
                          <option value="RETURNED">RETURNED (Restock)</option>
                        </select>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => setVerifyCallOrder(order)} title="Call & Verify">
                            <PhoneCall className="h-3.5 w-3.5" />
                          </Button>

                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                            onClick={() => setDetailsOrder(order)} title="View Details">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            onClick={() => {
                              setJourneyContactPhone(order.customer_phone);
                              setJourneyModalOpen(true);
                            }} title="Customer Journey">
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>

                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditOrder(order)} title="Edit Order">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>

                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setInvoiceOrder(order)} title="Print Invoice">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            className={`h-7 w-7 p-0 ${advancePaid > 0 ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setAdvanceOrder(order)} title="Advance Payment">
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>

                          {isHighRisk && (
                            <Button size="sm" variant="destructive"
                              className="h-7 px-2 text-[11px] font-semibold"
                              onClick={() => handleApproveHighRisk(order)}>
                              Approve
                            </Button>
                          )}

                          {!order.courier_tracking_code && order.status !== 'CANCELLED' && order.status !== 'RETURNED' && (
                            <Button size="sm"
                              className="h-7 px-2.5 text-[11px] font-semibold gap-1"
                              onClick={() => { setBookingOrder(order); setSelectedProvider('steadfast'); }}>
                              <Truck className="h-3 w-3" />
                              <span className="hidden sm:inline">Dispatch</span>
                            </Button>
                          )}

                          {order.conversation_id && (
                            <Link href={`/inbox?c=${order.conversation_id}`}>
                              <Button variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Open WhatsApp chat">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DISPATCH COURIER MODAL ── */}
      <Dialog open={!!bookingOrder} onOpenChange={() => setBookingOrder(null)}>
        <DialogContent className="max-w-sm sm:max-w-md w-[95vw] rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              Dispatch to Courier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Choose a courier provider to book delivery for this order.
            </DialogDescription>
          </DialogHeader>

          {bookingOrder && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="rounded-xl bg-muted/50 border border-border/60 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold text-foreground text-right">
                    {bookingOrder.customer_name} · {bookingOrder.customer_phone}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-semibold text-foreground text-right max-w-[180px] truncate">
                    {bookingOrder.product_name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Address</span>
                  <span className="font-medium text-foreground text-right max-w-[180px] text-[11px]">
                    {bookingOrder.customer_address}
                    {bookingOrder.district ? `, ${bookingOrder.district}` : ''}
                  </span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between items-center font-bold text-sm">
                  <span>COD to Collect</span>
                  <span className="text-primary font-mono">
                    ৳{Math.max(0, (bookingOrder.total_amount || 0) - (bookingOrder.advance_paid || 0)).toLocaleString('en-BD')}
                  </span>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Select Courier Provider
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'auto', name: '⚡ AI Smart Auto', sub: 'লোকেশন অনুযায়ী সর্বোচ্চ ডেলিভারি রেট' },
                    { id: 'steadfast', name: 'Steadfast', sub: 'API dispatch' },
                    { id: 'pathao', name: 'Pathao', sub: 'Sandbox / Live' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProvider(p.id as 'steadfast' | 'pathao' | 'auto')}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selectedProvider === p.id
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`font-bold text-sm ${selectedProvider === p.id ? 'text-primary' : 'text-foreground'}`}>
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setBookingOrder(null)} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBookCourier(bookingOrder.id)}
                  disabled={isBooking}
                  className="flex-1 sm:flex-none gap-1.5 font-semibold"
                >
                  {isBooking ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Dispatching...</>
                  ) : (
                    <><Truck className="h-3.5 w-3.5" /> Confirm & Book</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOGS ── */}
      <PrintableInvoiceDialog
        order={invoiceOrder}
        open={!!invoiceOrder}
        onOpenChange={(open) => !open && setInvoiceOrder(null)}
        storeName={business?.store_name || 'ONLINE STORE'}
        storePhone={business?.support_phone || business?.whatsapp_number || '+880 1800-000000'}
        storeAddress={business?.address || 'Dhaka, Bangladesh'}
      />

      <BulkPrintableInvoicesDialog
        orders={orders.filter((o) => selectedOrderIds.includes(o.id))}
        open={bulkInvoicesOpen}
        onOpenChange={setBulkInvoicesOpen}
        storeName={business?.store_name || 'ONLINE STORE'}
        storePhone={business?.support_phone || business?.whatsapp_number || '+880 1800-000000'}
        storeAddress={business?.address || 'Dhaka, Bangladesh'}
      />

      <AdvancePaymentDialog
        order={advanceOrder}
        open={!!advanceOrder}
        onOpenChange={(open) => !open && setAdvanceOrder(null)}
        onSuccess={fetchOrders}
      />

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchOrders}
      />

      <EditOrderDialog
        order={editOrder}
        open={!!editOrder}
        onOpenChange={(open) => !open && setEditOrder(null)}
        onSuccess={fetchOrders}
      />

      <AbandonedLeadsDialog
        open={abandonedOpen}
        onOpenChange={setAbandonedOpen}
        storeName={business?.store_name}
      />

      <ReturnReconciliationModal
        open={returnScannerOpen}
        onOpenChange={setReturnScannerOpen}
        orders={orders}
        onOrderUpdated={fetchOrders}
      />

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onOpenChange={setBarcodeScannerOpen}
        onOrderUpdated={fetchOrders}
        onPrintInvoice={(ord) => setInvoiceOrder(ord)}
      />

      <OrderDetailsSheet
        order={detailsOrder}
        open={!!detailsOrder}
        onOpenChange={(open) => !open && setDetailsOrder(null)}
        allOrders={orders}
        onEditOrder={(ord) => { setDetailsOrder(null); setEditOrder(ord); }}
        onPrintInvoice={(ord) => setInvoiceOrder(ord)}
        onBookCourier={(ord) => { setBookingOrder(ord); setSelectedProvider('steadfast'); }}
        onStatusUpdate={handleUpdateStatus}
        onSyncCourier={handleSyncCourier}
      />

      <CallVerificationModal
        order={verifyCallOrder}
        open={!!verifyCallOrder}
        onOpenChange={(open) => { if (!open) setVerifyCallOrder(null); }}
        onOrderUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }}
      />

      {/* Customer Journey Modal */}
      <CustomerJourneyModal
        isOpen={journeyModalOpen}
        onClose={() => {
          setJourneyModalOpen(false);
          setJourneyContactPhone(null);
        }}
        contactId={journeyContactPhone}
        contactPhone={journeyContactPhone || undefined}
      />
    </div>
  );
}
