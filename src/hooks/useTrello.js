import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  mapTrelloCardToTaskFields,
  trelloFetchMyOpenCards,
  trelloTestConnection,
} from '../lib/trello';
import { TRELLO_WORKSPACE_ID } from '../utils/taskMeta';

const PROVIDER = 'trello';
const DEFAULT_QUADRANT = 'important-not-urgent';
/** مفاتيح تريلو محلياً فقط — لا تُحفظ في جدول integrations المفتوح بـ anon */
const CREDS_KEY = 'mahd_trello_creds_v1';

function readLocalCreds() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.api_key || !parsed?.access_token) return null;
    return {
      api_key: String(parsed.api_key),
      access_token: String(parsed.access_token),
    };
  } catch {
    return null;
  }
}

function writeLocalCreds(apiKey, accessToken) {
  localStorage.setItem(
    CREDS_KEY,
    JSON.stringify({
      api_key: apiKey,
      access_token: accessToken,
      saved_at: new Date().toISOString(),
    })
  );
}

function clearLocalCreds() {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // ignore
  }
}

export function useTrello(showToast, onSynced) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [member, setMember] = useState(null);

  const loadConfig = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const local = readLocalCreds();

      const { data, error } = await supabase
        .from('integrations')
        .select('id, provider, settings, last_sync_at, created_at, updated_at')
        .eq('provider', PROVIDER)
        .maybeSingle();

      if (error) throw error;

      if (local) {
        setConfig({
          ...(data || { provider: PROVIDER }),
          api_key: local.api_key,
          access_token: local.access_token,
        });
      } else {
        setConfig(data ? { ...data, api_key: null, access_token: null } : null);
      }
    } catch (err) {
      console.error(err);
      const local = readLocalCreds();
      setConfig(
        local
          ? { provider: PROVIDER, api_key: local.api_key, access_token: local.access_token }
          : null
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveCredentials = useCallback(
    async (apiKey, accessToken) => {
      const key = apiKey.trim();
      const token = accessToken.trim();

      try {
        const me = await trelloTestConnection(key, token);
        setMember(me);

        // الأسرار محلياً فقط
        writeLocalCreds(key, token);

        // في القاعدة: بيانات تعريفية بلا مفاتيح
        const meta = {
          provider: PROVIDER,
          api_key: null,
          access_token: null,
          settings: { member_id: me.id || null, username: me.username || null },
          updated_at: new Date().toISOString(),
        };

        const { data: existing, error: selectErr } = await supabase
          .from('integrations')
          .select('id')
          .eq('provider', PROVIDER)
          .maybeSingle();

        if (selectErr) {
          throw new Error(
            selectErr.message + ' — تأكد من وجود جدول integrations في Supabase.'
          );
        }

        let error;
        if (existing?.id) {
          ({ error } = await supabase.from('integrations').update(meta).eq('id', existing.id));
        } else {
          ({ error } = await supabase.from('integrations').insert(meta));
        }

        if (error) {
          throw new Error(error.message || 'تعذّر حفظ بيانات تريلو في قاعدة البيانات');
        }

        // تنظيف أي مفاتيح قديمة كانت مخزّنة plaintext في الصف
        if (existing?.id) {
          await supabase
            .from('integrations')
            .update({ api_key: null, access_token: null })
            .eq('id', existing.id);
        }

        await loadConfig();
        showToast?.('تم الربط: ' + (me.fullName || me.username), 'ph-link');
        return me;
      } catch (err) {
        console.error(err);
        const msg = err?.message || 'فشل ربط تريلو';
        showToast?.(msg, 'ph-x-circle', 'error');
        throw err;
      }
    },
    [loadConfig, showToast]
  );

  const disconnect = useCallback(async () => {
    clearLocalCreds();
    const { error } = await supabase.from('integrations').delete().eq('provider', PROVIDER);
    if (error) {
      showToast?.('تعذّر قطع الربط', 'ph-x-circle', 'error');
      return;
    }
    setConfig(null);
    setMember(null);
    showToast?.('تم قطع ربط تريلو', 'ph-link-break');
  }, [showToast]);

  /**
   * @param {{ silent?: boolean }} [opts]
   * silent: مزامنة خلفية بلا إشعار (الافتراضي للإقلاع التلقائي)
   */
  const syncNow = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      const local = readLocalCreds();
      const apiKey = config?.api_key || local?.api_key;
      const accessToken = config?.access_token || local?.access_token;

      if (!apiKey || !accessToken) {
        if (!silent) showToast?.('اربط حساب تريلو أولاً', 'ph-warning', 'error');
        return { created: 0, updated: 0, completed: 0 };
      }

      if (syncing) return { created: 0, updated: 0, completed: 0 };

      setSyncing(true);
      try {
        const cards = await trelloFetchMyOpenCards(apiKey, accessToken);

        const { data: existingRows, error: fetchErr } = await supabase
          .from('tasks')
          .select('id, external_id, quadrant, completed, status')
          .eq('external_source', 'trello');

        if (fetchErr) throw fetchErr;

        const byExternal = new Map((existingRows || []).map((r) => [r.external_id, r]));

        let created = 0;
        let updated = 0;
        const now = new Date().toISOString();

        for (const card of cards) {
          const fields = mapTrelloCardToTaskFields(card);
          const prev = byExternal.get(card.id);

          if (prev) {
            const { error } = await supabase
              .from('tasks')
              .update({
                title: fields.title,
                notes: fields.notes,
                due_date: fields.dueDate || null,
                context: TRELLO_WORKSPACE_ID,
                external_url: fields.external_url,
                external_meta: fields.external_meta,
                last_synced_at: now,
              })
              .eq('id', prev.id);
            if (error) console.error(error);
            else updated += 1;
            byExternal.delete(card.id);
          } else {
            const { error } = await supabase.from('tasks').insert({
              title: fields.title,
              notes: fields.notes,
              due_date: fields.dueDate || null,
              quadrant: DEFAULT_QUADRANT,
              context: TRELLO_WORKSPACE_ID,
              completed: false,
              status: 'not_started',
              duration: 1,
              sort_order: 0,
              external_source: 'trello',
              external_id: fields.external_id,
              external_url: fields.external_url,
              external_meta: fields.external_meta,
              last_synced_at: now,
            });
            if (error) console.error(error);
            else created += 1;
          }
        }

        // عدم ظهور البطاقة في قائمة open لا يثبت أنها أُنجزت؛ قد تكون أُسندت
        // لعضو آخر أو تغيّرت صلاحيات الوصول أو تغيّرت الفلترة في Trello.
        await supabase
          .from('integrations')
          .update({ last_sync_at: now, updated_at: now, api_key: null, access_token: null })
          .eq('provider', PROVIDER);

        await loadConfig({ quiet: true });
        onSynced?.();

        if (!silent && created > 0) {
          showToast?.('مزامنة تريلو: ' + created + ' مهمة جديدة', 'ph-arrows-clockwise');
        }

        return {
          created,
          updated,
          completed: 0,
          total: cards.length,
        };
      } catch (err) {
        console.error(err);
        if (!silent) {
          showToast?.(err.message || 'فشلت المزامنة مع تريلو', 'ph-x-circle', 'error');
        }
        return { created: 0, updated: 0, completed: 0 };
      } finally {
        setSyncing(false);
      }
    },
    [config, loadConfig, onSynced, showToast, syncing]
  );

  return {
    config,
    loading,
    syncing,
    member,
    isConnected: !!(config?.api_key && config?.access_token),
    saveCredentials,
    disconnect,
    syncNow,
    reload: loadConfig,
  };
}
