"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Truck,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Award,
  ShoppingBag,
  Bot,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { playSound } from "@/lib/sound/sound-fx";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { CourierOrderDialog } from "./courier-order-dialog";
import { WarrantyDialog } from "./warranty-dialog";
import type { CourierOrderRecord, FraudCheckResult } from "@/lib/courier/types";
import type { Warranty } from "@/types/watch";
import type { Order } from "@/types/commerce";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [courierOrders, setCourierOrders] = useState<CourierOrderRecord[]>([]);
  const [courierDialogOpen, setCourierDialogOpen] = useState(false);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [warrantyDialogOpen, setWarrantyDialogOpen] = useState(false);
  const [commerceOrders, setCommerceOrders] = useState<Order[]>([]);
  const [aiState, setAiState] = useState<string | null>(null);
  const [aiHandoffSummary, setAiHandoffSummary] = useState<string | null>(null);
  const [fraudScore, setFraudScore] = useState<FraudCheckResult | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, courier orders, warranties, commerce orders, and conversation in parallel
    const [dealsRes, notesRes, tagsRes, ordersRes, warrantiesRes, commerceOrdersRes, convRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("courier_orders")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("warranties")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("conversations")
        .select("id, ai_state, ai_handoff_summary")
        .eq("contact_id", contact.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (ordersRes.data) setCourierOrders(ordersRes.data as unknown as CourierOrderRecord[]);
    if (warrantiesRes.data) setWarranties(warrantiesRes.data as unknown as Warranty[]);
    if (commerceOrdersRes.data) setCommerceOrders(commerceOrdersRes.data as unknown as Order[]);
    if (convRes.data) {
      setAiState(convRes.data.ai_state || null);
      setAiHandoffSummary(convRes.data.ai_handoff_summary || null);
    }
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }

    if (contact.phone) {
      const clean = contact.phone.replace(/\D/g, '').replace(/^(8801|880)/, (m) => m === '8801' ? '01' : '0');
      if (clean && clean.length >= 11) {
        fetch(`/api/courier/fraud-check?phone=${encodeURIComponent(clean)}`)
          .then((res) => res.json())
          .then((d) => {
            if (d.fraud_check) setFraudScore(d.fraud_check);
          })
          .catch(() => {});
      }
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    // Copies whatever the row displays — a BSUID-only contact has no
    // phone number to copy, but its @username still identifies them.
    const handle = contact ? contactHandle(contact) : '';
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = displayName.charAt(0).toUpperCase();

  const handleCopyAdvanceFeeMessage = useCallback(async () => {
    const text = `সম্মানিত গ্রাহক, আপনার অর্ডারটি নিশ্চিত করতে অনুগ্রহ করে ডেলিভারি চার্জ ৳১২০ অগ্রিম বিকাশ বা নগদ (পার্সোনাল) নাম্বারে পাঠিয়ে ট্রানজ্যাকশন আইডি বা লাস্ট ৪ ডিজিট জানান। ধন্যবাদ!`;
    await navigator.clipboard.writeText(text);
    playSound("alert");
    toast.success("Advance delivery fee message copied! Paste in chat.");
  }, []);

  return (
    <div className="flex h-full w-70 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">
                {contactHandle(contact)}
              </span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {/* Courier & Fraud Intelligence Scorecard */}
            {fraudScore && (
              <div
                className={cn(
                  "rounded-xl border p-3 space-y-2 transition-all",
                  fraudScore.level === "danger" || fraudScore.level === "risky"
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    : fraudScore.level === "caution"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : fraudScore.level === "trusted" || fraudScore.level === "good"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted/60 border-border text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    {fraudScore.level === "danger" || fraudScore.level === "risky" ? (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    )}
                    <span className="capitalize tracking-tight">
                      Steadfast: {fraudScore.level}
                    </span>
                  </div>
                  {fraudScore.score !== null && (
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-background/80 shadow-xs border border-border/50">
                      {fraudScore.score}%
                    </span>
                  )}
                </div>

                {/* Score Progress Bar */}
                {fraudScore.score !== null && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          fraudScore.score >= 75
                            ? "bg-emerald-500"
                            : fraudScore.score >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, Math.max(5, fraudScore.score))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Delivery Success Rate</span>
                      <span>{fraudScore.score}%</span>
                    </div>
                  </div>
                )}

                {/* Reports Warning */}
                {fraudScore.total_reports > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-500 bg-red-500/15 rounded-md px-2 py-1">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{fraudScore.total_reports} fake/return report(s) found</span>
                  </div>
                )}

                {/* Reasons List */}
                {fraudScore.reasons && fraudScore.reasons.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/40 text-[10px]">
                    <span className="font-medium text-muted-foreground">Reported Reasons:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {fraudScore.reasons.map((reason, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-background/80 px-1.5 py-0.5 text-[9px] border border-border/50 text-foreground truncate max-w-[200px]"
                          title={reason}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Advance Charge Request Action */}
                {(fraudScore.level === "danger" ||
                  fraudScore.level === "risky" ||
                  fraudScore.level === "caution" ||
                  fraudScore.total_reports > 0 ||
                  (fraudScore.score !== null && fraudScore.score < 70)) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAdvanceFeeMessage}
                    className="w-full h-7 text-[11px] font-medium gap-1.5 border-red-500/30 bg-background/80 hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-colors shadow-xs"
                  >
                    <Copy className="h-3 w-3" />
                    Request ৳120 Advance Fee
                  </Button>
                )}
              </div>
            )}

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}

            {/* AI Sales Agent Journey & Handoff Status */}
            {(aiState || aiHandoffSummary) && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-primary text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" />
                    AI Sales Journey
                  </span>
                  {aiState && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono uppercase text-primary">
                      {aiState}
                    </span>
                  )}
                </div>
                {aiHandoffSummary && (
                  <div className="rounded bg-background/80 p-2 text-[11px] leading-relaxed border border-border/50 text-foreground whitespace-pre-wrap font-sans">
                    <div className="flex items-center gap-1 text-amber-500 font-semibold mb-1">
                      <AlertCircle className="h-3 w-3" />
                      Handoff Context:
                    </div>
                    {aiHandoffSummary}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TagIcon className="h-3 w-3" />
              {tSidebar("tags")}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noTags")}</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Commerce Orders */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                Orders ({commerceOrders.length})
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {commerceOrders.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No orders yet</p>
              ) : (
                commerceOrders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg bg-muted p-2.5 text-xs border border-border/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-foreground font-semibold truncate max-w-[140px]" title={o.product_name}>
                        {o.product_name}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] uppercase font-bold",
                          o.status === "DELIVERED"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : o.status === "COURIER_BOOKED" || o.status === "CONFIRMED"
                            ? "bg-blue-500/10 text-blue-500"
                            : o.status === "CANCELLED" || o.status === "RETURNED"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-amber-500/10 text-amber-500"
                        )}
                      >
                        {o.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Variant: <strong className="text-foreground">{o.variant || 'Standard'}</strong></span>
                      <span className="font-bold text-foreground">৳{o.total_amount.toLocaleString()}</span>
                    </div>

                    {o.risk_level && (
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">Risk:</span>
                        <span
                          className={cn(
                            "font-bold uppercase",
                            o.risk_level === "HIGH"
                              ? "text-red-500"
                              : o.risk_level === "MEDIUM"
                              ? "text-amber-500"
                              : "text-emerald-500"
                          )}
                        >
                          {o.risk_level}
                        </span>
                      </div>
                    )}

                    {o.courier_tracking_code && (
                      <div className="flex items-center justify-between text-[10px] text-primary font-mono pt-0.5">
                        <span>Tracking:</span>
                        <span>{o.courier_tracking_code}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Courier Parcels */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <Truck className="h-3 w-3" />
                Courier ({courierOrders.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-primary hover:text-primary/90"
                onClick={() => setCourierDialogOpen(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Book
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {courierOrders.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No parcels booked</p>
              ) : (
                courierOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg bg-muted px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="capitalize text-foreground font-semibold">
                        {order.provider}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] uppercase font-semibold",
                          order.status === "in_transit" || order.status === "delivered"
                            ? "bg-green-500/10 text-green-500"
                            : order.status === "cancelled" || order.status === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-blue-500/10 text-blue-500"
                        )}
                      >
                        {order.status}
                      </span>
                    </div>
                    {order.consignment_id && (
                      <div className="mt-1 flex items-center justify-between text-muted-foreground text-[11px]">
                        <span>ID: {order.consignment_id}</span>
                        {order.tracking_code && (
                          <span className="font-mono">{order.tracking_code}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>COD: ৳{order.cod_amount}</span>
                      {order.tracking_url && (
                        <a
                          href={order.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Track <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Digital Warranties */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <Award className="h-3.5 w-3.5 text-emerald-500" />
                Warranties ({warranties.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-primary hover:text-primary/90"
                onClick={() => setWarrantyDialogOpen(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Issue
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {warranties.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No active warranties</p>
              ) : (
                warranties.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-lg bg-muted px-3 py-2 text-xs border border-border/50"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-foreground font-semibold truncate max-w-[140px]">
                        {w.product_name}
                      </span>
                      <span className="rounded-full px-1.5 py-0.2 text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400">
                        {w.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="font-mono text-primary font-semibold">{w.warranty_code}</span>
                      <span>{w.duration_months} Mos</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Expires: {format(new Date(w.expires_at), "MMM d, yyyy")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <CourierOrderDialog
        open={courierDialogOpen}
        onOpenChange={setCourierDialogOpen}
        contact={contact}
        onOrderCreated={(newOrder) => setCourierOrders((prev) => [newOrder, ...prev])}
      />

      <WarrantyDialog
        open={warrantyDialogOpen}
        onOpenChange={setWarrantyDialogOpen}
        contact={contact}
        onSendMessage={() => {}}
      />
    </div>
  );
}
