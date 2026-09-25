'use client';

import { useState, useEffect } from 'react';
import { Truck, Check, Loader2, KeyRound, Copy, Radio, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CourierProvider } from '@/lib/courier/types';

interface CourierConfigRow {
  provider: CourierProvider;
  is_active: boolean;
  api_key_masked?: string;
  secret_key_masked?: string;
  metadata?: Record<string, unknown> | null;
}

export function CourierSettings() {
  const [activeTab, setActiveTab] = useState<CourierProvider>('steadfast');
  const [configs, setConfigs] = useState<Record<string, CourierConfigRow>>({});
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Pathao specific state
  const [pathaoUsername, setPathaoUsername] = useState('');
  const [pathaoPassword, setPathaoPassword] = useState('');
  const [pathaoStoreId, setPathaoStoreId] = useState('');
  const [pathaoIsSandbox, setPathaoIsSandbox] = useState(false);
  const [pathaoStores, setPathaoStores] = useState<Array<{ store_id: number; store_name: string; store_address: string; is_default_store?: boolean | number }>>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/courier/config');
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, CourierConfigRow> = {};
      for (const c of data.configs || []) {
        map[c.provider] = c;
      }
      setConfigs(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfigs();
  }, []);

  // When switching tabs, load the existing masked keys
  useEffect(() => {
    const current = configs[activeTab];
    if (current) {
      setApiKey('');
      setSecretKey('');
      setIsActive(current.is_active);

      if (activeTab === 'pathao') {
        const meta = (current.metadata as Record<string, unknown>) || {};
        setPathaoUsername(typeof meta.username === 'string' ? meta.username : '');
        setPathaoPassword('');
        setPathaoStoreId(meta.store_id ? String(meta.store_id) : '');
        setPathaoIsSandbox(Boolean(meta.is_sandbox));
      }
    } else {
      setApiKey('');
      setSecretKey('');
      setIsActive(true);

      if (activeTab === 'pathao') {
        setPathaoUsername('');
        setPathaoPassword('');
        setPathaoStoreId('');
        setPathaoIsSandbox(false);
      }
    }
  }, [activeTab, configs]);

  const [testingBalance, setTestingBalance] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const handleCheckBalance = async () => {
    setTestingBalance(true);
    try {
      const res = await fetch(`/api/courier/balance?provider=${activeTab}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to check balance / verify connection');
        return;
      }
      setBalance(data.balance);
      toast.success(`Connection verified! Current balance: ৳${data.balance}`);
    } catch {
      toast.error('Network error checking courier balance');
    } finally {
      setTestingBalance(false);
    }
  };

  const handleLoadPathaoStores = async () => {
    setLoadingStores(true);
    try {
      const res = await fetch('/api/courier/pathao/stores');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch Pathao stores. Make sure credentials are saved first.');
        return;
      }
      setPathaoStores(data.stores || []);
      if (data.stores?.length) {
        toast.success(`Found ${data.stores.length} store(s) in your Pathao account!`);
      } else {
        toast.info('No stores found in this Pathao account.');
      }
    } catch {
      toast.error('Network error loading stores from Pathao');
    } finally {
      setLoadingStores(false);
    }
  };

  const handleFillPathaoSandbox = () => {
    setApiKey('7N1aMJQbWm');
    setSecretKey('wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39');
    setPathaoUsername('test@pathao.com');
    setPathaoPassword('lovePathao');
    setPathaoIsSandbox(true);
    toast.info('Filled Pathao Sandbox test credentials. Click Save to activate.');
  };

  const handleSave = async () => {
    if (!apiKey.trim() && !configs[activeTab]?.api_key_masked) {
      toast.error('Client ID / API Key is required');
      return;
    }

    setSaving(true);
    try {
      const metadata = activeTab === 'pathao' ? {
        username: pathaoUsername.trim(),
        password: pathaoPassword ? pathaoPassword.trim() : undefined,
        store_id: pathaoStoreId ? Number(pathaoStoreId) : undefined,
        is_sandbox: pathaoIsSandbox,
      } : undefined;

      const res = await fetch('/api/courier/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeTab,
          api_key: apiKey.trim() || undefined,
          secret_key: secretKey.trim() || undefined,
          is_active: isActive,
          metadata,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save courier credentials');
        return;
      }

      toast.success(`${activeTab.toUpperCase()} configuration saved`);
      await fetchConfigs();
    } catch {
      toast.error('Network error saving courier settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Truck className="size-5 text-primary" />
          Courier Logistics Integrations (বাংলাদেশ কুরিয়ার সার্ভিস)
        </CardTitle>
        <CardDescription>
          Connect your Steadfast, Pathao, RedX, or Paperfly courier API credentials to book parcels and send tracking links directly from chats.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as CourierProvider)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="steadfast">Steadfast</TabsTrigger>
            <TabsTrigger value="pathao">Pathao</TabsTrigger>
            <TabsTrigger value="redx">RedX</TabsTrigger>
            <TabsTrigger value="paperfly">Paperfly</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4 rounded-lg border border-border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {activeTab} Courier API
                </p>
                <p className="text-xs text-muted-foreground">
                  Status:{' '}
                  {configs[activeTab]?.api_key_masked ? (
                    <span className="text-emerald-500 font-medium">Configured ({configs[activeTab].api_key_masked})</span>
                  ) : (
                    <span className="text-amber-500 font-medium">Not configured</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle" className="text-xs">Active</Label>
                <Switch
                  id="active-toggle"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            {activeTab === 'pathao' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Pathao Environment</p>
                    <p className="text-[11px] text-muted-foreground">
                      {pathaoIsSandbox
                        ? 'Sandbox (courier-api-sandbox.pathao.com)'
                        : 'Live Production (api-hermes.pathao.com)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleFillPathaoSandbox}
                      className="text-[11px] h-7 text-primary hover:underline"
                    >
                      Fill Test Sandbox Credentials
                    </Button>
                    <Label htmlFor="sandbox-toggle" className="text-xs">Sandbox</Label>
                    <Switch
                      id="sandbox-toggle"
                      checked={pathaoIsSandbox}
                      onCheckedChange={setPathaoIsSandbox}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pathao-client-id">Client ID *</Label>
                    <Input
                      id="pathao-client-id"
                      type="text"
                      placeholder={
                        configs.pathao?.api_key_masked
                          ? `Leave blank to keep (${configs.pathao.api_key_masked})`
                          : 'e.g. openYMpd7A'
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pathao-client-secret">Client Secret *</Label>
                    <Input
                      id="pathao-client-secret"
                      type="password"
                      placeholder={
                        configs.pathao?.secret_key_masked
                          ? 'Leave blank to keep existing'
                          : 'Enter Client Secret'
                      }
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pathao-username">Pathao Login Email (Username) *</Label>
                    <Input
                      id="pathao-username"
                      type="email"
                      placeholder="e.g. merchant@yourstore.com"
                      value={pathaoUsername}
                      onChange={(e) => setPathaoUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pathao-password">Pathao Password *</Label>
                    <Input
                      id="pathao-password"
                      type="password"
                      placeholder="Enter Pathao login password"
                      value={pathaoPassword}
                      onChange={(e) => setPathaoPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pathao-store">Pickup Store ID</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={handleLoadPathaoStores}
                      disabled={loadingStores}
                      className="text-xs h-6 p-0 text-primary"
                    >
                      {loadingStores ? (
                        <>
                          <Loader2 className="mr-1 size-3 animate-spin" />
                          Fetching Stores...
                        </>
                      ) : (
                        'Fetch Stores from Pathao'
                      )}
                    </Button>
                  </div>

                  {pathaoStores.length > 0 ? (
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={pathaoStoreId}
                      onChange={(e) => setPathaoStoreId(e.target.value)}
                    >
                      <option value="">-- Select Store --</option>
                      {pathaoStores.map((store) => (
                        <option key={store.store_id} value={store.store_id}>
                          {store.store_name} (ID: {store.store_id}) - {store.store_address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="pathao-store"
                      type="text"
                      placeholder="Store ID (or click 'Fetch Stores from Pathao')"
                      value={pathaoStoreId}
                      onChange={(e) => setPathaoStoreId(e.target.value)}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="courier-key">API Key *</Label>
                  <Input
                    id="courier-key"
                    type="password"
                    placeholder={
                      configs[activeTab]?.api_key_masked
                        ? `Leave blank to keep (${configs[activeTab].api_key_masked})`
                        : 'Enter your Courier API Key'
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                {activeTab === 'steadfast' && (
                  <div className="space-y-1">
                    <Label htmlFor="courier-secret">Secret Key (Optional)</Label>
                    <Input
                      id="courier-secret"
                      type="password"
                      placeholder={
                        configs[activeTab]?.secret_key_masked
                          ? `Leave blank to keep existing`
                          : 'Enter Secret Key if required'
                      }
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              {activeTab === 'pathao' && configs.pathao?.api_key_masked ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadPathaoStores}
                    disabled={loadingStores}
                    className="text-xs"
                  >
                    {loadingStores ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Truck className="mr-1.5 size-3.5" />
                    )}
                    Test Connection & Load Stores
                  </Button>
                </div>
              ) : activeTab === 'steadfast' && configs.steadfast?.api_key_masked ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckBalance}
                    disabled={testingBalance}
                    className="text-xs"
                  >
                    {testingBalance ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Truck className="mr-1.5 size-3.5" />
                    )}
                    Test Connection & Balance
                  </Button>
                  {balance !== null && (
                    <span className="text-xs font-semibold text-emerald-500">
                      Balance: ৳{balance.toLocaleString()}
                    </span>
                  )}
                </div>
              ) : (
                <div />
              )}

              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save {activeTab.toUpperCase()} Credentials
              </Button>
            </div>

            {/* Real-time Courier Webhook Sync Card */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="size-4 text-emerald-500 animate-pulse" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Real-Time Webhook Auto-Synchronization
                </h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Connect webhooks in your {activeTab.toUpperCase()} merchant portal to automatically receive parcel tracking steps, mark orders as Delivered/Returned in real time, auto-restock inventory, and send delivery confirmations to customers.
              </p>

              <div className="rounded-lg border border-border bg-background p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      {activeTab.toUpperCase()} Webhook Callback URL:
                    </Label>
                    <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                      <ShieldCheck className="size-3.5" /> Endpoint Active
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${origin || 'https://your-domain.com'}/api/webhooks/${activeTab}`}
                      className="font-mono text-xs bg-muted/50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopy(
                          `${origin || 'https://your-domain.com'}/api/webhooks/${activeTab}`,
                          'Webhook URL'
                        )
                      }
                      className="gap-1.5 text-xs h-9 shrink-0"
                    >
                      <Copy className="size-3.5" />
                      {copiedText === 'Webhook URL' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                {activeTab === 'pathao' ? (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold">
                      Pathao Webhook Secret (X-Pathao-Merchant-Webhook-Integration-Secret):
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value="f3992ecc-59da-4cbe-a049-a13da2018d51"
                        className="font-mono text-xs bg-muted/50"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy('f3992ecc-59da-4cbe-a049-a13da2018d51', 'Webhook Secret')
                        }
                        className="gap-1.5 text-xs h-9 shrink-0"
                      >
                        <Copy className="size-3.5" />
                        {copiedText === 'Webhook Secret' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1">
                      💡 Pathao automatically tests your URL with an integration handshake and expects HTTP 202. Our server is pre-configured to pass this test instantly.
                    </p>
                  </div>
                ) : activeTab === 'steadfast' ? (
                  <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                    <p>
                      💡 <strong>Steadfast Webhook Setup:</strong> Paste this Callback URL in your Steadfast Portal (Settings → API / Webhook). Steadfast will send <code className="text-foreground">delivery_status</code> and <code className="text-foreground">tracking_update</code> events with HMAC-SHA256 signature.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
