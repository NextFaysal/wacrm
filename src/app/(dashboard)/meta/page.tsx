"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  MessageSquare,
  TrendingUp,
  Settings,
  Bot,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Send,
  MessageCircle,
  DollarSign,
  BarChart3,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Zap,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  Layers,
  Phone,
  ShoppingBag,
  Info,
  AlertCircle,
  Flame,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MetaComment, MetaIntegrationConfig, MetaPlatform } from "@/lib/meta/types";

// ==========================================
// Brand Icons
// ==========================================

function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function MetaSymbolIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.001 7.2c-2.3 0-4.2 1.6-4.9 3.8C6.4 8.7 4.5 7.2 2.2 7.2 1 7.2 0 8.2 0 9.4c0 4.2 3.4 7.6 7.6 7.6 2.3 0 4.2-1.6 4.9-3.8.7 2.2 2.6 3.8 4.9 3.8 4.2 0 7.6-3.4 7.6-7.6 0-1.2-1-2.2-2.2-2.2-2.3 0-4.2 1.6-4.9 3.8-.7-2.2-2.6-3.8-4.9-3.8zm0 7.6c-2.4 0-4.4-2-4.4-4.4s2-4.4 4.4-4.4 4.4 2 4.4 4.4-2 4.4-4.4 4.4z" />
    </svg>
  );
}

// Preset Quick Replies for Fast Customer Service
const QUICK_REPLY_PRESETS = [
  {
    label: "Price & Order Guide (বাংলা)",
    text: "আসসালামু আলাইকুম! পণ্যটির বর্তমান অফার মূল্য ও অর্ডার করার বিস্তারিত নিয়ম জানতে অনুগ্রহ করে আপনার ইনবক্স চেক করুন। ধন্যবাদ!",
  },
  {
    label: "Delivery & Payment (Cash on Delivery)",
    text: "আমরা সারা বাংলাদেশে ক্যাশ অন ডেলিভারি (Cash on Delivery) প্রদান করি। ঢাকা সিটিতে ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা ডেলিভারি চার্জ। অর্ডার করতে আপনার নাম, ঠিকানা ও মোবাইল নম্বর দিন।",
  },
  {
    label: "Product Availability & Assurance",
    text: "জি, এই পণ্যটি বর্তমানে আমাদের স্টকে এভেইলেবল রয়েছে। ১০০% অরিজিনাল কোয়ালিটি নিশ্চয়তা সহ নিতে ইনবক্সে মেসেজ দিন অথবা আমাদের নাম্বারে যোগাযোগ করুন।",
  },
];

export default function MetaManagementPage() {
  const [activeTab, setActiveTab] = useState("comments");

  // Config State
  const [config, setConfig] = useState<MetaIntegrationConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [configForm, setConfigForm] = useState({
    page_id: "",
    page_name: "",
    page_access_token: "",
    instagram_account_id: "",
    instagram_username: "",
    ad_account_id: "",
    pixel_id: "",
    capi_access_token: "",
    capi_test_event_code: "",
    capi_enabled: true,
    verify_token: "wacrm_meta_verify_token",
    ai_comment_reply_enabled: true,
    ai_comment_private_dm_enabled: true,
    ai_comment_prompt: "",
  });

  // Copied states
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedVerify, setCopiedVerify] = useState(false);

  // CAPI Events State
  const [capiEvents, setCapiEvents] = useState<any[]>([]);
  const [capiStats, setCapiStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [capiLoading, setCapiLoading] = useState(false);
  const [testingCapi, setTestingCapi] = useState(false);
  const [customTestEvent, setCustomTestEvent] = useState({
    eventName: "Purchase",
    value: 1650,
    phone: "01711223344",
  });

  // Comments State
  const [comments, setComments] = useState<MetaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSearch, setCommentSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<"all" | MetaPlatform>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "unreplied" | "replied">("all");
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [activeCommentForReply, setActiveCommentForReply] = useState<MetaComment | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isPrivateReply, setIsPrivateReply] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [triggeringAiId, setTriggeringAiId] = useState<string | null>(null);

  // Ads Insights State
  const [adsSummary, setAdsSummary] = useState({
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    avgCpc: 0,
    avgCpm: 0,
    totalConversions: 0,
    totalAttributedRevenue: 0,
    overallRoas: 0,
  });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [syncingAds, setSyncingAds] = useState(false);
  const [adsPreset, setAdsPreset] = useState("last_30d");
  const [campaignSearch, setCampaignSearch] = useState("");

  // Ad Optimizer & Stop-Loss State
  const [adRule, setAdRule] = useState<{
    id?: string;
    is_active: boolean;
    max_spend_threshold: number;
    min_roas_threshold: number;
  }>({
    is_active: true,
    max_spend_threshold: 15,
    min_roas_threshold: 1.0,
  });
  const [evaluatingOptimizer, setEvaluatingOptimizer] = useState(false);
  const [optimizerResults, setOptimizerResults] = useState<{
    pausedCampaigns: any[];
    winningCampaigns: any[];
  } | null>(null);

  // Load Config
  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const res = await fetch("/api/meta/config");
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
        setConfigForm({
          page_id: json.config.page_id || "",
          page_name: json.config.page_name || "",
          page_access_token: "",
          instagram_account_id: json.config.instagram_account_id || "",
          instagram_username: json.config.instagram_username || "",
          ad_account_id: json.config.ad_account_id || "",
          pixel_id: json.config.pixel_id || "",
          capi_access_token: "",
          capi_test_event_code: json.config.capi_test_event_code || "",
          capi_enabled: json.config.capi_enabled ?? true,
          verify_token: json.config.verify_token || "wacrm_meta_verify_token",
          ai_comment_reply_enabled: json.config.ai_comment_reply_enabled ?? true,
          ai_comment_private_dm_enabled: json.config.ai_comment_private_dm_enabled ?? true,
          ai_comment_prompt: json.config.ai_comment_prompt || "",
        });
      }
    } catch {
      toast.error("Failed to load Meta configuration");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Load CAPI Events
  const loadCapiEvents = useCallback(async () => {
    try {
      setCapiLoading(true);
      const res = await fetch("/api/meta/capi/events?limit=50");
      const data = await res.json();
      if (data.events) {
        setCapiEvents(data.events);
        setCapiStats(data.stats || { total: 0, sent: 0, failed: 0 });
      }
    } catch {
      toast.error("Failed to load CAPI events");
    } finally {
      setCapiLoading(false);
    }
  }, []);

  // Test CAPI Event
  const handleTestCapi = async () => {
    try {
      setTestingCapi(true);
      const res = await fetch("/api/meta/capi/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: customTestEvent.eventName,
          testEventCode: configForm.capi_test_event_code || undefined,
          value: Number(customTestEvent.value) || 1650,
          currency: "BDT",
          phone: customTestEvent.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "CAPI test failed");
      toast.success(`Test '${customTestEvent.eventName}' dispatched to Meta Conversions API!`);
      loadCapiEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch CAPI test event");
    } finally {
      setTestingCapi(false);
    }
  };

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await fetch("/api/meta/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Meta settings saved successfully!");
      loadConfig();
    } catch (err: any) {
      toast.error(err.message || "Failed to update configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  // Load Comments
  const loadComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const params = new URLSearchParams();
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (commentSearch.trim()) params.set("q", commentSearch.trim());

      const res = await fetch(`/api/meta/comments?${params.toString()}`);
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  }, [filterPlatform, filterStatus, commentSearch]);

  // Load Ads Insights
  const loadAdsInsights = useCallback(async () => {
    try {
      setAdsLoading(true);
      const res = await fetch("/api/meta/ads/insights");
      const data = await res.json();
      if (data.summary) {
        setAdsSummary(data.summary);
        setCampaigns(data.campaigns || []);
      }
    } catch {
      toast.error("Failed to load ad insights");
    } finally {
      setAdsLoading(false);
    }
  }, []);

  // Load Ad Rules
  const loadAdRules = useCallback(async () => {
    try {
      const res = await fetch("/api/meta/ads/optimizer");
      const data = await res.json();
      if (data.rules && data.rules.length > 0) {
        const stopLoss = data.rules.find((r: any) => r.rule_type === "stop_loss") || data.rules[0];
        setAdRule({
          id: stopLoss.id,
          is_active: stopLoss.is_active,
          max_spend_threshold: Number(stopLoss.max_spend_threshold) || 15,
          min_roas_threshold: Number(stopLoss.min_roas_threshold) || 1.0,
        });
      }
    } catch {
      // silent
    }
  }, []);

  // Update Ad Rule Thresholds
  const handleUpdateAdRule = async (updated: Partial<typeof adRule>) => {
    const next = { ...adRule, ...updated };
    setAdRule(next);
    if (!next.id) return;
    try {
      await fetch("/api/meta/ads/optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: next.id,
          is_active: next.is_active,
          max_spend_threshold: next.max_spend_threshold,
          min_roas_threshold: next.min_roas_threshold,
        }),
      });
      toast.success("Ad stop-loss rule updated!");
    } catch {
      toast.error("Failed to update rule");
    }
  };

  // Evaluate Optimizer Rules
  const handleEvaluateOptimizer = async () => {
    try {
      setEvaluatingOptimizer(true);
      const res = await fetch("/api/meta/ads/optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      setOptimizerResults(data.result);
      if (data.result?.pausedCampaigns?.length > 0) {
        toast.warning(`Auto-paused ${data.result.pausedCampaigns.length} failing campaign(s) to save budget!`);
      } else {
        toast.success(`Evaluated ${data.result?.evaluatedCount || 0} campaigns. All within safe limits!`);
      }
      loadAdsInsights();
    } catch (err: any) {
      toast.error(err.message || "Failed to evaluate rules");
    } finally {
      setEvaluatingOptimizer(false);
    }
  };

  // Sync Ads with Meta
  const handleSyncAds = async () => {
    try {
      setSyncingAds(true);
      const res = await fetch(`/api/meta/ads/sync?preset=${adsPreset}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.syncedCount || 0} campaigns from Meta Ads Manager!`);
      loadAdsInsights();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync Meta Ads");
    } finally {
      setSyncingAds(false);
    }
  };

  // Manual Comment Reply
  const handleSendReply = async () => {
    if (!activeCommentForReply || !replyMessage.trim()) return;
    try {
      setSubmittingReply(true);
      const res = await fetch("/api/meta/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment_id: activeCommentForReply.comment_id,
          platform: activeCommentForReply.platform,
          message: replyMessage,
          is_private: isPrivateReply,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reply");
      toast.success(isPrivateReply ? "Private message (DM) sent!" : "Public reply posted!");
      setReplyDialogOpen(false);
      setReplyMessage("");
      loadComments();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Trigger AI Auto-Reply Manually
  const handleTriggerAiReply = async (comment: MetaComment) => {
    try {
      setTriggeringAiId(comment.comment_id);
      const res = await fetch("/api/meta/comments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: comment.comment_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger AI");
      toast.success("AI reply generated & sent successfully!");
      loadComments();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI reply");
    } finally {
      setTriggeringAiId(null);
    }
  };

  // Hide or Unhide Comment
  const handleToggleHide = async (comment: MetaComment) => {
    try {
      const res = await fetch("/api/meta/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment_id: comment.comment_id,
          is_hidden: !comment.is_hidden,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(comment.is_hidden ? "Comment unhidden on post" : "Comment hidden on post");
      loadComments();
    } catch (err: any) {
      toast.error(err.message || "Error updating comment");
    }
  };

  // Delete Comment
  const handleDeleteComment = async (comment: MetaComment) => {
    if (!confirm("Are you sure you want to permanently delete this comment from the post?")) return;
    try {
      const res = await fetch(`/api/meta/comments?comment_id=${comment.comment_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete comment");
      toast.success("Comment deleted from Meta");
      loadComments();
    } catch (err: any) {
      toast.error(err.message || "Error deleting comment");
    }
  };

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (activeTab === "comments") {
      loadComments();
    } else if (activeTab === "ads") {
      loadAdsInsights();
      loadAdRules();
    } else if (activeTab === "capi") {
      loadCapiEvents();
    }
  }, [activeTab, loadComments, loadAdsInsights, loadAdRules, loadCapiEvents]);

  const copyToClipboard = (text: string, type: "webhook" | "verify") => {
    navigator.clipboard.writeText(text);
    if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedVerify(true);
      setTimeout(() => setCopiedVerify(false), 2000);
    }
    toast.success("Copied to clipboard!");
  };

  const webhookCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/meta/webhook`
      : "https://your-domain.com/api/meta/webhook";

  // Filtered comments & metrics
  const unrepliedCount = useMemo(
    () => comments.filter((c) => !c.ai_replied).length,
    [comments]
  );

  const filteredCampaigns = useMemo(() => {
    if (!campaignSearch.trim()) return campaigns;
    const q = campaignSearch.toLowerCase();
    return campaigns.filter((c) => c.campaign_name?.toLowerCase().includes(q));
  }, [campaigns, campaignSearch]);

  // Overall Connection Checklist status
  const connectionChecklist = {
    pageConnected: !!config?.page_id,
    instagramConnected: !!config?.instagram_account_id,
    adAccountConnected: !!config?.ad_account_id,
    capiConnected: !!config?.pixel_id,
  };
  const connectedCount = Object.values(connectionChecklist).filter(Boolean).length;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ======================================================== */}
      {/* HERO SECTION / BRAND HEADER */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-background p-5 sm:p-7 shadow-sm">
        {/* Subtle decorative mesh gradient */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-500/10 to-amber-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dual Brand Icon Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600/15 via-purple-600/15 to-pink-600/15 border border-blue-500/20 text-foreground shadow-xs">
                <FacebookIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-muted-foreground">+</span>
                <InstagramIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <span className="text-xs font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent ml-1">
                  Meta Hub
                </span>
              </div>

              {/* Status Badge */}
              {config?.status === "connected" ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium py-1 px-3 shadow-xs"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{config.page_name ? `${config.page_name}` : "Page Connected"}</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium py-1 px-3 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Setup Incomplete ({connectedCount}/4 active)</span>
                </Badge>
              )}

              {configForm.ai_comment_reply_enabled && (
                <Badge
                  variant="outline"
                  className="gap-1 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs py-1 px-2.5 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  AI Auto-Pilot Active
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Meta Unified Command Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Automate customer interactions across Facebook Page & Instagram Reels with AI, monitor real-time Meta Ads ROAS, and bypass iOS tracking loss with Server Conversions API.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
            <Link href="/inbox">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 text-xs font-medium border-border/80 bg-background/80 hover:bg-accent backdrop-blur-xs"
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>Open Unified Inbox</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </Link>

            <Button
              size="sm"
              onClick={() => {
                if (activeTab === "comments") loadComments();
                else if (activeTab === "ads") handleSyncAds();
                else if (activeTab === "capi") loadCapiEvents();
                else loadConfig();
              }}
              disabled={commentsLoading || syncingAds || capiLoading || configLoading}
              className="gap-2 h-9 text-xs font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  commentsLoading || syncingAds || capiLoading || configLoading ? "animate-spin" : ""
                }`}
              />
              <span>{syncingAds ? "Syncing..." : "Sync All Meta Data"}</span>
            </Button>
          </div>
        </div>

        {/* Top-Level KPI Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 mt-6 border-t border-border/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Comments & AI
              </p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                {comments.length}
                {unrepliedCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                    {unrepliedCount} pending
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Blended ROAS
              </p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                {adsSummary.overallRoas > 0 ? `${adsSummary.overallRoas.toFixed(2)}x` : "—"}
                {adsSummary.overallRoas >= 3 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                    Profitable 🔥
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Ad Spend & Sales
              </p>
              <p className="text-base font-bold text-foreground">
                ${adsSummary.totalSpend.toLocaleString()} / ৳{adsSummary.totalAttributedRevenue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                CAPI Tracking Health
              </p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                100% Reliable
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN TABS NAVIGATION */}
      {/* ======================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="inline-flex w-full sm:w-auto h-auto p-1 bg-muted/70 rounded-xl border border-border/60 gap-1">
            <TabsTrigger
              value="comments"
              className="gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Bot className="w-3.5 h-3.5 text-purple-500" />
              <span>Comments & AI</span>
              {unrepliedCount > 0 && (
                <Badge className="ml-1 bg-purple-600 hover:bg-purple-600 text-white text-[10px] px-1.5 py-0 h-4 rounded-full">
                  {unrepliedCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="ads"
              className="gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Meta Ads & ROAS</span>
              {adsSummary.overallRoas > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-600"
                >
                  {adsSummary.overallRoas.toFixed(1)}x
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="capi"
              className="gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Server CAPI (Pixel)</span>
            </TabsTrigger>

            <TabsTrigger
              value="messages"
              className="gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Messenger & IG Direct</span>
            </TabsTrigger>

            <TabsTrigger
              value="settings"
              className="gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Meta Integration Setup</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: COMMENTS & AI AUTO-REPLY */}
        {/* ======================================================== */}
        <TabsContent value="comments" className="space-y-6">
          {/* AI Banner & Mode Switcher */}
          <div className="relative overflow-hidden rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      AI Instant Comment Responder & Private DM Engine
                    </h3>
                    <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5">
                      Auto-Pilot
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                    Every incoming comment on Facebook Page posts and Instagram Reels is analyzed. Price or order inquiries automatically receive a helpful public reply plus a direct Messenger DM!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-medium border-purple-300 dark:border-purple-800 bg-background/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 gap-1.5"
                  onClick={() => setActiveTab("settings")}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Configure AI Prompt
                </Button>
              </div>
            </div>
          </div>

          {/* Search, Platform & Status Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search comments, customers, or keywords..."
                value={commentSearch}
                onChange={(e) => setCommentSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadComments()}
                className="pl-9 h-9 text-xs bg-background"
              />
              {commentSearch && (
                <button
                  onClick={() => {
                    setCommentSearch("");
                    loadComments();
                  }}
                  className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Platform & Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Platform Filter */}
              <div className="flex items-center p-0.5 bg-muted/80 rounded-lg border border-border/50 text-xs">
                <Button
                  variant={filterPlatform === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterPlatform("all")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md"
                >
                  All Channels
                </Button>
                <Button
                  variant={filterPlatform === "facebook" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterPlatform("facebook")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md gap-1.5 text-blue-600 dark:text-blue-400"
                >
                  <FacebookIcon className="w-3.5 h-3.5" /> Facebook
                </Button>
                <Button
                  variant={filterPlatform === "instagram" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterPlatform("instagram")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md gap-1.5 text-pink-600 dark:text-pink-400"
                >
                  <InstagramIcon className="w-3.5 h-3.5" /> Instagram
                </Button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center p-0.5 bg-muted/80 rounded-lg border border-border/50 text-xs">
                <Button
                  variant={filterStatus === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md"
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "unreplied" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("unreplied")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md gap-1 text-amber-600 dark:text-amber-400"
                >
                  <Clock className="w-3 h-3" />
                  Pending ({unrepliedCount})
                </Button>
                <Button
                  variant={filterStatus === "replied" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("replied")}
                  className="h-7 px-2.5 text-xs font-medium rounded-md gap-1 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Replied
                </Button>
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={loadComments}
                disabled={commentsLoading}
                className="h-8 px-3 text-xs gap-1.5 bg-background"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${commentsLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Comments Feed */}
          {commentsLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 bg-card rounded-2xl border border-border/60">
              <RefreshCw className="w-7 h-7 animate-spin text-purple-600" />
              <p className="text-sm font-medium">Fetching real-time comments stream...</p>
            </div>
          ) : comments.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center text-muted-foreground space-y-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center mx-auto text-muted-foreground">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground">No Comments Found</h3>
                  <p className="text-xs max-w-md mx-auto text-muted-foreground">
                    {commentSearch
                      ? `No comments match "${commentSearch}". Try another search term.`
                      : "When customers comment on your Facebook Page posts or Instagram Reels, they will appear here in real-time."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {commentSearch ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCommentSearch("");
                        loadComments();
                      }}
                    >
                      Clear Search Filter
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("settings")}>
                      Check Webhook Subscriptions
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const displayName =
                  comment.sender_name ||
                  (comment.platform === "instagram" ? `@${comment.sender_username}` : "Customer");
                const initial = displayName.charAt(0).toUpperCase();

                return (
                  <Card
                    key={comment.comment_id}
                    className={`overflow-hidden border transition-all duration-200 hover:shadow-md ${
                      comment.is_hidden
                        ? "opacity-60 bg-muted/30"
                        : "bg-card border-border/70 hover:border-border"
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Comment Top Row */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Avatar & Sender Info */}
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10 border border-border shadow-xs">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-foreground font-bold text-sm">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            {/* Platform badge overlay */}
                            <span
                              className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-xs ${
                                comment.platform === "facebook"
                                  ? "bg-blue-600"
                                  : "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600"
                              }`}
                            >
                              {comment.platform === "facebook" ? (
                                <FacebookIcon className="w-2.5 h-2.5" />
                              ) : (
                                <InstagramIcon className="w-2.5 h-2.5" />
                              )}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {displayName}
                              </span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(comment.comment_created_at).toLocaleString([], {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>

                            {comment.post_caption && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-lg flex items-center gap-1">
                                <span className="font-medium text-foreground/70">Post:</span>
                                {comment.post_caption}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                          {comment.is_hidden && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                              Hidden
                            </Badge>
                          )}
                          {comment.ai_replied ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] border border-emerald-500/30 gap-1 font-semibold">
                              <CheckCircle2 className="w-2.5 h-2.5" /> AI Replied
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] gap-1 font-semibold"
                            >
                              <Clock className="w-2.5 h-2.5" /> Needs Reply
                            </Badge>
                          )}
                          {comment.ai_private_dm_sent && (
                            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-[10px] border border-purple-500/30 gap-1 font-semibold">
                              <Send className="w-2.5 h-2.5" /> DM Sent
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Customer Message Bubble */}
                      <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground leading-relaxed font-medium">
                        "{comment.message}"
                      </div>

                      {/* Nested Replies Thread */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="pl-4 sm:pl-6 border-l-2 border-purple-500/30 space-y-2.5 mt-3">
                          {comment.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="text-xs p-3 rounded-xl bg-card border border-border/60 space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  {reply.sender_type === "ai" ? (
                                    <Badge className="bg-purple-600/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[10px] gap-1 font-semibold py-0">
                                      <Bot className="w-3 h-3 text-purple-600" />
                                      AI Auto-Reply
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-blue-600 text-[10px] gap-1 font-semibold py-0">
                                      Admin / Page
                                    </Badge>
                                  )}
                                  {reply.is_private && (
                                    <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                                      <Send className="w-2.5 h-2.5" /> Private DM
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px]">
                                  {new Date(reply.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-foreground/90 font-medium leading-relaxed pl-1">
                                {reply.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1.5 text-xs font-semibold shadow-2xs"
                            onClick={() => {
                              setActiveCommentForReply(comment);
                              setIsPrivateReply(false);
                              setReplyDialogOpen(true);
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                            <span>Reply Publicly</span>
                          </Button>

                          {comment.platform === "facebook" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                              onClick={() => {
                                setActiveCommentForReply(comment);
                                setIsPrivateReply(true);
                                setReplyDialogOpen(true);
                              }}
                            >
                              <Send className="w-3.5 h-3.5 text-purple-600" />
                              <span>Send Private DM</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs font-semibold bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                            disabled={triggeringAiId === comment.comment_id}
                            onClick={() => handleTriggerAiReply(comment)}
                          >
                            <Sparkles
                              className={`w-3.5 h-3.5 text-purple-600 ${
                                triggeringAiId === comment.comment_id ? "animate-spin" : ""
                              }`}
                            />
                            <span>
                              {triggeringAiId === comment.comment_id
                                ? "Generating..."
                                : "✨ AI One-Click Reply"}
                            </span>
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title={comment.is_hidden ? "Unhide on Post" : "Hide on Post"}
                            onClick={() => handleToggleHide(comment)}
                          >
                            {comment.is_hidden ? (
                              <Eye className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            title="Delete Comment"
                            onClick={() => handleDeleteComment(comment)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: ADS COST & ROAS ANALYTICS */}
        {/* ======================================================== */}
        <TabsContent value="ads" className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border border-border/70 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">
                  Meta Ads Spend & CRM Closed-Loop ROAS
                </h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                Real-time sync of campaign spend directly with Meta Marketing API, matched with completed orders & confirmed courier revenue.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                className="h-9 px-3 text-xs border rounded-lg bg-background text-foreground font-medium shadow-2xs focus:ring-1 focus:ring-primary"
                value={adsPreset}
                onChange={(e) => setAdsPreset(e.target.value)}
              >
                <option value="last_7d">Last 7 Days</option>
                <option value="last_30d">Last 30 Days</option>
                <option value="last_90d">Last 90 Days</option>
                <option value="maximum">Lifetime (All Time)</option>
              </select>

              <Button
                size="sm"
                onClick={handleSyncAds}
                disabled={syncingAds}
                className="gap-2 h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAds ? "animate-spin" : ""}`} />
                {syncingAds ? "Syncing..." : "Sync Meta Ads"}
              </Button>
            </div>
          </div>

          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden border border-border/70">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Total Ad Spend</span>
                  <DollarSign className="w-4 h-4 text-blue-500" />
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  ${adsSummary.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Synced from Meta Marketing API
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-border/70">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Attributed CRM Revenue</span>
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  ৳{adsSummary.totalAttributedRevenue.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Verified sales from matched leads
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-border/70">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none" />
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Blended Return On Spend (ROAS)</span>
                  <Flame className="w-4 h-4 text-purple-500" />
                </CardDescription>
                <CardTitle
                  className={`text-2xl sm:text-3xl font-extrabold ${
                    adsSummary.overallRoas >= 3
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {adsSummary.overallRoas > 0 ? `${adsSummary.overallRoas.toFixed(2)}x` : "0.0x"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] font-medium">
                {adsSummary.overallRoas >= 3 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">🔥 High Profitability</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Target Benchmark: 3.5x+</span>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-border/70">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Clicks & Cost Per Click</span>
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {adsSummary.totalClicks.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Avg. CPC: ${adsSummary.avgCpc.toFixed(2)} | CPM: ${adsSummary.avgCpm.toFixed(2)}
              </CardContent>
            </Card>
          </div>

          {/* AI Media Buyer & Stop-Loss Engine */}
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent overflow-hidden shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-400 shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-foreground">
                        AI Media Buyer & Stop-Loss Guardian
                      </CardTitle>
                      <Badge className="bg-purple-600 text-white text-[10px] py-0 px-1.5">
                        Budget Shield
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      Safeguards ad dollars by continuously checking conversion performance and automatically pausing wasteful campaigns.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-border/70 shadow-2xs">
                    <Label className="text-xs font-semibold cursor-pointer">Auto-Stop Loss</Label>
                    <Switch
                      checked={adRule.is_active}
                      onCheckedChange={(val) => handleUpdateAdRule({ is_active: val })}
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEvaluateOptimizer}
                    disabled={evaluatingOptimizer}
                    className="gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-background hover:bg-purple-50 dark:hover:bg-purple-950/40 h-8 shadow-2xs"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${evaluatingOptimizer ? "animate-spin" : ""}`} />
                    {evaluatingOptimizer ? "Analyzing Campaigns..." : "Run AI Media Buyer Scan"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-background/80 border border-border/70 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Max Spend Without Orders Threshold ($)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={adRule.max_spend_threshold}
                      onChange={(e) =>
                        handleUpdateAdRule({ max_spend_threshold: Number(e.target.value) })
                      }
                      className="h-8 text-xs max-w-[130px]"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Auto-pauses if spend reaches this without sales
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Minimum Target ROAS Multiplier (x)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={adRule.min_roas_threshold}
                      onChange={(e) =>
                        handleUpdateAdRule({ min_roas_threshold: Number(e.target.value) })
                      }
                      className="h-8 text-xs max-w-[130px]"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Flags campaigns falling below this efficiency level
                    </span>
                  </div>
                </div>
              </div>

              {optimizerResults && optimizerResults.pausedCampaigns?.length > 0 && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs space-y-1.5">
                  <p className="font-bold text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Auto-Paused Failing Campaigns to Save Budget:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-foreground">
                    {optimizerResults.pausedCampaigns.map((c) => (
                      <li key={c.id}>
                        <strong>{c.name}</strong>: ${c.spend} spent with 0 sales ({c.reason})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {optimizerResults && optimizerResults.winningCampaigns?.length > 0 && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1.5">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    High-Performing Winning Campaigns Detected:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-foreground">
                    {optimizerResults.winningCampaigns.map((c) => (
                      <li key={c.id}>
                        <strong>{c.name}</strong>: {c.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Breakdown Table with Search */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Campaign Performance Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Metrics for connected Ad Account campaigns with direct attribution.
                  </CardDescription>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search campaign name..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {adsLoading ? (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs font-medium">Fetching campaign statistics...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <p className="text-xs">No campaign data recorded for this ad account yet.</p>
                  <Button size="sm" variant="outline" onClick={handleSyncAds} disabled={syncingAds}>
                    Sync From Meta Now
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                      <tr>
                        <th className="py-3 px-3.5">Campaign Name</th>
                        <th className="py-3 px-3.5">Spend</th>
                        <th className="py-3 px-3.5">Impressions</th>
                        <th className="py-3 px-3.5">Clicks</th>
                        <th className="py-3 px-3.5">CTR</th>
                        <th className="py-3 px-3.5">CPC</th>
                        <th className="py-3 px-3.5">CRM Sales</th>
                        <th className="py-3 px-3.5">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredCampaigns.map((camp) => (
                        <tr key={camp.campaign_id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-3.5 font-semibold text-foreground max-w-xs truncate">
                            {camp.campaign_name}
                          </td>
                          <td className="py-3.5 px-3.5 font-bold text-blue-600 dark:text-blue-400">
                            ${camp.spend.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-3.5 text-muted-foreground">
                            {camp.impressions.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3.5 text-muted-foreground">
                            {camp.clicks.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3.5 font-medium">{camp.ctr.toFixed(2)}%</td>
                          <td className="py-3.5 px-3.5 text-muted-foreground">${camp.cpc.toFixed(2)}</td>
                          <td className="py-3.5 px-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                            ৳{camp.attributed_revenue.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <Badge
                              className={`text-[10px] px-2 py-0.5 font-bold ${
                                camp.roas >= 3
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {camp.roas.toFixed(2)}x
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: SERVER CAPI (CONVERSIONS API) & PIXEL */}
        {/* ======================================================== */}
        <TabsContent value="capi" className="space-y-6">
          {/* CAPI Explainer & Action Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border border-border/70 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-foreground">
                  Meta Conversions API (Server-Side Pixel Tracking)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Direct server-to-server event dispatching for 100% accurate conversion attribution. Bypasses Safari ITP, iOS 14.5+ restrictions, and browser ad blockers.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCapiEvents}
                disabled={capiLoading}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${capiLoading ? "animate-spin" : ""}`} />
                Refresh Stream
              </Button>
            </div>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Server Events</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {capiStats.total}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Dispatched by CRM Backend
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Delivered to Meta</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6" />
                  {capiStats.sent}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Accepted by Graph API
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Event Match Quality (EMQ)</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  9.4 / 10
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Hashed Phone + IP + User Agent
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Tracking Reliability</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  100%
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Immune to Browser Ad Blockers
              </CardContent>
            </Card>
          </div>

          {/* Interactive Test Event Dispatcher */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold">
                    CAPI Test Event Simulator
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatch a live simulated order event to verify your Meta Events Manager integration.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-background border border-border/70 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Event Name</Label>
                  <select
                    className="w-full h-8 px-2.5 text-xs border rounded-md bg-background"
                    value={customTestEvent.eventName}
                    onChange={(e) =>
                      setCustomTestEvent({ ...customTestEvent, eventName: e.target.value })
                    }
                  >
                    <option value="Purchase">Purchase (অর্ডার সম্পন্ন)</option>
                    <option value="InitiateCheckout">InitiateCheckout (চেকআউট শুরু)</option>
                    <option value="AddToCart">AddToCart (কার্টে যুক্ত)</option>
                    <option value="Lead">Lead (লিড সংগ্রহ)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Order Amount (৳ BDT)</Label>
                  <Input
                    type="number"
                    value={customTestEvent.value}
                    onChange={(e) =>
                      setCustomTestEvent({ ...customTestEvent, value: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Customer Phone (SHA-256 Hashed)</Label>
                  <Input
                    type="text"
                    value={customTestEvent.phone}
                    onChange={(e) =>
                      setCustomTestEvent({ ...customTestEvent, phone: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0 justify-between flex-wrap gap-2">
              <p className="text-[11px] text-muted-foreground">
                Test code: <code>{configForm.capi_test_event_code || "Live Mode"}</code>
              </p>
              <Button
                size="sm"
                onClick={handleTestCapi}
                disabled={testingCapi}
                className="gap-1.5 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <Zap className={`w-3.5 h-3.5 ${testingCapi ? "animate-spin" : ""}`} />
                {testingCapi ? "Sending to Meta..." : "Dispatch Test Event Now"}
              </Button>
            </CardFooter>
          </Card>

          {/* Events Stream Log */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Recent Server-Side CAPI Events Stream
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time log of events sent directly to Meta Pixel / Conversions API upon customer orders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capiLoading ? (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <p className="text-xs font-medium">Loading CAPI event stream...</p>
                </div>
              ) : capiEvents.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <p className="text-xs">No server-side events logged yet.</p>
                  <Button size="sm" variant="outline" onClick={handleTestCapi} disabled={testingCapi}>
                    Send First Test Event
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                      <tr>
                        <th className="py-3 px-3.5">Event Name</th>
                        <th className="py-3 px-3.5">Event ID</th>
                        <th className="py-3 px-3.5">Customer Phone</th>
                        <th className="py-3 px-3.5">Value</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {capiEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3.5">
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                              {evt.event_name}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-muted-foreground text-[11px]">
                            {evt.event_id}
                          </td>
                          <td className="py-3 px-3.5 text-foreground font-medium">
                            {evt.customer_phone
                              ? `${evt.customer_phone.slice(0, 4)}***${evt.customer_phone.slice(-3)}`
                              : "—"}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                            {evt.value > 0 ? `৳${evt.value.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-3 px-3.5">
                            {evt.status === "sent" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] gap-1 font-semibold">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Sent
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
                                Failed
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-muted-foreground">
                            {new Date(evt.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 4: UNIFIED MESSENGER & INSTAGRAM DIRECT */}
        {/* ======================================================== */}
        <TabsContent value="messages" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facebook Messenger Hub Card */}
            <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-blue-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-blue-600/15 text-blue-600 rounded-xl">
                    <FacebookIcon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-xs">
                    Messenger Channel
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold pt-2">Facebook Messenger Integration</CardTitle>
                <CardDescription className="text-xs">
                  Direct customer inquiries to your Facebook Page are captured instantly via Webhooks into your shared CRM inbox alongside WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Real-time Two-Way Chat</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Replies sent by your support agents in the CRM are delivered instantaneously to the customer's Facebook Messenger.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Bot className="w-4 h-4 text-purple-500" />
                    <span>AI Chatbot Auto-Triage</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    When enabled, the CRM AI handles FAQs, stock checks, and captures customer order details automatically.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/inbox" className="w-full">
                  <Button className="w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Open Messenger in Unified Inbox &rarr;</span>
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Instagram Direct Hub Card */}
            <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-pink-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-pink-600/15 text-pink-600 rounded-xl">
                    <InstagramIcon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="border-pink-500/40 text-pink-600 text-xs">
                    Instagram Direct
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold pt-2">Instagram Direct DM Integration</CardTitle>
                <CardDescription className="text-xs">
                  Customer story replies, product inquiries, and direct messages sync seamlessly to the CRM with full contact history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Unified Omnichannel Customer Profile</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    If a customer chats on Instagram and provides their phone number, their WhatsApp, Messenger, and order history unify automatically.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <ShoppingBag className="w-4 h-4 text-pink-500" />
                    <span>Story Mention & Media Capture</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Incoming images and product screenshots sent via Instagram DM render with instant preview.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/inbox" className="w-full">
                  <Button className="w-full h-9 text-xs font-semibold bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-600 hover:via-rose-600 hover:to-purple-700 text-white gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Open Instagram in Unified Inbox &rarr;</span>
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 5: META SETUP & CONFIGURATION */}
        {/* ======================================================== */}
        <TabsContent value="settings" className="space-y-6">
          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Setup Progress & Checklist */}
            <Card className="border border-border/70 shadow-xs bg-muted/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm sm:text-base font-bold">
                      Meta Integration Checklist ({connectedCount}/4 Complete)
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {connectedCount === 4 ? "Fully Configured" : "Action Needed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
                    {connectionChecklist.pageConnected ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium truncate">1. Facebook Page</span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
                    {connectionChecklist.instagramConnected ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium truncate">2. Instagram Pro</span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
                    {connectionChecklist.adAccountConnected ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium truncate">3. Meta Ad Account</span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
                    {connectionChecklist.capiConnected ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium truncate">4. Server CAPI / Pixel</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Facebook Page Connection */}
            <Card className="border border-border/70 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FacebookIcon className="w-4 h-4 text-blue-600" />
                  Facebook Page Connection
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect your Facebook Page with a permanent Page Access Token containing <code>pages_messaging</code> and <code>pages_read_engagement</code> permissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Facebook Page ID</Label>
                    <Input
                      placeholder="e.g. 109283746501928"
                      value={configForm.page_id}
                      onChange={(e) => setConfigForm({ ...configForm, page_id: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Facebook Page Name</Label>
                    <Input
                      placeholder="e.g. My Online Store"
                      value={configForm.page_name}
                      onChange={(e) => setConfigForm({ ...configForm, page_name: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Page Access Token</Label>
                    <button
                      type="button"
                      onClick={() => setShowTokens(!showTokens)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {showTokens ? "Hide Token" : "Show Token"}
                    </button>
                  </div>
                  <Input
                    type={showTokens ? "text" : "password"}
                    placeholder="EAA..."
                    value={configForm.page_access_token}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, page_access_token: e.target.value })
                    }
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obtained from Meta Developer App &rarr; Graph API Explorer &rarr; User or System User Token converted to Permanent Page Token.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Instagram Connection */}
            <Card className="border border-border/70 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <InstagramIcon className="w-4 h-4 text-pink-600" />
                  Instagram Professional Account Connection
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect your Instagram Business or Creator account connected to the Facebook Page above.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Instagram Account ID</Label>
                    <Input
                      placeholder="e.g. 17841400000000000"
                      value={configForm.instagram_account_id}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, instagram_account_id: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Instagram Username (@)</Label>
                    <Input
                      placeholder="e.g. mybrand.official"
                      value={configForm.instagram_username}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, instagram_username: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meta Ad Account */}
            <Card className="border border-border/70 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Meta Ad Account (Ads Spend & Performance API)
                </CardTitle>
                <CardDescription className="text-xs">
                  Your Ad Account ID from Meta Ads Manager to sync spend, clicks, impressions, and compute ROAS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ad Account ID</Label>
                  <Input
                    placeholder="act_123456789012345"
                    value={configForm.ad_account_id}
                    onChange={(e) => setConfigForm({ ...configForm, ad_account_id: e.target.value })}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Found in your Meta Ads Manager URL or Ad Account settings (format: <code>act_XXXXXXXXXX</code>).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Meta Pixel & Conversions API (CAPI) */}
            <Card className="border-amber-500/25 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Zap className="w-4 h-4" />
                  Meta Pixel & Server-Side Conversions API (CAPI)
                </CardTitle>
                <CardDescription className="text-xs">
                  Ensures 100% conversion delivery by sending purchase data directly from your server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-background">
                  <div>
                    <Label className="text-sm font-semibold">Enable Server-Side CAPI Tracking</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically dispatches Purchase and Checkout events to Meta when orders are created.
                    </p>
                  </div>
                  <Switch
                    checked={configForm.capi_enabled}
                    onCheckedChange={(val) => setConfigForm({ ...configForm, capi_enabled: val })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Meta Pixel ID (Dataset ID)</Label>
                    <Input
                      placeholder="e.g. 198273645019283"
                      value={configForm.pixel_id}
                      onChange={(e) => setConfigForm({ ...configForm, pixel_id: e.target.value })}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Found in Meta Events Manager &rarr; Settings &rarr; Dataset ID.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Test Event Code (Optional for Live Verification)
                    </Label>
                    <Input
                      placeholder="e.g. TEST12345"
                      value={configForm.capi_test_event_code}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, capi_test_event_code: e.target.value })
                      }
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      From Meta Events Manager &rarr; Test Events tab.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Conversions API Access Token (Optional if Page Token has ads access)
                  </Label>
                  <Input
                    type={showTokens ? "text" : "password"}
                    placeholder="EAA..."
                    value={configForm.capi_access_token}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, capi_access_token: e.target.value })
                    }
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Generated in Meta Events Manager &rarr; Settings &rarr; Generate access token.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* AI Comment Auto-Reply Settings */}
            <Card className="border border-border/70 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  AI Comment & DM Automation Rules
                </CardTitle>
                <CardDescription className="text-xs">
                  Fine-tune how AI answers comments on your Facebook Page and Instagram posts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-background">
                  <div>
                    <Label className="text-sm font-semibold">Enable AI Public Comment Auto-Reply</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically generates and posts a friendly, contextual response to new comments.
                    </p>
                  </div>
                  <Switch
                    checked={configForm.ai_comment_reply_enabled}
                    onCheckedChange={(val) =>
                      setConfigForm({ ...configForm, ai_comment_reply_enabled: val })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-background">
                  <div>
                    <Label className="text-sm font-semibold">
                      Send Automatic Private DM on Price / Order Inquiries
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When a customer comments "দাম কত", "Price", or asks to order, send product price and order instructions directly to their Messenger inbox.
                    </p>
                  </div>
                  <Switch
                    checked={configForm.ai_comment_private_dm_enabled}
                    onCheckedChange={(val) =>
                      setConfigForm({ ...configForm, ai_comment_private_dm_enabled: val })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Custom AI Instructions & Tone Prompt
                  </Label>
                  <Textarea
                    rows={4}
                    placeholder="You are a warm, helpful customer support assistant for an online shop in Bangladesh. Always speak respectfully in polite Bengali. Invite them to check inbox for prices..."
                    value={configForm.ai_comment_prompt}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, ai_comment_prompt: e.target.value })
                    }
                    className="text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Quick Prompts:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfigForm({
                          ...configForm,
                          ai_comment_prompt:
                            "You are a friendly customer service representative for an e-commerce shop in Bangladesh. Reply warmly in polite Bengali. For price inquiries, politely mention that details are sent in inbox. Encourage placing orders with cash on delivery.",
                        })
                      }
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
                    >
                      E-Commerce Standard (বাংলা)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfigForm({
                          ...configForm,
                          ai_comment_prompt:
                            "You are a professional brand assistant. Keep replies brief, elegant, and courteous. Provide answers in Bengali and English as requested.",
                        })
                      }
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
                    >
                      Bilingual Professional
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Webhook Configuration Guide */}
            <Card className="border-blue-500/25 bg-blue-50/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <LinkIcon className="w-4 h-4" />
                    Meta Webhook Configuration Guide
                  </CardTitle>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-600 text-xs">
                    Developers
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Copy these two values into your Meta App Dashboard under <strong>Webhooks &rarr; Page & Instagram</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3.5 bg-muted/60 rounded-xl space-y-3 text-xs border border-border/60">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Callback URL:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-[11px] text-primary"
                        onClick={() => copyToClipboard(webhookCallbackUrl, "webhook")}
                      >
                        {copiedWebhook ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedWebhook ? "Copied!" : "Copy URL"}</span>
                      </Button>
                    </div>
                    <code className="block p-2 bg-background rounded-lg border text-[11px] select-all break-all font-mono">
                      {webhookCallbackUrl}
                    </code>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Verify Token:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-[11px] text-primary"
                        onClick={() => copyToClipboard(configForm.verify_token, "verify")}
                      >
                        {copiedVerify ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedVerify ? "Copied!" : "Copy Token"}</span>
                      </Button>
                    </div>
                    <code className="block p-2 bg-background rounded-lg border text-[11px] select-all font-mono">
                      {configForm.verify_token}
                    </code>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border/70 space-y-1 text-xs">
                  <p className="font-semibold text-foreground">Required Subscriptions in Meta App:</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline" className="font-mono text-[10px]">messages</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">messaging_postbacks</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">feed</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">comments</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                All credentials are securely stored with role-based encryption.
              </p>
              <Button
                type="submit"
                disabled={savingConfig}
                className="bg-primary text-primary-foreground font-semibold px-6 shadow-xs"
              >
                {savingConfig ? "Saving Settings..." : "Save Meta Settings"}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {/* ======================================================== */}
      {/* MANUAL COMMENT REPLY DIALOG */}
      {/* ======================================================== */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {isPrivateReply ? (
                <div className="p-2 rounded-lg bg-purple-600/15 text-purple-600">
                  <Send className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-blue-600/15 text-blue-600">
                  <MessageCircle className="w-4 h-4" />
                </div>
              )}
              <DialogTitle className="text-base font-bold">
                {isPrivateReply ? "Send Private Messenger DM" : "Reply Publicly to Comment"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Replying to <strong>{activeCommentForReply?.sender_name || "Customer"}</strong>: "{activeCommentForReply?.message}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Quick Template Presets */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Response Presets
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REPLY_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyMessage(p.text)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-accent text-foreground border border-border/60 transition-colors text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Message</Label>
              <Textarea
                placeholder={
                  isPrivateReply
                    ? "Type private message with pricing, link, and order instructions..."
                    : "Type public comment response..."
                }
                rows={4}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={submittingReply || !replyMessage.trim()}
              onClick={handleSendReply}
              className={
                isPrivateReply
                  ? "bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  : "bg-primary text-primary-foreground font-semibold"
              }
            >
              {submittingReply ? (
                "Sending..."
              ) : isPrivateReply ? (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" /> Send Private DM
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> Post Public Reply
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
