import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// مفتاح VAPID العام — آمن أن يكون ظاهراً بالكود، هذا استخدامه المقصود
// (عكس المفتاح الخاص المخزّن فقط بقاعدة البيانات خلف صلاحيات service_role)
const VAPID_PUBLIC_KEY =
  'BPGe3n5Bg6kVuK2etDlpXWnw-7hXFYS3ACXE9RZ2F8sfQ5hPBFIZOpwSIzhwPd7SWHJQRNsoq4702fcoT5YITCQ';

const EDGE_FUNCTION_URL = 'https://xrkkufrjwyfgrdscxgrq.supabase.co/functions/v1/send-push';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(showToast) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) {
      showToast?.('متصفحك لا يدعم إشعارات Web Push', 'ph-warning', 'error');
      return;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showToast?.('تم رفض إذن الإشعارات', 'ph-warning', 'error');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          device_label: navigator.userAgent.slice(0, 120),
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error(error);
        showToast?.('تعذّر حفظ الاشتراك بالإشعارات', 'ph-x-circle', 'error');
        setLoading(false);
        return;
      }

      setSubscribed(true);
      showToast?.('تم تفعيل إشعارات Web Push على هذا الجهاز', 'ph-bell-ringing');
    } catch (err) {
      console.error(err);
      showToast?.('حدث خطأ أثناء تفعيل الإشعارات', 'ph-x-circle', 'error');
    }
    setLoading(false);
  }, [supported, showToast]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      showToast?.('تم إيقاف إشعارات Web Push على هذا الجهاز', 'ph-bell-slash');
    } catch (err) {
      console.error(err);
      showToast?.('تعذّر إيقاف الإشعارات', 'ph-x-circle', 'error');
    }
    setLoading(false);
  }, [showToast]);

  const sendTestPush = useCallback(async () => {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          type: 'custom',
          title: 'تجربة إشعار 🔔',
          body: 'إذا وصلتك هذي الرسالة، الإشعارات شغّالة تمام!',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        showToast?.(json.error || 'فشل إرسال إشعار تجريبي', 'ph-x-circle', 'error');
        return;
      }
      showToast?.(`أُرسل الإشعار لـ ${json.sent} جهاز`, 'ph-paper-plane-tilt');
    } catch (err) {
      console.error(err);
      showToast?.('تعذّر إرسال إشعار تجريبي', 'ph-x-circle', 'error');
    }
  }, [showToast]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe, sendTestPush };
}
