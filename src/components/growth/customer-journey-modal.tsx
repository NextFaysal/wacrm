'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MousePointer,
  ShoppingBag,
  Truck,
  MessageSquare,
  Globe,
  Calendar,
  Phone,
  User,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Loader2,
  DollarSign,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface CustomerJourneyModalProps {
  contactId: string | null;
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
  contactPhone?: string;
}

export function CustomerJourneyModal({
  contactId,
  isOpen,
  onClose,
  contactName,
  contactPhone,
}: CustomerJourneyModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    contact?: any;
    visitors?: any[];
    sessions?: any[];
    orders?: any[];
    timeline?: Array<{
      type: 'AD_TOUCH' | 'STORE_VISIT' | 'CHAT' | 'ORDER' | 'DELIVERY';
      timestamp: string;
      title: string;
      description: string;
      meta?: any;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJourney = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/customer-journey/${contactId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch customer journey');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading timeline');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (!isOpen || !contactId) {
      setData(null);
      setError(null);
      return;
    }
    void fetchJourney();
  }, [isOpen, contactId, fetchJourney]);

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'AD_TOUCH':
        return <MousePointer className="h-4 w-4 text-purple-600" />;
      case 'STORE_VISIT':
        return <Globe className="h-4 w-4 text-blue-600" />;
      case 'CHAT':
        return <MessageSquare className="h-4 w-4 text-emerald-600" />;
      case 'ORDER':
        return <ShoppingBag className="h-4 w-4 text-amber-600" />;
      case 'DELIVERY':
        return <Truck className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getTimelineBadge = (type: string) => {
    switch (type) {
      case 'AD_TOUCH':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Ad Click</Badge>;
      case 'STORE_VISIT':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Web Visit</Badge>;
      case 'CHAT':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">WhatsApp</Badge>;
      case 'ORDER':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Order</Badge>;
      case 'DELIVERY':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Delivered</Badge>;
      default:
        return <Badge variant="outline">Event</Badge>;
    }
  };

  const getChannelColor = (channel: string) => {
    switch ((channel || '').toLowerCase()) {
      case 'meta':
        return 'bg-blue-500 text-white';
      case 'google':
        return 'bg-amber-500 text-white';
      case 'tiktok':
        return 'bg-pink-600 text-white';
      case 'whatsapp':
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const contact = data?.contact;
  const displayName = contact?.name || contactName || 'Customer';
  const displayPhone = contact?.phone || contactPhone || 'No Phone';
  const totalSpend = (data?.orders || []).reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
  const deliveredOrders = (data?.orders || []).filter((o: any) => o.delivery_status === 'delivered').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-slate-50/70">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-600" />
                  {displayName}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {displayPhone}
                </Badge>
              </div>
              <DialogDescription>
                Omnichannel customer journey & attribution timeline (Ad Click → Web Visit → WhatsApp CRM → Courier Delivery)
              </DialogDescription>
            </div>
          </div>

          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="text-[11px] text-slate-700 font-medium uppercase tracking-wider block">Total Orders</span>
              <span className="text-lg font-bold text-slate-900">{data?.orders?.length || 0}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="text-[11px] text-slate-700 font-medium uppercase tracking-wider block">Delivered Orders</span>
              <span className="text-lg font-bold text-emerald-600">{deliveredOrders}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="text-[11px] text-slate-700 font-medium uppercase tracking-wider block">Lifetime Value</span>
              <span className="text-lg font-bold text-indigo-600">৳{totalSpend.toLocaleString()}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="text-[11px] text-slate-700 font-medium uppercase tracking-wider block">Web Sessions</span>
              <span className="text-lg font-bold text-slate-900">{data?.sessions?.length || 0}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Reconstructing omnichannel touchpoints...</p>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-red-600 gap-2">
              <AlertCircle className="h-8 w-8" />
              <p className="font-semibold">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchJourney()} className="mt-2">
                Retry
              </Button>
            </div>
          ) : !data?.timeline || data.timeline.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Layers className="h-10 w-10 mx-auto text-slate-300" />
              <p className="font-medium text-slate-700">No activity recorded yet</p>
              <p className="text-xs text-slate-700 max-w-sm mx-auto">
                First-party sessions, ad clicks, WhatsApp messages, or orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Attribution Flow Summary */}
              {data.sessions && data.sessions.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Multi-Touch Path</span>
                      <p className="text-xs text-indigo-700 font-medium">
                        First discovered via <span className="font-bold underline">{data.sessions[data.sessions.length - 1]?.detected_channel?.toUpperCase() || 'DIRECT'}</span> → converting order touch
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Array.from(new Set(data.sessions.map((s: any) => s.detected_channel))).map((ch: any) => (
                      <Badge key={ch} className={`${getChannelColor(ch)} text-[10px] font-semibold px-2 py-0.5`}>
                        {ch.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Vertical Timeline */}
              <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {data.timeline.map((item, idx) => (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[30px] top-1 h-7 w-7 rounded-full bg-white border-2 border-indigo-500 shadow-xs flex items-center justify-center transition-transform group-hover:scale-110">
                      {getTimelineIcon(item.type)}
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-white border rounded-xl p-4 shadow-2xs hover:shadow-md transition-shadow duration-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {getTimelineBadge(item.type)}
                          <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                        </div>
                        <span className="text-xs text-slate-700 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">{item.description}</p>

                      {/* Meta context badges */}
                      {item.meta && (
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                          {item.meta.utm?.source && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              utm_source: <strong className="text-slate-900">{item.meta.utm.source}</strong>
                            </span>
                          )}
                          {item.meta.utm?.campaign && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              utm_campaign: <strong className="text-slate-900">{item.meta.utm.campaign}</strong>
                            </span>
                          )}
                          {item.meta.lastMessage && (
                            <span className="italic truncate max-w-md bg-slate-50 px-2 py-0.5 rounded text-slate-600">
                              "{item.meta.lastMessage}"
                            </span>
                          )}
                          {item.meta.courier && (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                              Courier: {item.meta.courier}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs text-slate-700">
            Full cross-device identity stitched using phone number & 365-day first-party cookies.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
