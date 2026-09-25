'use client';

import { useEffect, useState } from 'react';
import { Shuffle, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export function AutoAssignCard() {
  const { accountId, canEditSettings } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    const fetchSettings = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('accounts')
          .select('auto_assign_enabled, auto_assign_online_only')
          .eq('id', accountId)
          .maybeSingle();

        if (error) {
          console.error('[AutoAssignCard] fetch error:', error);
          return;
        }

        if (data) {
          setEnabled(data.auto_assign_enabled ?? true);
          setOnlineOnly(data.auto_assign_online_only ?? false);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, [accountId]);

  const updateSetting = async (field: 'auto_assign_enabled' | 'auto_assign_online_only', value: boolean) => {
    if (!accountId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('accounts')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) {
        toast.error('Failed to update auto-assignment settings');
        return;
      }

      if (field === 'auto_assign_enabled') {
        setEnabled(value);
      } else {
        setOnlineOnly(value);
      }
      toast.success('Assignment settings updated');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = canEditSettings;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Shuffle className="size-4 text-primary" />
          Auto Chat Assignment (Round-Robin)
        </CardTitle>
        <CardDescription>
          Automatically route and balance incoming WhatsApp conversations among active team agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading settings…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Enable Round-Robin Assignment
                </p>
                <p className="text-xs text-muted-foreground">
                  Incoming chats without an assigned agent will be automatically distributed evenly across team members.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <Switch
                  checked={enabled}
                  onCheckedChange={(val) => void updateSetting('auto_assign_enabled', val)}
                  disabled={saving || !canEdit}
                  aria-label="Enable Round-Robin Assignment"
                />
              </div>
            </div>

            {enabled && (
              <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Assign to Online Agents First
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Prioritize team members who are currently online and active on the dashboard.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={onlineOnly}
                    onCheckedChange={(val) => void updateSetting('auto_assign_online_only', val)}
                    disabled={saving || !canEdit}
                    aria-label="Assign to Online Agents First"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
