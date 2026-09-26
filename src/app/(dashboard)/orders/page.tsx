'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '@/types/commerce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  Package,
  CircleDollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Printer,
  CreditCard,
  Download,
  CheckSquare,
  Square,
  ArrowUpDown,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import { PrintableInvoiceDialog } from '@/components/orders/printable-invoice-dialog';
import { AdvancePaymentDialog } from '@/components/orders/advance-payment-dialog';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Orders' },
  { id: 'NEW', label: 'New' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COURIER_BOOKED', label: 'Courier Booked' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'RETURNED', label: 'Returned' },
];

const RISK_FILTERS = [
  { id: 'all', label: 'All Risk Levels' },
  { id: 'LOW', label: 'Low Risk' },
  { id: 'MEDIUM', label: 'Medium Risk' },
  { id: 'HIGH', label: 'High Risk (Flagged)' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  // Selection for bulk operations
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Booking & Action modal states
  const [bookingOrder, setBookingOrder] = useState<Order | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'steadfast' | 'pathao'>('steadfast');
  const [isBooking, setIsBooking] = useState(false);
  const [isBulkBooking, setIsBulkBooking] = useState(false);

  // Dialogs
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [advanceOrder, setAdvanceOrder] = useState<Order | null>(null);

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

  // CSV Export
  const exportOrdersToCsv = (ordersToExport: Order[]) => {
    const headers = [
      'Invoice No',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Delivery Address',
      'Thana',
      'District',
      'Product Name',
      'Variant',
      'Quantity',
      'Unit Price',
      'Delivery Charge',
      'Total Amount',
      'Advance Paid',
      'Advance Method',
      'Advance TrxID',
      'COD Due',
      'Order Status',
      'Risk Level',
      'Courier Provider',
      'Tracking Code',
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
        o.quantity || 1,
        o.unit_price || 0,
        o.delivery_charge || 0,
        total,
        adv,
        `"${o.advance_method || ''}"`,
        `"${o.advance_trx_id || ''}"`,
        cod,
        `"${o.status}"`,
        `"${o.risk_level || 'LOW'}"`,
        `"${o.courier_provider || ''}"`,
        `"${o.courier_tracking_code || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
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

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [orders, search, statusFilter, riskFilter]);

  // Selection toggle
  const allFilteredSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
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

  return (
    <div className="flex-1 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Orders & Commerce
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
              <ShoppingBag className="mr-1 h-3 w-3" /> Live Orders
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 sm:text-sm">
            Real-time orders generated via WhatsApp, public checkout, with fraud checks & courier dispatch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
              <TrendingUp className="h-3.5 w-3.5" /> Analytics
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportOrdersToCsv(filteredOrders)}
            disabled={filteredOrders.length === 0}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="h-8 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/inbox">
            <Button size="sm" className="h-8 text-xs">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Live Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-5">
        <Card className="border border-border/70 bg-card shadow-none">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Total Orders</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5 sm:text-2xl">{totalOrders}</h3>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">All time</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-none">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Confirmed</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5 sm:text-2xl">{confirmedCount}</h3>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium sm:text-[11px]">Ready to ship</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-none">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Courier Booked</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5 sm:text-2xl">{courierBookedCount}</h3>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium sm:text-[11px]">In dispatch</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Truck className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-none">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Delivered Revenue</p>
              <h3 className="text-lg font-bold text-foreground mt-0.5 sm:text-2xl">৳{totalRevenue.toLocaleString('en-BD')}</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium sm:text-[11px]">{deliveredCount} delivered</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CircleDollarSign className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1 border border-border/70 bg-card shadow-none">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">High Risk Flagged</p>
              <h3 className="text-xl font-bold text-red-500 mt-0.5 sm:text-2xl">{highRiskCount}</h3>
              <p className="text-[10px] text-red-400 font-medium sm:text-[11px]">Needs manual check</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-18 left-3 right-3 z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-popover/95 p-3.5 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-8 sm:max-w-xl lg:bottom-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-xs">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-semibold text-foreground sm:text-sm">
              Selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const selected = orders.filter((o) => selectedOrderIds.includes(o.id));
                exportOrdersToCsv(selected);
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export Selected CSV
            </Button>

            <Button
              size="sm"
              onClick={() => handleBulkBookCourier('steadfast')}
              disabled={isBulkBooking}
              className="h-8 text-xs gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" /> Bulk Book Steadfast
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkBookCourier('pathao')}
              disabled={isBulkBooking}
              className="h-8 text-xs gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" /> Bulk Book Pathao
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedOrderIds([])}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer phone, name, invoice #, product, or tracking code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
            </button>

            {/* Risk filter selector */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {RISK_FILTERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none flex-nowrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-all active:scale-95 ${
                statusFilter === f.id
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary/60" />
          <p className="text-sm">Loading commerce orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No orders found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' || riskFilter !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : 'Orders placed via WhatsApp AI sales agent or created manually will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isHighRisk = order.risk_level === 'HIGH';
            const isMediumRisk = order.risk_level === 'MEDIUM';
            const isSelected = selectedOrderIds.includes(order.id);
            const advancePaid = Number(order.advance_paid) || 0;
            const totalAmount = Number(order.total_amount) || 0;
            const codDue = Math.max(0, totalAmount - advancePaid);
            const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;

            return (
              <Card
                key={order.id}
                className={`border transition-all hover:border-border/80 ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                    : isHighRisk
                    ? 'border-red-500/40 bg-red-950/5'
                    : 'bg-card'
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Checkbox & Customer Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleOrderSelection(order.id)}
                        className="mt-1 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {invoiceNo}
                          </span>
                          <h4 className="font-semibold text-foreground text-sm">
                            {order.customer_name}
                          </h4>
                          <span className="text-xs font-mono text-muted-foreground">
                            ({order.customer_phone})
                          </span>

                          {/* Risk Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold ${
                              isHighRisk
                                ? 'border-red-500 bg-red-500/10 text-red-500'
                                : isMediumRisk
                                ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                                : 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            }`}
                          >
                            {isHighRisk && <ShieldAlert className="mr-1 h-3 w-3" />}
                            {order.risk_level || 'LOW'} RISK
                          </Badge>

                          {/* Status Badge */}
                          <Badge
                            className={`text-[10px] uppercase font-semibold ${
                              order.status === 'DELIVERED'
                                ? 'bg-emerald-600 text-white'
                                : order.status === 'COURIER_BOOKED'
                                ? 'bg-blue-600 text-white'
                                : order.status === 'CANCELLED'
                                ? 'bg-red-600 text-white'
                                : order.status === 'RETURNED'
                                ? 'bg-amber-600 text-white'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {order.status}
                          </Badge>
                        </div>

                        {/* Product & Variant */}
                        <div className="text-xs text-foreground font-medium flex flex-wrap items-center gap-2">
                          <span className="text-primary font-semibold">{order.product_name}</span>
                          {order.variant && (
                            <span className="text-muted-foreground">
                              • Variant: <strong>{order.variant}</strong>
                            </span>
                          )}
                          <span className="text-muted-foreground">• Qty: {order.quantity}</span>
                        </div>

                        {/* Address */}
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          📍 {order.customer_address}
                          {order.thana ? `, ${order.thana}` : ''}
                          {order.district ? `, ${order.district}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Financials & Courier */}
                    <div className="flex flex-wrap items-center gap-5 lg:text-right">
                      <div>
                        <div className="text-xs text-muted-foreground">Due COD to Collect</div>
                        <div className="text-lg font-black text-foreground font-mono">
                          ৳{codDue.toLocaleString('en-BD')}
                        </div>
                        {advancePaid > 0 ? (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Advance: ৳{advancePaid} ({order.advance_method || 'bKash'})
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            Delivery: ৳{order.delivery_charge}
                          </div>
                        )}
                      </div>

                      {/* Courier Status */}
                      <div className="min-w-[130px]">
                        {order.courier_tracking_code ? (
                          <div className="text-xs space-y-0.5">
                            <span className="text-muted-foreground capitalize font-medium">
                              {order.courier_provider || 'Courier'}
                            </span>
                            <div className="font-mono text-xs text-primary font-bold">
                              {order.courier_tracking_code}
                            </div>
                            <a
                              href={`https://portal.packzy.com/tracking?tracking_code=${order.courier_tracking_code}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              Track Parcel <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Not dispatched
                          </span>
                        )}
                      </div>

                      {/* Status Selector */}
                      <div>
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="COURIER_BOOKED">COURIER_BOOKED</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED (Restock)</option>
                          <option value="RETURNED">RETURNED (Restock)</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Print Invoice */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => setInvoiceOrder(order)}
                          title="Print A4 Invoice or POS 80mm Slip"
                        >
                          <Printer className="h-3.5 w-3.5 text-primary" />
                          <span className="hidden sm:inline">Invoice</span>
                        </Button>

                        {/* Advance Payment Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-8 text-xs gap-1 ${
                            advancePaid > 0 ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600' : ''
                          }`}
                          onClick={() => setAdvanceOrder(order)}
                          title="Record / Edit Advance Payment (bKash/Nagad)"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">
                            {advancePaid > 0 ? `৳${advancePaid}` : 'Advance'}
                          </span>
                        </Button>

                        {isHighRisk && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => handleApproveHighRisk(order)}
                          >
                            Approve
                          </Button>
                        )}

                        {!order.courier_tracking_code && order.status !== 'CANCELLED' && order.status !== 'RETURNED' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs font-medium gap-1"
                            onClick={() => {
                              setBookingOrder(order);
                              setSelectedProvider('steadfast');
                            }}
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Dispatch
                          </Button>
                        )}

                        {order.conversation_id && (
                          <Link href={`/inbox?c=${order.conversation_id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                              title="Open customer WhatsApp chat"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Book Courier Modal */}
      <Dialog open={!!bookingOrder} onOpenChange={() => setBookingOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Dispatch Parcel to Courier
            </DialogTitle>
            <DialogDescription>
              Select courier provider to book order #{bookingOrder?.invoice_no || bookingOrder?.id.slice(0, 8)} for delivery.
            </DialogDescription>
          </DialogHeader>

          {bookingOrder && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg bg-muted p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">
                    {bookingOrder.customer_name} ({bookingOrder.customer_phone})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="font-semibold text-foreground">
                    {bookingOrder.product_name} ({bookingOrder.variant || 'Standard'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-medium text-foreground text-right max-w-[220px]">
                    {bookingOrder.customer_address}
                  </span>
                </div>
                {bookingOrder.advance_paid && bookingOrder.advance_paid > 0 ? (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Advance Paid:</span>
                    <span>৳{bookingOrder.advance_paid}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                  <span>Net COD Collection:</span>
                  <span className="text-primary font-mono">
                    ৳{Math.max(0, (bookingOrder.total_amount || 0) - (bookingOrder.advance_paid || 0)).toLocaleString('en-BD')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Select Courier Provider:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('steadfast')}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      selectedProvider === 'steadfast'
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="font-bold">Steadfast Courier</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Automated API Dispatch</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider('pathao')}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      selectedProvider === 'pathao'
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="font-bold">Pathao Courier</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Sandbox / Live API</div>
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button variant="outline" size="sm" onClick={() => setBookingOrder(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBookCourier(bookingOrder.id)}
                  disabled={isBooking}
                >
                  {isBooking ? 'Dispatching...' : 'Confirm & Book Parcel'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Printable Invoice Dialog */}
      <PrintableInvoiceDialog
        order={invoiceOrder}
        open={!!invoiceOrder}
        onOpenChange={(open) => !open && setInvoiceOrder(null)}
      />

      {/* Advance Payment Dialog */}
      <AdvancePaymentDialog
        order={advanceOrder}
        open={!!advanceOrder}
        onOpenChange={(open) => !open && setAdvanceOrder(null)}
        onSuccess={fetchOrders}
      />
    </div>
  );
}
