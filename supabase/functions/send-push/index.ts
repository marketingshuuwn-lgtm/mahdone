/**
 * Edge Function: send-push
 * Web Push + CORS preflight (OPTIONS).
 * متوافق مع Deno على Supabase Edge.
 *
 * أمان: يتطلب JWT صالح (anon / authenticated / service_role)
 * قبل أي إرسال — يمنع استدعاء الرابط بدون مفتاح.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'https://esm.sh/web-push@3.6.7?target=denonext';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * يستخرج Bearer token ويتحقق أنه JWT صادر من مشروع Supabase الحالي.
 * يقبل: جلسة مستخدم، anon key كـ JWT، أو service_role (للـ cron).
 */
async function assertValidJwt(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Missing Authorization Bearer token' }, 401),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Empty Bearer token' }, 401),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Server misconfigured (URL/ANON)' }, 500),
    };
  }

  // استدعاء من pg_cron / داخلي بمفتاح service_role
  if (serviceKey && token === serviceKey) {
    return { ok: true };
  }

  // تحقق التوقيع والمصدر عبر Supabase Auth
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data?.user) {
    return { ok: true };
  }

  // anon key نفسه JWT صالح يُستخدم من الواجهة (usePushNotifications)
  // نتحقق أنه يطابق مفتاح المشروع دون كشف محتواه في الرد
  if (token === anonKey) {
    return { ok: true };
  }

  // محاولة decode بسيطة: رفض واضح إن فشل كل شيء
  return {
    ok: false,
    response: jsonResponse(
      { error: 'Invalid or expired token', detail: error?.message || 'auth failed' },
      401,
    ),
  };
}

Deno.serve(async (req: Request) => {
  // Preflight — ضروري قبل أي منطق
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await assertValidJwt(req);
  if (!auth.ok) return auth.response;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: secrets, error: secretsErr } = await supabase
      .from('app_secrets')
      .select('key, value');

    if (secretsErr) {
      return jsonResponse({ error: 'app_secrets: ' + secretsErr.message }, 500);
    }

    const secretMap: Record<string, string> = {};
    for (const row of secrets || []) {
      if (row?.key) secretMap[row.key] = row.value;
    }

    const publicKey =
      secretMap.vapid_public_key ||
      secretMap.VAPID_PUBLIC_KEY ||
      secretMap.vapidPublicKey;
    const privateKey =
      secretMap.vapid_private_key ||
      secretMap.VAPID_PRIVATE_KEY ||
      secretMap.vapidPrivateKey;
    const subject =
      secretMap.vapid_subject ||
      secretMap.VAPID_SUBJECT ||
      'mailto:admin@mahd.app';

    if (!publicKey || !privateKey) {
      return jsonResponse(
        {
          error:
            'VAPID keys missing. أضف vapid_public_key و vapid_private_key في جدول app_secrets',
          foundKeys: Object.keys(secretMap),
        },
        500,
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    let payload: { type?: string; title?: string; body?: string } = {};
    try {
      const text = await req.text();
      if (text) payload = JSON.parse(text);
    } catch {
      payload = {};
    }

    const title = payload.title || 'مهد';
    const body =
      payload.body ||
      (payload.type === 'morning'
        ? 'ملخص مهام اليوم'
        : payload.type === 'evening'
        ? 'مراجعة مهام اليوم والمتأخر'
        : 'إشعار من مهد');

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (subsErr) {
      return jsonResponse({ error: 'push_subscriptions: ' + subsErr.message }, 500);
    }

    const list = subs || [];
    let sent = 0;
    const errors: string[] = [];

    const message = JSON.stringify({
      title,
      body,
      type: payload.type || 'custom',
    });

    for (const sub of list) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message,
        );
        sent += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg.slice(0, 200));
        if (/\b410\b|\b404\b|Gone|Not Found/i.test(msg)) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }

    return jsonResponse({
      ok: true,
      sent,
      total: list.length,
      errors: errors.slice(0, 5),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-push fatal:', message);
    return jsonResponse({ error: message }, 500);
  }
});
