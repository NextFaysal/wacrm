'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Clock,
  Phone,
  MessageCircle,
  Package,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Zap,
  Search,
  X,
  ExternalLink,
  MapPin,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export interface AbandonedLead {
  id: string;
  account_id: string;
  product_id?: string;
  product_name?: string;
  customer_name?: string;
  customer_phone: string;
  customer_address?: string;
  variant?: string;
  quantity: number;
  total_amount: number;
  recovered: boolean;
  recovery_order_id?: string;
  created_at: string;
}

interface AbandonedLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string;
}

export function AbandonedLeadsDialog({
  open,
  onOpenChange,
  storeName = 'আমাদের শপ',
}: AbandonedLeadsDialogProps) {
  const [leads, setLeads] = useState<AbandonedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingDripId, setSendingDripId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unrecovered' | 'recovered'>('unrecovered');
  const [search, setSearch] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/abandoned?filter=${filter}`);
      const data = await res.json();
      if (res.ok && data.abandoned) {
        setLeads(data.abandoned);
      }
    } catch {
      toast.error('Failed to load abandoned leads');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open, fetchLeads]);

  const handleMarkRecovered = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch('/api/orders/abandoned', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, recovered: !currentState }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, recovered: !currentState } : l))
        );
        toast.success(`লিডটি ${!currentState ? 'Recovered' : 'Unrecovered'} হিসেবে চিহ্নিত হয়েছে`);
      }
    } catch {
      toast.error('Error updating lead status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই অসম্পূর্ণ লিডটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/orders/abandoned?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        toast.success('লিড মুছে ফেলা হয়েছে');
      }
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const handleSendDirectDrip = async (lead: AbandonedLead) => {
    setSendingDripId(lead.id);
    try {
      const res = await fetch('/api/orders/abandoned/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abandonedId: lead.id,
          discountCode: 'SPECIAL50',
          discountAmount: 50,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to dispatch recovery');
      toast.success('কাস্টমারকে CRM থেকে সরাসরি রিকাভারি অফার পাঠানো হয়েছে!');
      fetchLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending recovery drip');
    } finally {
      setSendingDripId(null);
    }
  };

  const getWhatsAppRecoveryUrl = (lead: AbandonedLead) => {
    const cleanPhone = lead.customer_phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('880')
      ? cleanPhone
      : cleanPhone.startsWith('0')
      ? `88${cleanPhone}`
      : `880${cleanPhone}`;

    const greeting = lead.customer_name ? `আসসালামু আলাইকুম ${lead.customer_name}!` : 'আসসালামু আলাইকুম!';
    const prodText = lead.product_name ? `"${lead.product_name}"` : 'আপনার পছন্দের পণ্যটি';
    const text = encodeURIComponent(
      `${greeting} আপনি ${storeName}-এ ${prodText} অর্ডার করার প্রক্রিয়া শুরু করেছিলেন কিন্তু সম্পূর্ণ করেননি।\n\n` +
      `আপনার সুবিধার জন্য আমরা আজকের অর্ডারে দিচ্ছি বিশেষ স্পেশাল অফার ও দ্রুততম ক্যাশ অন ডেলিভারি! 🎁\n\n` +
      `অর্ডারটি কনফার্ম করতে অনুগ্রহ করে আপনার ঠিকানা লিখে এই মেসেজের রিপ্লাই দিন বা সরাসরি আমাদের জানান। ধন্যবাদ! 😊`
    );

    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
      l.customer_phone.includes(q) ||
      (l.product_name && l.product_name.toLowerCase().includes(q))
    );
  });

  const unrecoveredCount = leads.filter((l) => !l.recovered).length;
  const recoveredCount = leads.filter((l) => l.recovered).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[92vh] flex flex-col p-0 rounded-2xl overflow-hidden border-border/80 shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 ring-1 ring-amber-500/20">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Dropped Leads & Recovery
                {unrecoveredCount > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                    {unrecoveredCount} Pending
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                চেকআউট পেজে ফোন নম্বর দিয়ে ড্রপ করা কাস্টমারদের ১-ক্লিকে রি-টার্গেট করুন
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Toggle Pills */}
            <div className="flex rounded-lg border border-border/70 p-0.5 bg-muted/50 text-xs">
              <button
                type="button"
                onClick={() => setFilter('unrecovered')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  filter === 'unrecovered'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unrecovered ({unrecoveredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('recovered')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  filter === 'recovered'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Recovered ({recoveredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchLeads}
              disabled={loading}
              className="h-8 w-8 p-0 shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Quick Search */}
        <div className="px-4 sm:px-5 py-2.5 border-b bg-muted/10 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="নাম, ফোন নম্বর বা প্রোডাক্ট দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs rounded-lg bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Leads List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary/60" />
              <span>ড্রপ হওয়া লিড লোড হচ্ছে...</span>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border/80 rounded-2xl bg-muted/20 p-6">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2.5 opacity-80" />
              <h4 className="text-sm font-semibold text-foreground">কোনো অসম্পূর্ণ লিড পাওয়া যায়নি</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {search
                  ? 'সার্চের সাথে মেলানো কোনো লিড পাওয়া যায়নি।'
                  : 'যখন কোনো ক্রেতা চেকআউট পেজে ফোন নম্বর দিয়ে ড্রপ করবে, তখন এখানে তাৎক্ষণিক দেখা যাবে।'}
              </p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className={`rounded-xl border p-3.5 sm:p-4 transition-all ${
                  lead.recovered
                    ? 'border-border/50 bg-muted/20 opacity-75'
                    : 'border-border/70 bg-card hover:border-amber-500/50 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Lead Info */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {lead.customer_name || 'নাম লিখেননি'}
                      </span>
                      <a
                        href={`tel:${lead.customer_phone}`}
                        className="font-mono font-semibold text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.customer_phone}
                      </a>

                      {lead.recovered ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0"
                        >
                          ✓ Recovered
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] py-0"
                        >
                          Pending
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {lead.product_name || 'পণ্য'}
                      </span>
                      {lead.variant && lead.variant !== 'Standard' && (
                        <span>• ভ্যারিয়েন্ট: <strong>{lead.variant}</strong></span>
                      )}
                      <span>• পরিমাণ: {lead.quantity || 1}</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-foreground">
                        ৳{Number(lead.total_amount || 0).toLocaleString('en-BD')}
                      </span>
                    </div>

                    {lead.customer_address && (
                      <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                        {lead.customer_address}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3 w-3" />
                      ড্রপ-অফ:{' '}
                      <span className="font-medium text-foreground">
                        {lead.created_at
                          ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })
                          : 'N/A'}
                      </span>{' '}
                      ({format(new Date(lead.created_at), 'dd MMM, hh:mm a')})
                    </p>
                  </div>

                  {/* Actions (Responsive wrap) */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    {/* CRM 1-Click Drip */}
                    <Button
                      size="sm"
                      onClick={() => handleSendDirectDrip(lead)}
                      disabled={sendingDripId === lead.id}
                      className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {sendingDripId === lead.id ? 'পাঠানো হচ্ছে...' : '⚡ ১-ক্লিক ড্রিপ'}
                    </Button>

                    {/* WhatsApp Offer */}
                    <a
                      href={getWhatsAppRecoveryUrl(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-emerald-600/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </a>

                    {/* Mark Recovered Toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkRecovered(lead.id, lead.recovered)}
                      className="h-8 text-xs"
                      title={lead.recovered ? 'Mark Unrecovered' : 'Mark Recovered'}
                    >
                      {lead.recovered ? 'Undo' : 'Mark Done'}
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(lead.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
