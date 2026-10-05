'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Check,
  ChevronsUpDown,
  Plus,
  Loader2,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface StoreItem {
  id: string;
  name: string;
  currency: string;
  logoUrl?: string | null;
  isCurrent: boolean;
  role: string;
}

export function StoreSwitcher() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creatingStore, setCreatingStore] = useState(false);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch('/api/account/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const currentStore = stores.find((s) => s.isCurrent) || stores[0];

  const handleSwitchStore = async (targetAccountId: string) => {
    if (targetAccountId === currentStore?.id) return;
    try {
      setSwitching(true);
      const res = await fetch('/api/account/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`স্টোরে পরিবর্তন করা হয়েছে: ${data.switchedTo?.name || ''}`);
        // Reload page to rehydrate all context cleanly
        window.location.reload();
      } else {
        toast.error(data.error || 'স্টোর পরিবর্তন করা যায়নি');
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      toast.error('স্টোরের নাম দিন');
      return;
    }
    try {
      setCreatingStore(true);
      const res = await fetch('/api/account/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: newStoreName.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`নতুন স্টোর তৈরি হয়েছে: ${data.store?.name}`);
        setNewStoreModalOpen(false);
        window.location.reload();
      } else {
        toast.error(data.error || 'স্টোর তৈরি করা যায়নি');
      }
    } catch {
      toast.error('সার্ভার ত্রুটি');
    } finally {
      setCreatingStore(false);
    }
  };

  if (loading || !currentStore) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 text-xs text-muted-foreground animate-pulse">
        <Store className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">স্টোর লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted/80 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-all focus:outline-none shadow-xs">
          <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Store className="w-3 h-3" />
          </div>
          <span className="max-w-[110px] sm:max-w-[160px] truncate text-left">
            {currentStore.name}
          </span>
          {switching ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-0.5" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 text-muted-foreground ml-0.5" />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
            আমার স্টোর / ওয়ার্কস্পেস
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {stores.map((store) => (
            <DropdownMenuItem
              key={store.id}
              onClick={() => handleSwitchStore(store.id)}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className={`truncate ${store.isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                  {store.name}
                </span>
              </div>
              {store.isCurrent && (
                <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setNewStoreModalOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-primary hover:text-primary font-semibold cursor-pointer rounded-lg hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ নতুন স্টোর / ব্র্যান্ড যোগ করুন</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create New Store Modal */}
      <Dialog open={newStoreModalOpen} onOpenChange={setNewStoreModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" /> নতুন স্টোর / ব্র্যান্ড তৈরি করুন
            </DialogTitle>
            <DialogDescription className="text-xs">
              একই ড্যাশবোর্ড থেকে একাধিক ব্র্যান্ড বা ফেসবুক পেজের কাস্টমার ও অর্ডার পরিচালনা করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">স্টোর বা ব্র্যান্ডের নাম</Label>
              <Input
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="যেমন: Watch Gallery BD বা Clothing Hub"
                className="mt-1 text-xs"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              * নতুন স্টোর তৈরি হলে সাথে সাথে আলাদা ইনভেন্টরি, কুরিয়ার ও পেমেন্ট কনফিগারেশন তৈরি হবে।
            </p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewStoreModalOpen(false)}
            >
              বাতিল
            </Button>
            <Button
              size="sm"
              onClick={handleCreateStore}
              disabled={creatingStore || !newStoreName.trim()}
              className="bg-primary hover:bg-primary/90 gap-1.5"
            >
              {creatingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              স্টোর তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
