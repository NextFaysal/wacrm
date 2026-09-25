'use client';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.error('[PWA] Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    // Wait until service worker is active
    await navigator.serviceWorker.ready;

    // Fetch public VAPID key
    const res = await fetch('/api/notifications/push-subscription');
    if (!res.ok) return false;
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    // Check existing subscription
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const appServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
    }

    // Send subscription to server
    const subJson = subscription.toJSON();
    const saveRes = await fetch('/api/notifications/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subJson),
    });

    return saveRes.ok;
  } catch (err) {
    console.error('[PWA] Failed to subscribe to push notifications:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await fetch('/api/notifications/push-subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });

    return true;
  } catch (err) {
    console.error('[PWA] Failed to unsubscribe from push:', err);
    return false;
  }
}
