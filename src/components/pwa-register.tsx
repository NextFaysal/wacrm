'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { registerServiceWorker, subscribeToPush } from '@/lib/notifications/push-client';
import { readBrowserNotifyPref } from '@/lib/notifications/browser-notify';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    void registerServiceWorker();

    // 2. If browser notification preference is already ON, ensure push subscription is active
    if (readBrowserNotifyPref() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void subscribeToPush();
    }

    // 3. Listen for PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user dismissed it recently
      const dismissed = sessionStorage.getItem('pwa_install_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowInstallBanner(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa_install_dismissed', '1');
  };

  if (!showInstallBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-lg md:left-auto md:right-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
          WA
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Install WhatsApp CRM</p>
          <p className="text-xs text-muted-foreground">Add to home screen for fast access & alerts</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8 px-2">
          Later
        </Button>
        <Button size="sm" onClick={handleInstallClick} className="text-xs h-8 gap-1.5">
          <Download className="size-3.5" />
          Install
        </Button>
      </div>
    </div>
  );
}
