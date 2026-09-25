'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Star,
  StarOff,
  Phone,
  Pencil,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

const MASKED_TOKEN = '●●●●●●●●●●●●●●●●';

// Meta ids are decimal digit strings
const META_ID_RE = /^\d+$/;

type MetaErrorMeta = {
  code: number | null;
  subcode: number | null;
  fbtrace_id: string | null;
  step: string;
  field?: string | null;
  message?: string | null;
};

// A single saved WhatsApp phone number config row
type WaConfig = {
  id: string;
  phone_number_id: string;
  waba_id?: string;
  status: 'connected' | 'disconnected';
  label?: string | null;
  is_primary: boolean;
  registered_at?: string | null;
  subscribed_apps_at?: string | null;
  last_registration_error?: string | null;
  mirror_inbound_media?: boolean;
  connected_at?: string | null;
};

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

// Form state for adding/editing a number
type NumberForm = {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  verify_token: string;
  pin: string;
  label: string;
  is_primary: boolean;
  tokenEdited: boolean;
  showToken: boolean;
};

const emptyForm = (): NumberForm => ({
  phone_number_id: '',
  waba_id: '',
  access_token: '',
  verify_token: '',
  pin: '',
  label: '',
  is_primary: false,
  tokenEdited: false,
  showToken: false,
});

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const supabase = createClient();
  const {
    user,
    accountId,
    loading: authLoading,
    profileLoading,
    canEditSettings,
  } = useAuth();

  // --- Page-level state ---
  const [pageLoading, setPageLoading] = useState(true);
  const [configs, setConfigs] = useState<WaConfig[]>([]);
  // Top-level connection status (for the primary number)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [statusMessage, setStatusMessage] = useState('');

  // Which config row is being edited (null = add new)
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  // Form state for the add/edit panel
  const [form, setForm] = useState<NumberForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; meta: MetaErrorMeta | null } | null>(null);

  // Per-row pending actions
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  // Mirror media toggle per config id
  const [savingMirrorId, setSavingMirrorId] = useState<string | null>(null);

  // Label editing
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);

  // Registration verify
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadedAccountIdRef = useRef<string | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  // ─── Fetch all configs ───────────────────────────────────────────────────
  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.configs) {
        setConfigs(payload.configs as WaConfig[]);
      } else {
        setConfigs([]);
      }

      if (payload.connected) {
        setConnectionStatus('connected');
        setStatusMessage('');
      } else if (payload.configs && payload.configs.length === 0) {
        setConnectionStatus('disconnected');
        setStatusMessage('');
      } else {
        setConnectionStatus('disconnected');
        setStatusMessage(payload.message || '');
      }
    } catch (err) {
      console.error('fetchConfigs error:', err);
      toast.error(t('loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setPageLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    setPageLoading(true);
    fetchConfigs().finally(() => setPageLoading(false));
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfigs]);

  // ─── Start add new ───────────────────────────────────────────────────────
  function startAddNew() {
    const f = emptyForm();
    f.is_primary = configs.length === 0;
    setForm(f);
    setSaveError(null);
    setEditingId('new');
  }

  // ─── Start edit existing ─────────────────────────────────────────────────
  function startEdit(cfg: WaConfig) {
    setForm({
      phone_number_id: cfg.phone_number_id,
      waba_id: cfg.waba_id || '',
      access_token: MASKED_TOKEN,
      verify_token: '',
      pin: '',
      label: cfg.label || '',
      is_primary: cfg.is_primary,
      tokenEdited: false,
      showToken: false,
    });
    setSaveError(null);
    setEditingId(cfg.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setSaveError(null);
  }

  // ─── Save (add or update) ────────────────────────────────────────────────
  async function handleSave() {
    if (!form.phone_number_id.trim()) {
      toast.error(t('phoneNumberIdRequired'));
      return;
    }
    if (!META_ID_RE.test(form.phone_number_id.trim())) {
      toast.error(t('phoneNumberIdNotNumeric'));
      return;
    }
    if (form.waba_id.trim() && !META_ID_RE.test(form.waba_id.trim())) {
      toast.error(t('wabaIdNotNumeric'));
      return;
    }

    const isNew = editingId === 'new';

    if (!isNew && !form.tokenEdited) {
      toast.error(t('reenterAccessToken'));
      return;
    }
    if (isNew && !form.access_token.trim()) {
      toast.error(t('accessTokenRequired'));
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const body: Record<string, unknown> = {
        phone_number_id: form.phone_number_id.trim(),
        waba_id: form.waba_id.trim() || null,
        access_token: form.access_token.trim(),
        verify_token: form.verify_token.trim() || null,
        pin: form.pin.trim() || null,
        label: form.label.trim() || null,
        is_primary: form.is_primary,
      };
      if (!isNew) {
        body.id = editingId;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError({ message: data.error || t('saveFailed'), meta: data.meta ?? null });
        toast.error(data.error || t('saveFailed'), { duration: 10000 });
        return;
      }

      if (data.registration_error) {
        setSaveError({
          message: `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          meta: data.meta ?? null,
        });
        toast.error(t('savedButRegistrationFailed', { error: data.registration_error }), { duration: 12000 });
      } else if (data.registration_skipped) {
        toast.success(t('savedRegistrationSkipped'), { duration: 10000 });
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? t('liveWithName', { name: data.phone_info.verified_name })
            : t('connectedGeneric'),
        );
        setEditingId(null);
        setForm(emptyForm());
        setSaveError(null);
      }

      await fetchConfigs();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete a specific config row ────────────────────────────────────────
  async function handleDelete(cfg: WaConfig) {
    if (!confirm(`"${cfg.label || cfg.phone_number_id}" নম্বরটি সরিয়ে দেবেন?`)) return;
    setDeletingId(cfg.id);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cfg.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('resetFailed'));
        return;
      }
      toast.success('WhatsApp নম্বর সরানো হয়েছে');
      await fetchConfigs();
      if (editingId === cfg.id) cancelEdit();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('resetFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Set primary ─────────────────────────────────────────────────────────
  async function handleSetPrimary(cfg: WaConfig) {
    if (cfg.is_primary) return;
    setSettingPrimaryId(cfg.id);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cfg.id, is_primary: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      toast.success(`"${cfg.label || cfg.phone_number_id}" প্রাইমারি করা হয়েছে`);
      await fetchConfigs();
    } catch (err) {
      console.error('Set primary error:', err);
    } finally {
      setSettingPrimaryId(null);
    }
  }

  // ─── Toggle mirror media ─────────────────────────────────────────────────
  async function handleToggleMirror(cfg: WaConfig, next: boolean) {
    if (savingMirrorId) return;
    setSavingMirrorId(cfg.id);
    // Optimistic
    setConfigs(cs => cs.map(c => c.id === cfg.id ? { ...c, mirror_inbound_media: next } : c));
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cfg.id, mirror_inbound_media: next }),
      });
      if (!res.ok) {
        setConfigs(cs => cs.map(c => c.id === cfg.id ? { ...c, mirror_inbound_media: !next } : c));
        toast.error(t('mirrorInboundSaveFailed'));
      }
    } catch {
      setConfigs(cs => cs.map(c => c.id === cfg.id ? { ...c, mirror_inbound_media: !next } : c));
    } finally {
      setSavingMirrorId(null);
    }
  }

  // ─── Save label ──────────────────────────────────────────────────────────
  async function handleSaveLabel(cfg: WaConfig) {
    setSavingLabelId(cfg.id);
    try {
      await fetch('/api/whatsapp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cfg.id, label: labelDraft.trim() || null }),
      });
      setConfigs(cs => cs.map(c => c.id === cfg.id ? { ...c, label: labelDraft.trim() || null } : c));
      setEditingLabelId(null);
      toast.success('Label আপডেট হয়েছে');
    } catch { toast.error('Failed to update label'); }
    finally { setSavingLabelId(null); }
  }

  // ─── Verify registration ─────────────────────────────────────────────────
  async function handleVerify(cfg: WaConfig) {
    setVerifyingId(cfg.id);
    try {
      const res = await fetch(`/api/whatsapp/config/verify-registration?id=${cfg.id}`, { method: 'GET' });
      const data = await res.json();
      if (data.live) {
        toast.success(t('fullyWired'));
      } else {
        toast.error(t('notFullyRegistered'), { duration: 8000 });
      }
      await fetchConfigs();
    } catch {
      toast.error(t('verifyEndpointUnreachable'));
    } finally {
      setVerifyingId(null);
    }
  }

  // ─── Copy webhook URL ────────────────────────────────────────────────────
  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success(t('webhookCopied'));
  }

  // ─── Render helpers ──────────────────────────────────────────────────────
  const renderMetaDetails = (meta: MetaErrorMeta) => (
    <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground break-all">
      <p>
        {t('metaErrorStep')}: <code>{meta.step}</code>
        {meta.code !== null && meta.code !== undefined && (
          <>
            {' · '}
            {t('metaErrorCode')}:{' '}
            <code>
              {meta.code}
              {meta.subcode !== null && meta.subcode !== undefined ? `/${meta.subcode}` : ''}
            </code>
          </>
        )}
        {meta.fbtrace_id && (
          <>
            {' · '}
            {t('metaErrorTrace')}: <code>{meta.fbtrace_id}</code>
          </>
        )}
      </p>
      {meta.message && <p>{t('metaErrorMessage')}: {meta.message}</p>}
    </div>
  );

  if (pageLoading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead title={t('title')} description={t('description')} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  // ─── Number card ─────────────────────────────────────────────────────────
  const renderNumberCard = (cfg: WaConfig) => {
    const isDeleting = deletingId === cfg.id;
    const isSettingPrimary = settingPrimaryId === cfg.id;
    const isVerifying = verifyingId === cfg.id;
    const isSavingMirror = savingMirrorId === cfg.id;
    const isEditingLabel = editingLabelId === cfg.id;
    const isSavingLabel = savingLabelId === cfg.id;
    const mirrorMedia = cfg.mirror_inbound_media !== false;

    return (
      <Card key={cfg.id} className={`border-border ${cfg.is_primary ? 'border-primary/40 bg-primary/5' : ''}`}>
        <CardContent className="pt-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm text-foreground">{cfg.phone_number_id}</span>
              {cfg.is_primary && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                  Primary
                </Badge>
              )}
              {cfg.status === 'connected' ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-emerald-400 border-emerald-700/50">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-red-400 border-red-700/50">
                  Disconnected
                </Badge>
              )}
              {cfg.registered_at && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-emerald-400 border-emerald-700/50">
                  Registered
                </Badge>
              )}
            </div>

            {/* Action buttons */}
            {canEditSettings && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(cfg)}
                  title="Edit / Update credentials"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-amber-400"
                  onClick={() => handleSetPrimary(cfg)}
                  disabled={cfg.is_primary || isSettingPrimary}
                  title={cfg.is_primary ? 'Already primary' : 'Set as primary'}
                >
                  {isSettingPrimary ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : cfg.is_primary ? (
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  ) : (
                    <StarOff className="size-3.5" />
                  )}
                </Button>
                {configs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDelete(cfg)}
                    disabled={isDeleting}
                    title="Remove this number"
                  >
                    {isDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Label row */}
          <div className="flex items-center gap-2">
            {isEditingLabel ? (
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  placeholder="Label (e.g. Sales Line)"
                  className="h-7 text-xs bg-muted border-border text-foreground"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveLabel(cfg);
                    if (e.key === 'Escape') setEditingLabelId(null);
                  }}
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveLabel(cfg)} disabled={isSavingLabel}>
                  {isSavingLabel ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingLabelId(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground group"
                onClick={() => {
                  setLabelDraft(cfg.label || '');
                  setEditingLabelId(cfg.id);
                }}
              >
                <span>{cfg.label || 'Add label…'}</span>
                <Pencil className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          {/* Last registration error */}
          {cfg.last_registration_error && (
            <p className="text-xs text-amber-400">
              ⚠ Registration error: {cfg.last_registration_error}
            </p>
          )}

          {/* Per-number actions row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => handleVerify(cfg)}
              disabled={isVerifying}
            >
              {isVerifying ? <Loader2 className="size-3 animate-spin mr-1" /> : <Zap className="size-3 mr-1" />}
              {t('verifyWithMeta')}
            </Button>
          </div>

          {/* Media mirroring toggle */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
            <p className="text-xs text-muted-foreground">{t('mirrorInbound')}</p>
            <Switch
              checked={mirrorMedia}
              onCheckedChange={next => handleToggleMirror(cfg, next)}
              disabled={isSavingMirror || !canEditSettings}
              aria-label={t('mirrorInbound')}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── Add / Edit form ─────────────────────────────────────────────────────
  const renderForm = () => (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-base">
            {editingId === 'new' ? 'নতুন WhatsApp নম্বর যোগ করুন' : 'WhatsApp Credentials আপডেট করুন'}
          </CardTitle>
          <Button variant="ghost" size="icon" className="size-7" onClick={cancelEdit}>
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveError && (
          <Alert className="bg-red-950/30 border-red-700/50">
            <div className="flex items-start gap-3">
              <XCircle className="size-5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <AlertTitle className="text-red-200 mb-1">{t('lastSaveFailed')}</AlertTitle>
                <AlertDescription className="text-red-100/80 text-sm">{saveError.message}</AlertDescription>
                {saveError.meta && renderMetaDetails(saveError.meta)}
              </div>
            </div>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('phoneNumberId')}</Label>
            <Input
              placeholder={t('phoneNumberIdPlaceholder')}
              value={form.phone_number_id}
              onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('wabaId')}</Label>
            <Input
              placeholder={t('wabaIdPlaceholder')}
              value={form.waba_id}
              onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('accessToken')}</Label>
          <div className="relative">
            <Input
              type={form.showToken ? 'text' : 'password'}
              placeholder={t('accessTokenPlaceholder')}
              value={form.access_token}
              onChange={e => setForm(f => ({ ...f, access_token: e.target.value, tokenEdited: true }))}
              onFocus={() => {
                if (form.access_token === MASKED_TOKEN) {
                  setForm(f => ({ ...f, access_token: '', tokenEdited: true }));
                }
              }}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
            />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, showToken: !f.showToken }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {form.showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {editingId !== 'new' && !form.tokenEdited && (
            <p className="text-xs text-muted-foreground">{t('tokenHidden')}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('webhookVerifyToken')}</Label>
            <Input
              placeholder={t('webhookVerifyTokenPlaceholder')}
              value={form.verify_token}
              onChange={e => setForm(f => ({ ...f, verify_token: e.target.value }))}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t('twoStepPin')} <span className="ml-1 text-muted-foreground">{t('optional')}</span>
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder={t('pinPlaceholder')}
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground">Label (ঐচ্ছিক)</Label>
          <Input
            placeholder="যেমন: Sales Line, Customer Support..."
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {configs.length > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Switch
              checked={form.is_primary}
              onCheckedChange={v => setForm(f => ({ ...f, is_primary: v }))}
              id="is_primary_form"
            />
            <label htmlFor="is_primary_form" className="text-sm text-foreground cursor-pointer">
              এই নম্বরটি Primary (default) হিসেবে সেট করুন
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              editingId === 'new' ? 'নম্বর যোগ করুন' : 'আপডেট করুন'
            )}
          </Button>
          <Button variant="outline" onClick={cancelEdit} className="border-border text-muted-foreground hover:text-foreground hover:bg-muted">
            বাতিল
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead title={t('title')} description={t('description')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">

          {/* Overall connection status summary */}
          <Alert className="bg-card border-border">
            <div className="flex items-center gap-2">
              {configs.length > 0 && connectionStatus === 'connected' ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <XCircle className="size-4 text-red-500" />
              )}
              <AlertTitle className="text-foreground mb-0">
                {configs.length === 0
                  ? 'কোনো WhatsApp নম্বর সংযুক্ত নেই'
                  : connectionStatus === 'connected'
                  ? `${configs.length}টি WhatsApp নম্বর সংযুক্ত`
                  : t('notConnected')}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground">
              {configs.length === 0
                ? 'নিচে "নতুন নম্বর যোগ করুন" বাটনে ক্লিক করে প্রথম WhatsApp নম্বর সংযুক্ত করুন।'
                : statusMessage || t('connectedDesc')}
            </AlertDescription>
          </Alert>

          {/* Connected numbers list */}
          {configs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">সংযুক্ত WhatsApp নম্বরসমূহ</h3>
              {configs.map(cfg => renderNumberCard(cfg))}
            </div>
          )}

          {/* Add/Edit form */}
          {editingId !== null && renderForm()}

          {/* Add new button (only when not already in add mode) */}
          {editingId === null && canEditSettings && (
            <Button
              variant="outline"
              onClick={startAddNew}
              className="border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted w-full"
            >
              <Plus className="size-4 mr-2" />
              নতুন WhatsApp নম্বর যোগ করুন
            </Button>
          )}

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">{t('webhookTitle')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('webhookDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('webhookUrl')}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted border-border text-muted-foreground font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  এই URL টি সব WhatsApp নম্বরের জন্য একই — Meta-তে প্রতিটি নম্বরের webhook হিসেবে এটি ব্যবহার করুন।
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Danger zone — only show if there are configs to reset */}
          {configs.length > 0 && canEditSettings && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                কোনো নম্বর সরাতে নম্বর কার্ডের উপর Trash আইকনে ক্লিক করুন।
                সম্পূর্ণ configuration মুছতে প্রতিটি নম্বর আলাদাভাবে সরান।
              </p>
            </div>
          )}
        </div>

        {/* Setup Instructions Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base">{t('setupInstructions')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('setupInstructionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                      {t('step1')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li dangerouslySetInnerHTML={{ __html: t('step1_1') }} />
                      <li>{t('step1_2')}</li>
                      <li>{t('step1_3')}</li>
                      <li>{t('step1_4')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      {t('step2')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step2_1')}</li>
                      <li>{t('step2_2')}</li>
                      <li>{t('step2_3')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                      {t('step3')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step3_1')}</li>
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_2') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_3') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_4') }} />
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                      {t('step4')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step4_1')}</li>
                      <li>{t('step4_2')}</li>
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step4_3') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step4_4') }} />
                      <li>{t('step4_5')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">
                  <strong>Multiple Numbers:</strong> প্রতিটি WhatsApp নম্বরের জন্য একই Webhook URL ব্যবহার করুন।
                  System স্বয়ংক্রিয়ভাবে <code>phone_number_id</code> দিয়ে নম্বর আলাদা করে।
                </p>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  {t('metaDocs')}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
